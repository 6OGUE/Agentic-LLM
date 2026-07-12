import React from 'react';

type MessageType =
  | { role: 'user' | 'agent'; text: string; type?: 'normal' }
  | { role: 'agent'; type: 'confirmation'; text: string; answered: boolean };

interface MessageProps {
  message: MessageType;
  onConfirm: (choice: boolean) => void;
}

const Message: React.FC<MessageProps> = ({ message, onConfirm }) => {
  return (
    <div className={`msg-row ${message.role}`}>
      <div className={`avatar ${message.role}`}>
        {message.role === 'agent' ? '✦' : 'U'}
      </div>
      <div className={`bubble ${message.role}`}>
        {message.text}
        {message.role === 'agent' && message.type === 'confirmation' && !message.answered && (
          <div className="confirm-actions">
            <button className="btn-yes" onClick={() => onConfirm(true)}>Yes</button>
            <button className="btn-no" onClick={() => onConfirm(false)}>No</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Message;