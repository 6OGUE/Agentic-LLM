import React, { useEffect, useRef } from 'react';
import type { InternalEvent } from '../types';

interface InternalConsoleProps {
  events: InternalEvent[];
  onClose: () => void;
}

const formatValue = (value: unknown, label: string): string[] => {
  if (value === null || typeof value !== 'object') {
    return [`${label}: ${String(value)}`];
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return [`${label}: []`];
    return value.flatMap((item, index) => formatValue(item, `${label}[${index}]`));
  }

  const entries = Object.entries(value);
  if (entries.length === 0) return [`${label}: {}`];
  return entries.flatMap(([key, nestedValue]) => (
    formatValue(nestedValue, `${label}.${key.replaceAll('_', ' ')}`)
  ));
};

const formatEventDetails = (event: InternalEvent) => {
  const details = Object.entries(event).filter(([key, value]) => (
    key !== 'event'
    && key !== 'iteration'
    && key !== 'status'
    && key !== 'duration_seconds'
    && value !== undefined
  ));

  return details.flatMap(([key, value]) => (
    formatValue(value, key.replaceAll('_', ' '))
  )).join('\n');
};

const InternalConsole: React.FC<InternalConsoleProps> = ({ events, onClose }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  return (
    <div className="popup-backdrop console-backdrop" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <aside className="internal-console popup-window" role="dialog" aria-modal="true" aria-labelledby="console-title">
        <div className="internal-console-header">
          <div>
            <span className="console-kicker">Runtime trace</span>
            <h2 id="console-title">Internal console</h2>
          </div>
          <button className="console-close" type="button" onClick={onClose} aria-label="Close internal console">×</button>
        </div>
        <div className="console-output">
          {events.length === 0 ? (
            <div className="console-empty">Waiting for an agent call...</div>
          ) : events.map((event, index) => (
            <div className="console-entry" key={`${event.event}-${index}`}>
              <div className="console-entry-title">
                <span>{event.event === 'llm_call' ? 'LLM response' : event.event === 'tool_execution' ? 'Tool execution' : 'Agent response'}</span>
                {event.iteration && <small>iteration {event.iteration}</small>}
                {event.status && <small>{event.status}</small>}
                {event.duration_seconds !== undefined && (
                  <small className="console-entry-duration">{event.duration_seconds.toFixed(2)} s</small>
                )}
                {event.event === 'tool_execution' && event.status === 'started' && (
                  <small className="console-entry-duration">in progress</small>
                )}
              </div>
              {formatEventDetails(event) && <pre>{formatEventDetails(event)}</pre>}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </aside>
    </div>
  );
};

export default InternalConsole;