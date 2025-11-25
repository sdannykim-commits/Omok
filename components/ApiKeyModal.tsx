import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { saveApiKey, getApiKey } from '../utils/secureStorage';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave }) => {
  const [inputValue, setInputValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      const stored = getApiKey();
      if (stored) setInputValue(stored);
      setStatus('idle');
      setStatusMsg('');
    }
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Strictly replace any character that is not standard ASCII (0-127)
    // This prevents "String contains non ISO-8859-1 code point" errors in headers
    const sanitized = e.target.value.replace(/[^\x00-\x7F]/g, "");
    setInputValue(sanitized);
    setStatus('idle');
  };

  const testConnection = async () => {
    const cleanKey = inputValue.trim();
    if (!cleanKey) {
      setStatus('error');
      setStatusMsg('Please enter an API Key.');
      return;
    }

    setStatus('testing');
    setStatusMsg('Testing connection to Gemini...');

    try {
      const ai = new GoogleGenAI({ apiKey: cleanKey });
      // Lightweight test call
      await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'Test connection',
      });
      
      setStatus('success');
      setStatusMsg('Connection successful! Key is valid.');
    } catch (error: any) {
      console.error(error);
      setStatus('error');
      setStatusMsg('Connection failed. Please check your key.');
    }
  };

  const handleSave = () => {
    const cleanKey = inputValue.trim();
    if (!cleanKey) return;
    
    // Save to local storage
    saveApiKey(cleanKey);
    // Update App state
    onSave(cleanKey);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-pop-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-slate-800 p-4 flex justify-between items-center">
          <h2 className="text-white text-lg font-bold flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            API Key Configuration
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 18 12"/></svg>
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Google Gemini API Key</label>
            <input 
              type="password" 
              value={inputValue}
              onChange={handleInputChange}
              placeholder="AIzaSy..."
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono text-sm"
            />
            <p className="text-xs text-slate-500">
              Your key is encrypted and saved to your local browser storage.
            </p>
          </div>

          {status !== 'idle' && (
            <div className={`text-sm p-3 rounded-md flex items-center gap-2 ${
              status === 'testing' ? 'bg-blue-50 text-blue-700' :
              status === 'success' ? 'bg-green-50 text-green-700' :
              'bg-red-50 text-red-700'
            }`}>
              {status === 'testing' && <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
              {status === 'success' && <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>}
              {status === 'error' && <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>}
              {statusMsg}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button 
              onClick={testConnection}
              disabled={status === 'testing' || !inputValue}
              className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Test Connection
            </button>
            <button 
              onClick={handleSave}
              disabled={status === 'testing' || !inputValue}
              className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
            >
              Save & Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};