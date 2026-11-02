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
    toolDisplayNames?: Record<string, string>;
    confirmedMessage?: string;
  };

const getBatchToolNames = (toolArgs: unknown): string[] => {
  if (!toolArgs || typeof toolArgs !== 'object' || !('operations' in toolArgs)) {
    return [];
  }

  const operations = toolArgs.operations;
  if (!Array.isArray(operations)) return [];

  return operations.map(operation => (
    operation && typeof operation === 'object' && 'tool' in operation
      && typeof operation.tool === 'string'
      ? operation.tool
      : 'Invalid operation'
  ));
};

const getConfirmationMessages = (
  toolName: string | undefined,
  toolArgs: unknown,
  message: string | undefined,
  confirmedMessage: string | undefined,
  toolDisplayNames: Record<string, string> | undefined,
) => {
  if (toolName !== 'run_tool_batch') {
    return {
      text: message ?? 'Confirm?',
      confirmedMessage,
      toolDisplayNames,
    };
  }

  const toolNames = getBatchToolNames(toolArgs);
  if (toolNames.length === 0) {
    return {
      text: message ?? 'Confirm this batch of tools?',
      confirmedMessage,
      toolDisplayNames,
    };
  }

  return {
    text: 'Tools required:',
    toolNames,
    toolDisplayNames,
    confirmedMessage: 'Tools Executed:',
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
            if (event.event !== 'tool_execution' || event.status !== 'completed') {
              return [...prev, event];
            }

            for (let index = prev.length - 1; index >= 0; index--) {
              const previousEvent = prev[index];
              if (
                previousEvent.event === 'tool_execution'
                && previousEvent.tool_name === event.tool_name
                && previousEvent.status === 'started'
              ) {
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
          setMessages(prev => [
            ...prev,
            {
              role: 'agent',
              type: 'confirmation',
              text: confirmation.confirmedMessage ?? confirmation.text,
              answered: true,
              toolName: data.tool_name,
              toolNames: confirmation.toolNames,
              toolDisplayNames: confirmation.toolDisplayNames,
            },
          ]);
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