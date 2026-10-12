import React, { useState } from 'react';

type MessageType =
  | { role: 'user' | 'agent'; text: string; type?: 'normal' }
  | { role: 'agent'; type: 'confirmation'; text: string; answered: boolean; toolArgs?: unknown };

interface MessageProps {
  message: MessageType;
  onConfirm: (choice: boolean) => void;
}

const renderInlineText = (text: string) => text
  .split(/(\*\*.+?\*\*)/g)
  .map((segment, index) => (
    segment.startsWith('**') && segment.endsWith('**')
      ? <strong key={index}>{segment.slice(2, -2)}</strong>
      : segment
  ));

const renderMessageText = (text: string) => {
  const lines = text.split(/\r?\n/);

  return lines.map((line, index) => {
    const listItem = line.match(/^(\s*)(?:\d+\.|[-*+])\s+(.+)$/);

    if (listItem) {
      const indentation = listItem[1].replace(/\t/g, '  ').length;
      const depth = Math.floor(indentation / 2);

      return (
        <div className="message-list-item" key={index} style={{ marginLeft: `${depth * 1.15}em` }}>
          <span>{renderInlineText(listItem[2])}</span>
        </div>
      );
    }

    return (
      <React.Fragment key={index}>
        {renderInlineText(line)}
        {index < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
};

const Message: React.FC<MessageProps> = ({ message, onConfirm }) => {
  const [showDetails, setShowDetails] = useState(false);

  const formattedArgs = message.type === 'confirmation'
    ? Object.entries(message.toolArgs && typeof message.toolArgs === 'object' ? message.toolArgs : {})
      .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
      .join('\n')
    : null;

  return (
    <div className={`msg-row ${message.role}`}>
      <div className={`avatar ${message.role}`}>
        {message.role === 'agent' ? '֎' : 'U'}
      </div>
      <div className={`bubble ${message.role}`}>
        {renderMessageText(message.text)}
        {message.role === 'agent' && message.type === 'confirmation' && !message.answered && (
          <>
            <div className="confirm-actions">
              <button className="btn-yes" onClick={() => onConfirm(true)}>Allow</button>
              <button className="btn-no" onClick={() => onConfirm(false)}>Disallow</button>
              <button className="btn-details" onClick={() => setShowDetails(value => !value)} aria-expanded={showDetails}>
                Details
              </button>
            </div>


            {showDetails && (
              <div className="tool-details" role="dialog" aria-label="Tool parameters">
                <div className="tool-details-title">Parameters</div>
                <pre>{formattedArgs}</pre>
              </div>
            )}
          </>
        )}


        
      </div>
    </div>
  );
};

export default Message;