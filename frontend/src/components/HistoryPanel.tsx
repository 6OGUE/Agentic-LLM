import React from 'react';
import type { ConversationHistoryEntry } from '../types';

interface HistoryPanelProps {
  entries: ConversationHistoryEntry[];
  historyEnabled: boolean;
  onToggleHistory: (enabled: boolean) => void;
  onEditEntry: (index: number, field: keyof ConversationHistoryEntry, value: string) => void;
  onDeleteEntry: (index: number) => void;
  onClear: () => void;
  onClose: () => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({
  entries,
  historyEnabled,
  onToggleHistory,
  onEditEntry,
  onDeleteEntry,
  onClear,
  onClose,
}) => (
  <div className="popup-backdrop" onMouseDown={event => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <section className="history-panel popup-window" role="dialog" aria-modal="true" aria-labelledby="history-title">
      <div className="popup-window-header">
        <div>
          <span className="console-kicker">Saved for this page session</span>
          <h2 id="history-title">Conversation History</h2>
        </div>
        <div className="history-panel-actions">
          {entries.length > 0 && (
            <button type="button" className="history-clear" onClick={onClear}>Clear all</button>
          )}
          <button className="console-close" type="button" onClick={onClose} aria-label="Close history">×</button>
        </div>
      </div>
      <label className={`auto-accept-label history-enabled-label${historyEnabled ? ' active' : ''}`}>
        Include history in system prompt
        <div className="toggle">
          <input
            type="checkbox"
            checked={historyEnabled}
            onChange={event => onToggleHistory(event.target.checked)}
            aria-label="Include conversation history in the system prompt"
          />
          <div className="toggle-track" />
          <div className="toggle-thumb" />
        </div>
      </label>
      {entries.length === 0 ? (
        <p className="history-empty">No saved conversations yet. Turn on History and complete a chat to save it.</p>
      ) : (
        <div className="history-entries">
          {entries.map((entry, index) => (
            <article className="history-entry" key={index}>
              <div className="history-entry-header">
                <span>Conversation {index + 1}</span>
                <button
                  type="button"
                  className="history-delete"
                  onClick={() => onDeleteEntry(index)}
                  aria-label={`Delete conversation ${index + 1}`}
                >
                  Delete
                </button>
              </div>
              <label>
                User message
                <textarea
                  value={entry.user_message}
                  onChange={event => onEditEntry(index, 'user_message', event.target.value)}
                  rows={3}
                />
              </label>
              <label>
                Final response
                <textarea
                  value={entry.assistant_response}
                  onChange={event => onEditEntry(index, 'assistant_response', event.target.value)}
                  rows={4}
                />
              </label>
            </article>
          ))}
        </div>
      )}
    </section>
  </div>
);

export default HistoryPanel;
