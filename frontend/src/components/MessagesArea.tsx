import React, { useRef, useEffect } from 'react';
import Message from './Message';

type MessageType =
  | { role: 'user' | 'agent'; text: string; type?: 'normal' }
  | { role: 'agent'; type: 'confirmation'; text: string; answered: boolean };

interface MessagesAreaProps {
  messages: MessageType[];
  loading: boolean;
  onConfirm: (choice: boolean) => void;
}

const MessagesArea: React.FC<MessagesAreaProps> = ({ messages, loading, onConfirm }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const isEmpty = messages.length === 0 && !loading;

  return (
    <div className="messages-area">
      {isEmpty ? (
        <div className="empty-state">
          <div className="empty-icon">✦</div>
          <span className="empty-label">How can I help you today?</span>
        </div>
      ) : (
        <>
          {messages.map((m, i) => (
            <Message key={i} message={m} onConfirm={onConfirm} />
          ))}
          {loading && (
            <div className="thinking-row">
              <div className="avatar agent">✦</div>
              <div className="dots">
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