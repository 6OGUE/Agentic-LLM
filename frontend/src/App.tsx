import React, { useState } from 'react';
import Header from './components/Header';
import MessagesArea from './components/MessagesArea';
import InputBox from './components/InputBox';
import { useChat } from './hooks/useChat';
import './App.css';

const App: React.FC = () => {
  const [input, setInput] = useState('');
  const [autoAccept, setAutoAccept] = useState(false);
  const { messages, loading, handleSend, handleConfirm } = useChat(autoAccept);

  const onSend = () => {
    if (!input.trim()) return;
    handleSend(input);
    setInput('');
  };

  return (
    <div className="app-shell">
      <Header autoAccept={autoAccept} onToggleAutoAccept={setAutoAccept} />
      <MessagesArea messages={messages} loading={loading} onConfirm={handleConfirm} />
      <InputBox input={input} onInputChange={setInput} onSend={onSend} loading={loading} />
    </div>
  );
};

export default App;