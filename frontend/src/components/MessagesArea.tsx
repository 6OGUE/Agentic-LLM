import React, { useRef, useEffect } from 'react';
import Message from './Message';

type MessageType =
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

interface MessagesAreaProps {
  messages: MessageType[];
  loading: boolean;
  activeTool: string | null;
  onConfirm: (choice: boolean) => void;
}

const MessagesArea: React.FC<MessagesAreaProps> = ({ messages, loading, activeTool, onConfirm }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const isEmpty = messages.length === 0 && !loading;

  return (
    <div className="messages-area">
      {isEmpty ? (
        <div className="empty-state">
          <div className="empty-icon">
  <span style={{ display: 'inline-block', transform: 'translateX(1px)' }}>𓅭</span></div>
          <span className="empty-label">Quack Quack!</span>
        </div>
      ) : (
        <>
          {messages.map((m, i) => (
            <Message key={i} message={m} onConfirm={onConfirm} />
          ))}
          {loading && (
            <div className="thinking-row">
              <div className="avatar agent">
                <span style={{ fontSize: '21px', marginLeft: '3px', marginBottom: '5px' }}>𓅭</span>
              </div>
              <div className="thinking-status">
                {activeTool && <span className="tool-label">Executing tool</span>}
                <div className="dot" />
                <div className="dot" />
                <div className="dot" />
              </div>
            </div>
          )}
        </>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessagesArea;