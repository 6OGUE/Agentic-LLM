import { useEffect, useState, useRef } from 'react';
import type {
  ChatResponse,
  ConversationHistoryEntry,
  InternalEvent,
  IterationEvent,
  ToolCallEvent,
} from '../types';

type Message =
  | { role: 'user' | 'agent'; text: string; type?: 'normal' }
  | {
    role: 'agent';
    type: 'confirmation';
    text: string;
    answered: boolean;
    toolName?: string;
    toolArgs?: unknown;
    toolNames?: string[];
    toolCallKeys?: string[];
    toolDisplayNames?: Record<string, string>;
    confirmedMessage?: string;
  };

const normalizeToolCallValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalizeToolCallValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, normalizeToolCallValue(nestedValue)]),
    );
  }
  return value;
};

const getBatchToolCalls = (toolArgs: unknown): { name: string; key: string }[] => {
  if (!toolArgs || typeof toolArgs !== 'object' || !('operations' in toolArgs)) {
    return [];
  }

  const operations = toolArgs.operations;
  if (!Array.isArray(operations)) return [];

  const calls = operations.map(operation => {
    const operationRecord = operation && typeof operation === 'object'
      ? operation as Record<string, unknown>
      : {};
    const name = typeof operationRecord.tool === 'string'
      ? operationRecord.tool
      : 'Invalid operation';
    const args = operationRecord.args ?? {};

    return {
      name,
      key: JSON.stringify([name, normalizeToolCallValue(args)]),
    };
  });

  return calls.filter((call, index) => (
    calls.findIndex(candidate => candidate.key === call.key) === index
  ));
};

const mergePerformedToolCalls = (
  messages: Message[],
  toolNames: string[],
  toolCallKeys: string[],
  toolDisplayNames?: Record<string, string>,
): Message[] => {
  let latestUserMessage = -1;
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index].role === 'user') {
      latestUserMessage = index;
      break;
    }
  }

  for (let index = messages.length - 1; index > latestUserMessage; index--) {
    const message = messages[index];
    if (
      message.role !== 'agent'
      || message.type !== 'confirmation'
      || !message.answered
      || message.confirmedMessage !== 'Actions Performed:'
    ) continue;

    const existingKeys = new Set(message.toolCallKeys ?? []);
    const mergedNames = [...(message.toolNames ?? [])];
    const mergedKeys = [...existingKeys];
    toolCallKeys.forEach((key, callIndex) => {
      if (existingKeys.has(key)) return;
      existingKeys.add(key);
      mergedKeys.push(key);
      mergedNames.push(toolNames[callIndex]);
    });

    const next = [...messages];
    next[index] = {
      ...message,
      toolNames: mergedNames,
      toolCallKeys: mergedKeys,
      toolDisplayNames: { ...message.toolDisplayNames, ...toolDisplayNames },
    };
    return next;
  }

  return [
    ...messages,
    {
      role: 'agent',
      type: 'confirmation',
      text: 'Actions Performed:',
      answered: true,
      toolName: 'run_tool_batch',
      toolNames,
      toolCallKeys,
      toolDisplayNames,
      confirmedMessage: 'Actions Performed:',
    },
  ];
};

const isSameToolExecution = (previous: InternalEvent, current: InternalEvent): boolean => (
  previous.event === 'tool_execution'
  && current.event === 'tool_execution'
  && previous.tool_name === current.tool_name
  && JSON.stringify(normalizeToolCallValue(previous.tool_args))
    === JSON.stringify(normalizeToolCallValue(current.tool_args))
);

const getConfirmationMessages = (
  toolName: string | undefined,
  toolArgs: unknown,
  message: string | undefined,
  confirmedMessage: string | undefined,
  toolDisplayNames: Record<string, string> | undefined,
) => {
  if (toolName !== 'run_tool_batch') {
    return { text: message ?? 'Confirm?', confirmedMessage, toolDisplayNames };
  }

  const toolCalls = getBatchToolCalls(toolArgs);
  if (toolCalls.length === 0) {
    return { text: message ?? 'Confirm this batch of tools?', confirmedMessage, toolDisplayNames };
  }

  return {
    text: 'Tools required:',
    toolNames: toolCalls.map(call => call.name),
    toolCallKeys: toolCalls.map(call => call.key),
    toolDisplayNames,
    confirmedMessage: 'Actions Performed:',
  };
};

