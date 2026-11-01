import React from 'react';
import HistoryPanel from './HistoryPanel';
import type { ConversationHistoryEntry } from '../types';

interface HeaderProps {
  autoAccept: boolean;
  onToggleAutoAccept: (checked: boolean) => void;
  conversationHistoryEnabled: boolean;
  onToggleConversationHistory: (checked: boolean) => void;
  conversationHistory: ConversationHistoryEntry[];
  onEditHistoryEntry: (index: number, field: keyof ConversationHistoryEntry, value: string) => void;
  onDeleteHistoryEntry: (index: number) => void;
  onClearConversationHistory: () => void;
  consoleOpen: boolean;
  onToggleConsole: () => void;
  customInstruction: string;
  onCustomInstructionChange: (value: string) => void;
  customInstructionStatus: string;
  apiKey: string;
  onApiKeyChange: (value: string) => void;
  apiKeyConfigured: boolean;
  apiKeyError: string;
  apiKeyBusy: boolean;
  onSaveApiKey: () => void;
  onClearApiKey: () => void;
  model: string;
  availableModels: string[];
  modelError: string;
  modelBusy: boolean;
  onModelChange: (value: string) => void;
}

const Header: React.FC<HeaderProps> = ({
  autoAccept,
  onToggleAutoAccept,
  conversationHistoryEnabled,
  onToggleConversationHistory,
  conversationHistory,
  onEditHistoryEntry,
  onDeleteHistoryEntry,
  onClearConversationHistory,
  consoleOpen,
  onToggleConsole,
  customInstruction,
  onCustomInstructionChange,
  customInstructionStatus,
  apiKey,
  onApiKeyChange,
  apiKeyConfigured,
  apiKeyError,
  apiKeyBusy,
  onSaveApiKey,
  onClearApiKey,
  model,
  availableModels,
  modelError,
  modelBusy,
  onModelChange,
}) => {
  const [keyEntryOpen, setKeyEntryOpen] = React.useState(false);
  const [customizeOpen, setCustomizeOpen] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);

  const toggleConsole = () => {
    if (keyEntryOpen) setKeyEntryOpen(false);
    setCustomizeOpen(false);
    setHistoryOpen(false);
    onToggleConsole();
  };
  const toggleApiKeyPanel = () => {
    const opening = !keyEntryOpen;
    setKeyEntryOpen(opening);
    if (opening) setCustomizeOpen(false);
    if (opening) setHistoryOpen(false);
    if (opening && consoleOpen) onToggleConsole();
  };
  const toggleCustomizePanel = () => {
    const opening = !customizeOpen;
    setCustomizeOpen(opening);
    if (opening && consoleOpen) onToggleConsole();
    if (opening && keyEntryOpen) setKeyEntryOpen(false);
    if (opening) setHistoryOpen(false);
  };
  const toggleHistoryPanel = () => {
    const opening = !historyOpen;
    setHistoryOpen(opening);
    if (opening) {
      setCustomizeOpen(false);
      setKeyEntryOpen(false);
      if (consoleOpen) onToggleConsole();
    }
  };

  return (
    <div className="header">
      
      <span className="header-title" style={{ fontSize: "1.9rem" }}>𓅭</span>
      <button className={`console-toggle${consoleOpen ? ' active' : ''}`} type="button" onClick={toggleConsole} aria-pressed={consoleOpen}>
        
        &lt;/&gt; Console
      </button>
      <div className="customize-control">
        <button className={`customize-toggle${customizeOpen ? ' active' : ''}`} type="button" onClick={toggleCustomizePanel} aria-expanded={customizeOpen}>
          <span style={{ fontSize: '16px' }}>🖍</span> Context
        </button>
        {customizeOpen && (
          <div className="popup-backdrop" onMouseDown={event => {
            if (event.target === event.currentTarget) setCustomizeOpen(false);
          }}>
            <section className="customize-panel popup-window" role="dialog" aria-modal="true" aria-labelledby="customize-title">
              <div className="popup-window-header">
                <div>
                  <span className="console-kicker">Personalize</span>
                  <h2 id="customize-title">Edit Context</h2>
                </div>
                <button className="console-close" type="button" onClick={() => setCustomizeOpen(false)} aria-label="Close customization">×</button>
              </div>
              <label htmlFor="custom-system-instruction">Add or Delete Context</label>
              <textarea
                id="custom-system-instruction"
                value={customInstruction}
                onChange={event => onCustomInstructionChange(event.target.value)}
                placeholder="Start Typing..."
                rows={10}
              />
              <div className="model-status" role="status">{customInstructionStatus}</div>
            </section>
          </div>
        )}
      </div>
      <button
        className={`history-toggle${historyOpen ? ' active' : ''}`}
        type="button"
        onClick={toggleHistoryPanel}
        aria-expanded={historyOpen}
      >
        History ({conversationHistory.length})
      </button>
      <div className="api-key-control">
        <button className={`api-key-toggle${apiKeyConfigured ? ' configured' : ''}`} type="button" onClick={toggleApiKeyPanel} aria-expanded={keyEntryOpen}>
          {apiKeyConfigured ? '✔ LLM configured' : '⫶☰ Configure LLM'}
        </button>
        {keyEntryOpen && (
          <div className="popup-backdrop" onMouseDown={event => {
            if (event.target === event.currentTarget) setKeyEntryOpen(false);
          }}>
            <form className="api-key-panel popup-window" role="dialog" aria-modal="true" aria-labelledby="api-key-title" onSubmit={event => { event.preventDefault(); onSaveApiKey(); }}>
              <div className="popup-window-header">
                <div>
                  <span className="console-kicker">Model settings</span>
                  <h2 id="api-key-title">Configure LLM</h2>
                </div>
                <button className="console-close" type="button" onClick={() => setKeyEntryOpen(false)} aria-label="Close LLM settings">×</button>
              </div>
              <label className="model-control">
                <span>Google model</span>
                <select value={model} onChange={event => onModelChange(event.target.value)} disabled={modelBusy || availableModels.length === 0} aria-label="Gemini model" title={modelError || model}>
                  {availableModels.map(availableModel => <option key={availableModel} value={availableModel}>{availableModel}</option>)}
                </select>
              </label>
              {modelError && <div className="model-error" role="status">{modelError}</div>}
              <div className="model-status">
                <span></span>
                <small></small>
              </div>
              <label htmlFor="google-api-key">Google API key</label>
              <div className="api-key-entry">
                <input id="google-api-key" type="password" autoComplete="off" spellCheck={false} value={apiKey} onChange={event => onApiKeyChange(event.target.value)} placeholder="Paste API key" />
                <button type="submit" disabled={!apiKey.trim() || apiKeyBusy}>{apiKeyBusy ? 'Saving' : 'Add'}</button>
              </div>
              <div className="api-key-status">
                <span>{apiKeyError || (apiKeyConfigured ? 'Held in memory' : 'Not configured')}</span>
                {apiKeyConfigured && <button type="button" onClick={onClearApiKey} disabled={apiKeyBusy}>Clear</button>}
              </div>
            </form>
          </div>
        )}
      </div>
      <label className={`auto-accept-label${autoAccept ? ' active' : ''}`}>
        Auto-accept
        <div className="toggle">
          <input type="checkbox" checked={autoAccept} onChange={event => onToggleAutoAccept(event.target.checked)} />
          <div className="toggle-track" />
          <div className="toggle-thumb" />
        </div>
      </label>
      {historyOpen && (
        <HistoryPanel
          entries={conversationHistory}
          historyEnabled={conversationHistoryEnabled}
          onToggleHistory={onToggleConversationHistory}
          onEditEntry={onEditHistoryEntry}
          onDeleteEntry={onDeleteHistoryEntry}
          onClear={onClearConversationHistory}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </div>
  );
};

export default Header;
