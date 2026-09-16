import React, { useRef, useEffect } from 'react';

interface InputBoxProps {
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  iteration: number;
  loading: boolean;
}

const InputBox: React.FC<InputBoxProps> = ({ input, onInputChange, onSend, onStop, iteration, loading }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="input-wrapper">
      <div className="input-box">
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={e => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask the agent to do something…"
        />
        {loading && <span className="iteration-label"> {iteration}</span>}
        <button className="send-btn" onClick={loading ? onStop : onSend} disabled={!loading && !input.trim()} aria-label={loading ? 'Stop agent' : 'Send message'}>
          {loading ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="5" y="5" width="14" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>
      <div className="hint">Shift + Enter for new line</div>
    </div>
  );
};

export default InputBox;