import { useState, useRef } from 'react';
import type { ChatResponse } from '../types';

type Message =
  | { role: 'user' | 'agent'; text: string; type?: 'normal' }
  | { role: 'agent'; type: 'confirmation'; text: string; answered: boolean };

export const useChat = (autoAccept: boolean) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const pendingUserMsg = useRef<string | null>(null);
  const isConfirming = useRef(false);

  const callApi = async (userMsg: string, isConfirmed?: boolean) => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, confirmed: isConfirmed }),
      });
      const data: ChatResponse = await res.json();

      if (data.status === 'requires_confirmation' && !isConfirming.current) {
        if (autoAccept) {
          isConfirming.current = true;
          pendingUserMsg.current = null;
          callApi(userMsg, true);
        } else {
          pendingUserMsg.current = userMsg;
          setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg?.role === 'agent' && lastMsg.type === 'confirmation' && !lastMsg.answered) {
              return prev;
            }
            return [
              ...prev,
              { role: 'agent', type: 'confirmation', text: data.message ?? 'Confirm?', answered: false },
            ];
          });
        }
      } else {
        pendingUserMsg.current = null;
        isConfirming.current = false;
        setMessages(prev => [
          ...prev,
          { role: 'agent', text: data.response || data.data || 'Done.', type: 'normal' },
        ]);
      }
    } catch (error) {
      console.error('Error calling API:', error);
      isConfirming.current = false;
    } finally {
      setLoading(false);
    }
  };

  const handleSend = (input: string) => {
    if (!input.trim()) return;
    isConfirming.current = false;
    setMessages(prev => [...prev, { role: 'user', text: input, type: 'normal' }]);
    callApi(input);
  };

  const handleConfirm = (choice: boolean) => {
    const originalMsg = pendingUserMsg.current;
    if (!originalMsg) return;

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
      callApi(originalMsg, true);
    } else {
      pendingUserMsg.current = null;
      isConfirming.current = false;
      setMessages(prev => [
        ...prev,
        { role: 'agent', text: 'Action cancelled.', type: 'normal' },
      ]);
    }
  };

  return {
    messages,
    loading,
    handleSend,
    handleConfirm,
  };
};