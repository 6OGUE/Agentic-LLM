import React from 'react';

interface HeaderProps {
  autoAccept: boolean;
  onToggleAutoAccept: (checked: boolean) => void;
  consoleOpen: boolean;
  onToggleConsole: () => void;
  customInstruction: string;
  onCustomInstructionChange: (value: string) => void;
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
  customInstruction,
  onCustomInstructionChange,
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

  const toggleConsole = () => {
    if (keyEntryOpen) setKeyEntryOpen(false);
    setCustomizeOpen(false);
    onToggleConsole();
  };
  const toggleApiKeyPanel = () => {
    const opening = !keyEntryOpen;
    setKeyEntryOpen(opening);
    if (opening) setCustomizeOpen(false);
    if (opening && consoleOpen) onToggleConsole();
  };
  const toggleCustomizePanel = () => {
    const opening = !customizeOpen;
    setCustomizeOpen(opening);
    if (opening && consoleOpen) onToggleConsole();
    if (opening && keyEntryOpen) setKeyEntryOpen(false);
  };

  return (
    <div className="header">
      
      <span className="header-title" style={{ fontSize: "1.2rem" }}>𖦹RBIT</span>
      <button className={`console-toggle${consoleOpen ? ' active' : ''}`} type="button" onClick={toggleConsole} aria-pressed={consoleOpen}>
        
        ⏳ Console
      </button>
      <div className="customize-control">
        <button className={`customize-toggle${customizeOpen ? ' active' : ''}`} type="button" onClick={toggleCustomizePanel} aria-expanded={customizeOpen}>
          <span style={{ fontSize: '16px' }}>✎</span> Customize
        </button>
        {customizeOpen && (
          <div className="popup-backdrop" onMouseDown={event => {
            if (event.target === event.currentTarget) setCustomizeOpen(false);
          }}>
            <section className="customize-panel popup-window" role="dialog" aria-modal="true" aria-labelledby="customize-title">
              <div className="popup-window-header">
                <div>
                  <span className="console-kicker">Personalize</span>
                  <h2 id="customize-title">Customize assistant</h2>
                </div>
                <button className="console-close" type="button" onClick={() => setCustomizeOpen(false)} aria-label="Close customization">×</button>
              </div>
              <label htmlFor="custom-system-instruction">Additional system prompt</label>
              <textarea
                id="custom-system-instruction"
                value={customInstruction}
                onChange={event => onCustomInstructionChange(event.target.value)}
                placeholder="Add instructions for the assistant..."
                rows={10}
              />
            </section>
          </div>
        )}
      </div>
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
    </div>
  );
};

export default Header;
