import React, { useState } from 'react';
import Header from './components/Header';
import MessagesArea from './components/MessagesArea';
import InputBox from './components/InputBox';
import InternalConsole from './components/InternalConsole';
import { useChat } from './hooks/useChat';
import './App.css';

const App: React.FC = () => {
  const [input, setInput] = useState('');
  const [autoAccept, setAutoAccept] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const { messages, loading, activeTool, iteration, internalEvents, handleSend, handleStop, handleConfirm } = useChat(autoAccept);

  const onSend = () => {
    if (!input.trim()) return;
    handleSend(input);
    setInput('');
  };

  return (
    <div className="app-shell">
      <Header autoAccept={autoAccept} onToggleAutoAccept={setAutoAccept} consoleOpen={consoleOpen} onToggleConsole={() => setConsoleOpen(open => !open)} />
      {consoleOpen && <InternalConsole events={internalEvents} onClose={() => setConsoleOpen(false)} />}
      <MessagesArea messages={messages} loading={loading} activeTool={activeTool} onConfirm={handleConfirm} />
      <InputBox input={input} onInputChange={setInput} onSend={onSend} onStop={handleStop} iteration={iteration} loading={loading} />
    </div>
  );
};

export default App;