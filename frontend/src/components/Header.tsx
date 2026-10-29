import React from 'react';

interface HeaderProps {
  autoAccept: boolean;
  onToggleAutoAccept: (checked: boolean) => void;
  consoleOpen: boolean;
  onToggleConsole: () => void;
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
  consoleOpen,
  onToggleConsole,
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
  const toggleConsole = () => {
    if (keyEntryOpen) setKeyEntryOpen(false);
    onToggleConsole();
  };
  const toggleApiKeyPanel = () => {
    const opening = !keyEntryOpen;
    setKeyEntryOpen(opening);
    if (opening && consoleOpen) onToggleConsole();
  };

  return (
    <div className="header">
      <div>𖦹</div>
      <span className="header-title">Agentic-Chat</span>
      <button className={`console-toggle${consoleOpen ? ' active' : ''}`} type="button" onClick={toggleConsole} aria-pressed={consoleOpen}>
        <span className="console-icon">&gt;_</span>
        Console
      </button>
      <div className="api-key-control">
        <button className={`api-key-toggle${apiKeyConfigured ? ' configured' : ''}`} type="button" onClick={toggleApiKeyPanel} aria-expanded={keyEntryOpen}>
          {apiKeyConfigured ? 'Gemini configured' : 'Configure LLM'}
        </button>
        {keyEntryOpen && (
          <form className="api-key-panel" onSubmit={event => { event.preventDefault(); onSaveApiKey(); }}>
            <label className="model-control">
              <span>Gemini model</span>
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
              <span>{apiKeyError || (apiKeyConfigured ? 'Held in backend memory' : 'Not configured')}</span>
              {apiKeyConfigured && <button type="button" onClick={onClearApiKey} disabled={apiKeyBusy}>Clear</button>}
            </div>
          </form>
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
    </div>
  );
};

export default Header;