export const useChat = (
  autoAccept: boolean,
  conversationHistoryEnabled: boolean,
) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const pendingUserMsg = useRef<string | null>(null);
  const pendingContinuation = useRef<string | null>(null);
  const pendingTaskId = useRef<string | null>(null);
  const isConfirming = useRef(false);
  const requestInFlight = useRef(false);
  const abortController = useRef<AbortController | null>(null);
  const [conversationHistory, setConversationHistory] = useState<ConversationHistoryEntry[]>([]);
  const conversationHistoryRef = useRef<ConversationHistoryEntry[]>([]);
  const recordConversationHistory = useRef(false);
  const [conversationHistoryStatus, setConversationHistoryStatus] = useState('Loading history…');
  const historyLoad = useRef<Promise<void>>(Promise.resolve());
  const historySaveQueue = useRef<Promise<void>>(Promise.resolve());
  const historyModified = useRef(false);
  const [iteration, setIteration] = useState(0);
  const [internalEvents, setInternalEvents] = useState<InternalEvent[]>([]);

  useEffect(() => {
    historyLoad.current = fetch('http://localhost:8000/conversation-history')
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail ?? 'Could not load conversation history.');
        return data as { entries: ConversationHistoryEntry[] };
      })
      .then(data => {
        if (!historyModified.current) {
          conversationHistoryRef.current = data.entries;
          setConversationHistory(data.entries);
        }
        setConversationHistoryStatus('');
      })
      .catch(error => {
        setConversationHistoryStatus(
          error instanceof Error ? `Could not load history: ${error.message}` : 'Could not load history.',
        );
      });
  }, []);

  const persistConversationHistory = (entries: ConversationHistoryEntry[]) => {
    setConversationHistoryStatus('Saving history…');
    historySaveQueue.current = historySaveQueue.current
      .catch(() => undefined)
      .then(() => historyLoad.current)
      .then(async () => {
        const response = await fetch('http://localhost:8000/conversation-history', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entries }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail ?? 'Could not save conversation history.');
        setConversationHistoryStatus('History saved');
      })
      .catch(error => {
        setConversationHistoryStatus(
          error instanceof Error ? `Could not save history: ${error.message}` : 'Could not save history.',
        );
      });
  };

  const callApi = async (
    userMsg: string,
    isConfirmed?: boolean,
    continuation?: string,
    ownsRequest = true,
    taskId?: string,
  ) => {
    await historyLoad.current;
    const controller = new AbortController();
    abortController.current = controller;
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: continuation ?? userMsg,
          confirmed: isConfirmed,
          task_id: taskId,
          conversation_history_enabled: recordConversationHistory.current,
          conversation_history: recordConversationHistory.current ? conversationHistoryRef.current : [],
        }),
        signal: controller.signal,
      });
      if (!res.body) throw new Error('The chat response did not include a stream.');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let data: ChatResponse | null = null;

      const processEvent = (
        event: ChatResponse
          | InternalEvent
          | ToolCallEvent
          | IterationEvent,
      ) => {
        if ('event' in event && event.event === 'tool_call') {
          setActiveTool(event.tool_name);
        } else if ('event' in event && event.event === 'iteration') {
          setIteration(event.iteration);
        } else if ('event' in event && (event.event === 'llm_call' || event.event === 'tool_execution' || event.event === 'agent_response')) {
          setInternalEvents(prev => {
            if (event.event !== 'tool_execution') return [...prev, event];

            for (let index = prev.length - 1; index >= 0; index--) {
              const previousEvent = prev[index];
              if (isSameToolExecution(previousEvent, event)) {
                const next = [...prev];
                next[index] = event;
                return next;
              }
            }

            return [...prev, event];
          });
        } else {
          data = event;
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        lines.filter(Boolean).forEach(line => processEvent(JSON.parse(line)));
        if (done) break;
      }

      if (buffer.trim()) processEvent(JSON.parse(buffer));
      if (!data) throw new Error('The chat response did not include a final event.');

      if (data.status === 'requires_confirmation') {
        const confirmation = getConfirmationMessages(
          data.tool_name,
          data.tool_args,
          data.message,
          data.confirmed_message,
          data.tool_display_names,
        );
        if (autoAccept) {
          setMessages(prev => {
            if (confirmation.toolNames && confirmation.toolCallKeys) {
              return mergePerformedToolCalls(
                prev,
                confirmation.toolNames,
                confirmation.toolCallKeys,
                confirmation.toolDisplayNames,
              );
            }
            return [
              ...prev,
              {
                role: 'agent',
                type: 'confirmation',
                text: confirmation.confirmedMessage ?? confirmation.text,
                answered: true,
                toolName: data.tool_name,
                toolNames: confirmation.toolNames,
                toolCallKeys: confirmation.toolCallKeys,
                toolDisplayNames: confirmation.toolDisplayNames,
              },
            ];
          });
          isConfirming.current = true;
          pendingUserMsg.current = null;
          pendingContinuation.current = null;
          await callApi(userMsg, true, data.continuation, false, data.task_id);
        } else {
          pendingUserMsg.current = userMsg;
          pendingContinuation.current = data.continuation ?? userMsg;
          pendingTaskId.current = data.task_id ?? null;
          setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg?.role === 'agent' && lastMsg.type === 'confirmation' && !lastMsg.answered) {
              return prev;
            }
            return [
              ...prev,
              {
                role: 'agent',
                type: 'confirmation',
                text: confirmation.text,
                answered: false,
                toolName: data.tool_name,
                toolArgs: data.tool_args,
                toolNames: confirmation.toolNames,
                toolCallKeys: confirmation.toolCallKeys,
                toolDisplayNames: confirmation.toolDisplayNames,
                confirmedMessage: confirmation.confirmedMessage,
              },
            ];
          });
        }
      } else {
        pendingUserMsg.current = null;
        pendingContinuation.current = null;
        pendingTaskId.current = null;
        isConfirming.current = false;
        const finalResponse = data.response || data.data || 'The agent returned no response.';
        if (recordConversationHistory.current && data.status === 'success') {
          const nextHistory = [
            ...conversationHistoryRef.current,
            { user_message: userMsg, assistant_response: finalResponse },
          ];
          historyModified.current = true;
          conversationHistoryRef.current = nextHistory;
          setConversationHistory(nextHistory);
          persistConversationHistory(nextHistory);
        }
        recordConversationHistory.current = false;
        setMessages(prev => [
          ...prev,
          {
            role: 'agent',
            text: finalResponse,
            type: 'normal',
          },
        ]);
      }
    } catch (error) {
      recordConversationHistory.current = false;
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('Error calling API:', error);
      isConfirming.current = false;
    } finally {
      if (abortController.current === controller) {
        abortController.current = null;
        setIteration(0);
      }
      if (ownsRequest) requestInFlight.current = false;
      setActiveTool(null);
      setLoading(false);
    }
  };

  const handleStop = () => {
    abortController.current?.abort();
  };

  const handleSend = (input: string) => {
    if (!input.trim() || requestInFlight.current) return;
    requestInFlight.current = true;
    isConfirming.current = false;
    recordConversationHistory.current = conversationHistoryEnabled;
    setMessages(prev => [...prev, { role: 'user', text: input, type: 'normal' }]);
    callApi(input);
  };

  const handleConfirm = (choice: boolean) => {
    const originalMsg = pendingUserMsg.current;
    if (!originalMsg || requestInFlight.current) return;
    requestInFlight.current = true;
    const continuation = pendingContinuation.current ?? originalMsg;
    const taskId = pendingTaskId.current ?? undefined;

    setMessages(prev => {
      const newMessages = [...prev];
      for (let i = newMessages.length - 1; i >= 0; i--) {
        const m = newMessages[i];
        if (m.role === 'agent' && m.type === 'confirmation' && !m.answered) {
          if (
            choice
            && m.confirmedMessage === 'Actions Performed:'
            && m.toolNames
            && m.toolCallKeys
          ) {
            newMessages.splice(i, 1);
            return mergePerformedToolCalls(
              newMessages,
              m.toolNames,
              m.toolCallKeys,
              m.toolDisplayNames,
            );
          }

          newMessages[i] = {
            ...m,
            answered: true,
            text: choice ? m.confirmedMessage ?? m.text : m.text,
          };
          break;
        }
      }
      return newMessages;
    });

    if (choice) {
      isConfirming.current = true;
      pendingUserMsg.current = null;
      pendingContinuation.current = null;
      pendingTaskId.current = null;
      callApi(originalMsg, true, continuation, true, taskId);
    } else {
      isConfirming.current = true;
      pendingUserMsg.current = null;
      pendingContinuation.current = null;
      pendingTaskId.current = null;
      callApi(originalMsg, false, continuation, true, taskId);
    }
  };

  const handleEditHistoryEntry = (
    index: number,
    field: keyof ConversationHistoryEntry,
    value: string,
  ) => {
    const nextHistory = conversationHistoryRef.current.map((entry, entryIndex) => (
      entryIndex === index ? { ...entry, [field]: value } : entry
    ));
    historyModified.current = true;
    conversationHistoryRef.current = nextHistory;
    setConversationHistory(nextHistory);
    persistConversationHistory(nextHistory);
  };

  const handleDeleteHistoryEntry = (index: number) => {
    const nextHistory = conversationHistoryRef.current.filter((_, entryIndex) => entryIndex !== index);
    historyModified.current = true;
    conversationHistoryRef.current = nextHistory;
    setConversationHistory(nextHistory);
    persistConversationHistory(nextHistory);
  };

  const handleClearConversationHistory = () => {
    historyModified.current = true;
    conversationHistoryRef.current = [];
    setConversationHistory([]);
    persistConversationHistory([]);
  };

  return {
    messages,
    conversationHistory,
    conversationHistoryStatus,
    loading,
    activeTool,
    iteration,
    internalEvents,
    handleSend,
    handleStop,
    handleConfirm,
    handleEditHistoryEntry,
    handleDeleteHistoryEntry,
    handleClearConversationHistory,
  };
};