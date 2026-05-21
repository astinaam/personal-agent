import { useState, useEffect } from 'react'
import { useUI } from '../hooks/useUI.jsx'
import { api } from '../api'
import { useAuth } from '../hooks/useAuth.jsx'
import { X, Save, Key, MessageSquare, Bot } from 'lucide-react'

export default function SettingsPanel({ models, selectedModel, onModelChange }) {
  const { closePanel } = useUI()
  const { user } = useAuth()
  const [systemPrompt, setSystemPrompt] = useState('')
  const [apiKeys, setApiKeys] = useState({ openai: '', anthropic: '', deepseek: '' })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.config.getSystemPrompt().then(res => res.prompt && setSystemPrompt(res.prompt))
    if (user) {
      setApiKeys({
        openai: user.openai_api_key || '',
        anthropic: user.anthropic_api_key || '',
        deepseek: user.deepseek_api_key || ''
      })
    }
  }, [user])

  const handleSavePrompt = async () => {
    await api.config.setSystemPrompt(systemPrompt)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleSaveKeys = async () => {
    await api.auth.settings({
      openai_api_key: apiKeys.openai || undefined,
      anthropic_api_key: apiKeys.anthropic || undefined,
      deepseek_api_key: apiKeys.deepseek || undefined,
      default_model: selectedModel
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="w-80 shrink-0 border-l border-border bg-surface flex flex-col animate-fade-in">
      <div className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0">
        <h3 className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
          <Bot size={16} className="text-emerald-500" /> Settings
        </h3>
        <button onClick={closePanel} className="w-7 h-7 rounded-lg hover:bg-surface-raised text-neutral-500 flex items-center justify-center">
          <X size={15} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-6">
        <div>
          <label className="text-xs font-medium text-neutral-400 mb-2 block flex items-center gap-1.5">
            <MessageSquare size={12} /> Default Model
          </label>
          <select
            value={selectedModel}
            onChange={e => onModelChange(e.target.value)}
            className="w-full bg-surface-raised border border-border rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:ring-1 focus:ring-brand"
          >
            {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-neutral-400 mb-2 block flex items-center gap-1.5">
            <Key size={12} /> API Keys
          </label>
          <div className="space-y-2">
            <div>
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider">OpenAI</span>
              <input type="password" value={apiKeys.openai} onChange={e => setApiKeys(p => ({ ...p, openai: e.target.value }))} placeholder="sk-..." className="w-full bg-surface-raised border border-border rounded-lg px-3 py-2 text-sm text-neutral-300 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-brand mt-1" />
            </div>
            <div>
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Anthropic</span>
              <input type="password" value={apiKeys.anthropic} onChange={e => setApiKeys(p => ({ ...p, anthropic: e.target.value }))} placeholder="sk-ant-..." className="w-full bg-surface-raised border border-border rounded-lg px-3 py-2 text-sm text-neutral-300 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-brand mt-1" />
            </div>
            <div>
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider">DeepSeek</span>
              <input type="password" value={apiKeys.deepseek} onChange={e => setApiKeys(p => ({ ...p, deepseek: e.target.value }))} placeholder="sk-..." className="w-full bg-surface-raised border border-border rounded-lg px-3 py-2 text-sm text-neutral-300 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-brand mt-1" />
            </div>
          </div>
          <button onClick={handleSaveKeys} className="w-full h-8 mt-3 bg-brand/10 text-brand hover:bg-brand/20 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5">
            <Save size={12} /> {saved ? 'Saved!' : 'Save Keys'}
          </button>
        </div>

        <div>
          <label className="text-xs font-medium text-neutral-400 mb-2 block">System Prompt (Caveman Style)</label>
          <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} className="w-full bg-surface-raised border border-border rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:ring-1 focus:ring-brand resize-none h-36 font-mono text-xs" placeholder="You are Grok, a personal AI agent. Speak in caveman style..." />
          <p className="text-[10px] text-neutral-600 mt-1">This controls how Grok talks. Keep caveman vibe.</p>
          <button onClick={handleSavePrompt} className="w-full h-8 mt-2 bg-brand/10 text-brand hover:bg-brand/20 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5">
            <Save size={12} /> {saved ? 'Saved!' : 'Save Prompt'}
          </button>
        </div>
      </div>
    </div>
  )
}
