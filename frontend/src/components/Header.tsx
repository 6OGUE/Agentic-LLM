import React from 'react';

interface HeaderProps {
  autoAccept: boolean;
  onToggleAutoAccept: (checked: boolean) => void;
  consoleOpen: boolean;
  onToggleConsole: () => void;
}

const Header: React.FC<HeaderProps> = ({ autoAccept, onToggleAutoAccept, consoleOpen, onToggleConsole }) => {
  return (
    <div className="header">
      <div className="header-dot" />
      <span className="header-title">Agentic-Chat</span>
      <button className={`console-toggle${consoleOpen ? ' active' : ''}`} type="button" onClick={onToggleConsole} aria-pressed={consoleOpen}>
        <span className="console-icon">&gt;_</span>
        Console
      </button>
      <label className={`auto-accept-label${autoAccept ? ' active' : ''}`}>
        Auto-accept
        <div className="toggle">
          <input
            type="checkbox"
            checked={autoAccept}
            onChange={e => onToggleAutoAccept(e.target.checked)}
          />
          <div className="toggle-track" />
          <div className="toggle-thumb" />
        </div>
      </label>
    </div>
  );
};

export default Header;