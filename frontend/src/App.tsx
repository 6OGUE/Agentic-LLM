import React, { useEffect, useState } from 'react';
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
  const [apiKey, setApiKey] = useState('');
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [apiKeyError, setApiKeyError] = useState('');
  const [apiKeyBusy, setApiKeyBusy] = useState(false);
  const [model, setModel] = useState('gemma-4-26b-a4b-it');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelError, setModelError] = useState('');
  const [modelBusy, setModelBusy] = useState(false);
  const { messages, loading, activeTool, iteration, internalEvents, handleSend, handleStop, handleConfirm } = useChat(autoAccept);

  useEffect(() => {
    fetch('http://localhost:8000/api-key/status')
      .then(response => response.json())
      .then(data => setApiKeyConfigured(data.configured))
      .catch(() => setApiKeyError('Backend is unavailable.'));
    fetch('http://localhost:8000/model/status')
      .then(async response => {
        if (!response.ok) throw new Error('Could not load model settings.');
        return response.json();
      })
      .then(data => {
        setModel(data.model);
        setAvailableModels(data.available);
      })
      .catch(error => setModelError(error instanceof Error ? error.message : 'Could not load model settings.'));
  }, []);

  const onSaveApiKey = async () => {
    if (!apiKey.trim() || apiKeyBusy) return;
    setApiKeyBusy(true);
    setApiKeyError('');
    try {
      const response = await fetch('http://localhost:8000/api-key', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey }),
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error ?? 'Could not save API key.');
      setApiKeyConfigured(data.configured);
      setApiKey('');
    } catch (error) {
      setApiKeyError(error instanceof Error ? error.message : 'Could not save API key.');
    } finally {
      setApiKeyBusy(false);
    }
  };

  const onClearApiKey = async () => {
    setApiKeyBusy(true);
    setApiKeyError('');
    try {
      const response = await fetch('http://localhost:8000/api-key', { method: 'DELETE' });
      if (!response.ok) throw new Error('Could not clear API key.');
      const data = await response.json();
      setApiKeyConfigured(data.configured);
    } catch (error) {
      setApiKeyError(error instanceof Error ? error.message : 'Could not clear API key.');
    } finally {
      setApiKeyBusy(false);
    }
  };

  const onModelChange = async (nextModel: string) => {
    if (modelBusy) return;
    const previousModel = model;
    setModel(nextModel);
    setModelBusy(true);
    setModelError('');
    try {
      const response = await fetch('http://localhost:8000/model', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: nextModel }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail ?? 'Could not update model.');
      setModel(data.model);
    } catch (error) {
      setModel(previousModel);
      setModelError(error instanceof Error ? error.message : 'Could not update model.');
    } finally {
      setModelBusy(false);
    }
  };

  const onSend = () => {
    if (!input.trim()) return;
    handleSend(input);
    setInput('');
  };

  return (
    <div className="app-shell">
      <Header autoAccept={autoAccept} onToggleAutoAccept={setAutoAccept} consoleOpen={consoleOpen} onToggleConsole={() => setConsoleOpen(open => !open)} apiKey={apiKey} onApiKeyChange={setApiKey} apiKeyConfigured={apiKeyConfigured} apiKeyError={apiKeyError} apiKeyBusy={apiKeyBusy} onSaveApiKey={onSaveApiKey} onClearApiKey={onClearApiKey} model={model} availableModels={availableModels} modelError={modelError} modelBusy={modelBusy} onModelChange={onModelChange} />
      {consoleOpen && <InternalConsole events={internalEvents} onClose={() => setConsoleOpen(false)} />}
      <MessagesArea messages={messages} loading={loading} activeTool={activeTool} onConfirm={handleConfirm} />
      <InputBox input={input} onInputChange={setInput} onSend={onSend} onStop={handleStop} iteration={iteration} loading={loading} />
    </div>
  );
};

export default App;