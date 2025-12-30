import React, { useState } from 'react';

export const SendButtonTest = () => {
  const [message, setMessage] = useState('');
  const [disabled, setDisabled] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const canSend = (message.trim().length > 0) && !disabled;

  const addLog = (log: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${log}`]);
  };

  const handleSend = () => {
    if (!canSend) {
      addLog('❌ Send blocked - canSend is false');
      return;
    }
    
    addLog(`✅ Message sent: "${message}"`);
    setMessage('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setMessage(newValue);
    addLog(`📝 Input changed: "${newValue}" (canSend: ${newValue.trim().length > 0 && !disabled})`);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Send Button Test</h2>
      
      <div className="mb-4">
        <label className="flex items-center space-x-2 mb-2">
          <input
            type="checkbox"
            checked={disabled}
            onChange={(e) => {
              setDisabled(e.target.checked);
              addLog(`🔧 Disabled state: ${e.target.checked}`);
            }}
          />
          <span>Disabled</span>
        </label>
      </div>

      <div className="flex items-center space-x-3 mb-4 p-3 border rounded-lg">
        <input
          type="text"
          value={message}
          onChange={handleInputChange}
          placeholder="Type a message..."
          className="flex-1 px-3 py-2 border rounded-lg"
        />
        
        <button
          onClick={handleSend}
          disabled={!canSend}
          className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all ${
            canSend
              ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg transform hover:scale-105'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50'
          }`}
          title="Send message"
        >
          <div className="relative">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            {canSend && (
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            )}
          </div>
        </button>
      </div>

      <div className="mb-4">
        <p className="text-sm">
          <strong>State:</strong> message="{message}", disabled={disabled.toString()}, canSend={canSend.toString()}
        </p>
      </div>

      <div className="bg-gray-100 p-4 rounded-lg max-h-60 overflow-y-auto">
        <h3 className="font-semibold mb-2">Debug Logs:</h3>
        {logs.length === 0 ? (
          <p className="text-gray-500">No logs yet...</p>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="text-sm font-mono mb-1">
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  );
};