import React, { useState } from 'react';

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
  };

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

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

const formatArgumentValue = (value: unknown): string => {
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(formatArgumentValue).join(', ')}]`;
  if (isRecord(value)) {
    return `{${Object.entries(value)
      .map(([key, nestedValue]) => `${key}=${formatArgumentValue(nestedValue)}`)
      .join(', ')}}`;
  }
  return String(value);
};

const formatToolCall = (toolName: string, args: Record<string, unknown>): string => (
  `${toolName}(${Object.entries(args)
    .map(([key, value]) => `${key}=${formatArgumentValue(value)}`)
    .join(', ')})`
);

const getToolDisplayName = (toolName: string, displayNames?: Record<string, string>): string => (
  displayNames?.[toolName] ?? toolName
);

const Message: React.FC<MessageProps> = ({ message, onConfirm }) => {
  const [showDetails, setShowDetails] = useState(false);

  const toolArgs = message.type === 'confirmation' && isRecord(message.toolArgs)
    ? message.toolArgs
    : {};
  const batchOperations = message.type === 'confirmation'
    && message.toolName === 'run_tool_batch'
    && Array.isArray(toolArgs.operations)
    ? toolArgs.operations
    : null;
  const batchToolNames = message.type === 'confirmation'
    && message.toolName === 'run_tool_batch'
    && Array.isArray(message.toolNames)
    ? message.toolNames
    : null;

  const toolCalls = message.type !== 'confirmation'
    ? []
    : batchOperations
      ? batchOperations.map(operation => {
        const operationRecord = isRecord(operation) ? operation : {};
        const toolName = typeof operationRecord.tool === 'string'
          ? operationRecord.tool
          : 'Unknown tool';
        const args = isRecord(operationRecord.args) ? operationRecord.args : {};

        return formatToolCall(getToolDisplayName(toolName, message.toolDisplayNames), args);
      })
      : [formatToolCall(
        getToolDisplayName(message.toolName ?? 'Unknown tool', message.toolDisplayNames),
        toolArgs,
      )];

  return (
    <div className={`msg-row ${message.role}`}>
      <div className={`avatar ${message.role}`}>
        {message.role === 'agent' ? (
  <span style={{ fontSize: '21px', marginLeft: '3px',marginBottom: '5px' }}>𓅭</span>
) : (
  <span style={{ fontSize: '23px' }}>🗣</span>
)}
      </div>
      <div className={`bubble ${message.role}`}>
        {batchToolNames ? (
          <>
            <div>{renderMessageText(message.text)}</div>
            <ul className="tool-name-list" aria-label="Tools in this batch">
              {batchToolNames.map((toolName, index) => (
                <li className="tool-name-chip" key={`${toolName}-${index}`}>
                  {getToolDisplayName(toolName, message.toolDisplayNames)}
                </li>
              ))}
            </ul>
            {!message.answered && <div className="confirmation-question"></div>}
          </>
        ) : renderMessageText(message.text)}
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
                <div className="tool-details-title">
                  Tool calls
                </div>
                <ul className="tool-call-list">
                  {toolCalls.map((toolCall, index) => (
                    <li key={`${toolCall}-${index}`}><code>{toolCall}</code></li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}


        
      </div>
    </div>
  );
};

export default Message;