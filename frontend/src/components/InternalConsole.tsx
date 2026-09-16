import React, { useEffect, useRef } from 'react';
import type { InternalEvent } from '../types';

interface InternalConsoleProps {
  events: InternalEvent[];
  onClose: () => void;
}

const formatValue = (value: unknown, indent = '', label = ''): string[] => {
  const prefix = label ? `${indent}${label}:` : indent;
  if (value === null) return [`${prefix} null`];
  if (typeof value !== 'object') return [`${prefix} ${String(value)}`];

  if (Array.isArray(value)) {
    return [prefix, ...value.flatMap(item => formatValue(item, `${indent}  `))];
  }

  return [
    prefix,
    ...Object.entries(value).flatMap(([key, nestedValue]) => (
      formatValue(nestedValue, `${indent}  `, key.replaceAll('_', ' '))
    )),
  ];
};

const formatEventDetails = (event: InternalEvent) => {
  const details = Object.entries(event).filter(([key, value]) => (
    key !== 'event' && key !== 'iteration' && key !== 'status' && value !== undefined
  ));

  return details.flatMap(([key, value]) => (
    formatValue(value, '', key.replaceAll('_', ' '))
  )).join('\n');
};

const InternalConsole: React.FC<InternalConsoleProps> = ({ events, onClose }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  return (
    <aside className="internal-console" aria-label="Internal agent console">
      <div className="internal-console-header">
        <div>
          <span className="console-kicker">Runtime trace</span>
          <h2>Internal console</h2>
        </div>
        <button className="console-close" type="button" onClick={onClose} aria-label="Close internal console">×</button>
      </div>
      <div className="console-output">
        {events.length === 0 ? (
          <div className="console-empty">Waiting for an agent call...</div>
        ) : events.map((event, index) => (
          <div className="console-entry" key={`${event.event}-${index}`}>
            <div className="console-entry-title">
              <span>{event.event === 'llm_call' ? 'LLM call' : event.event === 'tool_execution' ? 'Tool execution' : 'Agent response'}</span>
              {event.iteration && <small>iteration {event.iteration}</small>}
              {event.status && <small>{event.status}</small>}
            </div>
            {formatEventDetails(event) && <pre>{formatEventDetails(event)}</pre>}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </aside>
  );
};

export default InternalConsole;