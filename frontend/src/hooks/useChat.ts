import { useState, useRef } from 'react';
import type { ChatResponse, InternalEvent, IterationEvent, ToolCallEvent } from '../types';

type Message =
  | { role: 'user' | 'agent'; text: string; type?: 'normal' }
  | { role: 'agent'; type: 'confirmation'; text: string; answered: boolean; toolArgs?: unknown };

export const useChat = (autoAccept: boolean) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const pendingUserMsg = useRef<string | null>(null);
  const pendingContinuation = useRef<string | null>(null);
  const pendingTaskId = useRef<string | null>(null);
  const isConfirming = useRef(false);
  const requestInFlight = useRef(false);
  const abortController = useRef<AbortController | null>(null);
  const [iteration, setIteration] = useState(0);
  const [internalEvents, setInternalEvents] = useState<InternalEvent[]>([]);

  const callApi = async (
    userMsg: string,
    isConfirmed?: boolean,
    continuation?: string,
    ownsRequest = true,
    taskId?: string,
  ) => {
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
        }),
        signal: controller.signal,
      });
      if (!res.body) throw new Error('The chat response did not include a stream.');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let data: ChatResponse | null = null;

      const processEvent = (event: ChatResponse | InternalEvent | ToolCallEvent | IterationEvent) => {
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
        if (autoAccept) {
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
                text: data.message ?? 'Confirm?',
                answered: false,
                toolArgs: data.tool_args,
              },
            ];
          });
        }
      } else {
        pendingUserMsg.current = null;
        pendingContinuation.current = null;
        pendingTaskId.current = null;
        isConfirming.current = false;
        setMessages(prev => [
          ...prev,
          {
            role: 'agent',
            text: data.response || data.data || 'The agent returned no response.',
            type: 'normal',
          },
        ]);
      }
    } catch (error) {
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
          newMessages[i] = { ...m, answered: true };
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

  return {
    messages,
    loading,
    activeTool,
    iteration,
    internalEvents,
    handleSend,
    handleStop,
    handleConfirm,
  };
};