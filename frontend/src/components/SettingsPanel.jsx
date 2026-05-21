import { useState, useEffect, useCallback } from 'react'
import { useUI } from '../hooks/useUI.jsx'
import { api } from '../api'
import { useAuth } from '../hooks/useAuth.jsx'
import { X, Save, Key, MessageSquare, Bot, Plus, Trash2, Eye, EyeOff, RefreshCw, CheckCircle, AlertCircle, ChevronDown } from 'lucide-react'

export default function SettingsPanel() {
  const { closePanel } = useUI()
  const { user } = useAuth()
  const [providers, setProviders] = useState([])
  const [modelsByProvider, setModelsByProvider] = useState({})
  const [systemPrompt, setSystemPrompt] = useState('')
  const [saved, setSaved] = useState(false)
  const [expandedProvider, setExpandedProvider] = useState(null)
  const [addingProvider, setAddingProvider] = useState(false)
  const [newProvider, setNewProvider] = useState({ name: '', slug: '', base_url: '', api_key: '' })
  const [showKey, setShowKey] = useState({})
  const [testingProvider, setTestingProvider] = useState(null)
  const [testResult, setTestResult] = useState(null)

  const load = useCallback(async () => {
    const res = await api.models.list()
    setModelsByProvider(Object.fromEntries(res.items.map(i => [i.provider.id, i])))
    const p = await api.providers.list()
    setProviders(p.items)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    api.config.getSystemPrompt().then(res => res.prompt && setSystemPrompt(res.prompt))
  }, [])

  const handleToggleProvider = async (id, active) => {
    await api.providers.update(id, { is_active: !active })
    load()
  }

  const handleUpdateKey = async (id, key) => {
    await api.providers.update(id, { api_key: key })
    load()
  }

  const handleDeleteProvider = async (id) => {
    await api.providers.delete(id)
    load()
  }

  const handleTestProvider = async (id) => {
    setTestingProvider(id)
    setTestResult(null)
    try {
      await api.providers.test(id)
      setTestResult({ id, ok: true })
    } catch (e) {
      setTestResult({ id, ok: false, msg: e.message })
    } finally {
      setTestingProvider(null)
    }
  }

  const handleAddProvider = async () => {
    if (!newProvider.name || !newProvider.slug) return
    await api.providers.create(newProvider)
    setAddingProvider(false)
    setNewProvider({ name: '', slug: '', base_url: '', api_key: '' })
    load()
  }

  const handleRefreshOpenRouter = async () => {
    await api.models.refreshOpenRouter()
    load()
  }

  const handleSavePrompt = async () => {
    await api.config.setSystemPrompt(systemPrompt)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const toggleShowKey = (id) => {
    setShowKey(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="w-full sm:w-80 shrink-0 border-l border-border bg-surface flex flex-col animate-fade-in absolute sm:relative right-0 top-0 h-full z-30 shadow-2xl sm:shadow-none">
      <div className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0">
        <h3 className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
          <Bot size={16} className="text-emerald-500" /> Settings
        </h3>
        <button onClick={closePanel} className="w-7 h-7 rounded-lg hover:bg-surface-raised text-neutral-500 flex items-center justify-center">
          <X size={15} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-6">

        {/* Providers */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-neutral-400 flex items-center gap-1.5">
              <Key size={12} /> Providers & Models
            </label>
            <button onClick={() => setAddingProvider(true)} className="text-brand hover:text-brand-hover text-xs flex items-center gap-1">
              <Plus size={12} /> Add
            </button>
          </div>

          {providers.map(p => {
            const isBuiltin = p.is_builtin
            const provModels = modelsByProvider[p.id]?.models || []
            return (
              <div key={p.id} className="mb-2 border border-border rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between px-3 py-2 bg-surface-raised cursor-pointer"
                  onClick={() => setExpandedProvider(expandedProvider === p.id ? null : p.id)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium text-neutral-300 truncate">{p.name}</span>
                    {isBuiltin && <span className="text-[9px] bg-brand/10 text-brand px-1 rounded">builtin</span>}
                    {p.slug === 'copilot' && <span className="text-[9px] bg-purple-500/10 text-purple-400 px-1 rounded">copilot</span>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleProvider(p.id, p.is_active) }}
                      className={`text-[10px] px-1.5 py-0.5 rounded ${p.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-neutral-700 text-neutral-500'}`}
                    >
                      {p.is_active ? 'ON' : 'OFF'}
                    </button>
                    <ChevronDown size={12} className={`text-neutral-500 transition-transform ${expandedProvider === p.id ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {expandedProvider === p.id && (
                  <div className="px-3 py-2 space-y-2 border-t border-border">
                    {/* API Key */}
                    <div>
                      <span className="text-[10px] text-neutral-500 uppercase tracking-wider">API Key</span>
                      <div className="flex gap-2 mt-1">
                        <input
                          type={showKey[p.id] ? 'text' : 'password'}
                          defaultValue={''}
                          onBlur={(e) => handleUpdateKey(p.id, e.target.value)}
                          placeholder={isBuiltin ? 'Add your key' : 'Required'}
                          className="flex-1 bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-brand"
                        />
                        <button onClick={() => toggleShowKey(p.id)} className="text-neutral-500 hover:text-neutral-300">
                          {showKey[p.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>

                    {/* Test */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTestProvider(p.id)}
                        disabled={testingProvider === p.id}
                        className="flex-1 h-7 bg-brand/10 text-brand hover:bg-brand/20 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1"
                      >
                        {testingProvider === p.id ? 'Testing...' : <><CheckCircle size={10} /> Test</>}
                      </button>
                      {!isBuiltin && (
                        <button onClick={() => handleDeleteProvider(p.id)} className="h-7 w-7 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-md flex items-center justify-center">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                    {testResult?.id === p.id && (
                      <div className={`text-[10px] flex items-center gap-1 ${testResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                        {testResult.ok ? <CheckCircle size={10} /> : <AlertCircle size={10} />}
                        {testResult.ok ? 'Connection OK' : testResult.msg}
                      </div>
                    )}

                    {/* Models list */}
                    <div>
                      <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Models ({provModels.length})</span>
                      <div className="mt-1 space-y-0.5 max-h-28 overflow-y-auto scrollbar-thin">
                        {provModels.map(m => (
                          <div key={m.id} className="flex items-center justify-between px-2 py-1 rounded text-xs text-neutral-300">
                            <span className="truncate">{m.display_name}</span>
                            {m.supports_vision && <span className="text-[9px] text-neutral-500">👁</span>}
                          </div>
                        ))}
                        {provModels.length === 0 && (
                          <p className="text-xs text-neutral-600 py-1">No models</p>
                        )}
                      </div>
                      {p.slug === 'openrouter' && (
                        <button onClick={handleRefreshOpenRouter} className="mt-1 w-full h-6 bg-surface-raised hover:bg-surface text-neutral-400 rounded text-[10px] flex items-center justify-center gap-1 transition-colors">
                          <RefreshCw size={10} /> Refresh from OpenRouter
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Add Provider Modal */}
        {addingProvider && (
          <div className="border border-border rounded-lg p-3 space-y-2 bg-surface-raised">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-300">New Provider</span>
              <button onClick={() => setAddingProvider(false)} className="text-neutral-500 hover:text-neutral-300"><X size={12} /></button>
            </div>
            <input placeholder="Name (e.g. My Ollama)" value={newProvider.name} onChange={e => setNewProvider(p => ({ ...p, name: e.target.value }))} className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 focus:outline-none focus:ring-1 focus:ring-brand" />
            <input placeholder="Slug (e.g. ollama)" value={newProvider.slug} onChange={e => setNewProvider(p => ({ ...p, slug: e.target.value }))} className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 focus:outline-none focus:ring-1 focus:ring-brand" />
            <input placeholder="Base URL (e.g. http://localhost:11434/v1)" value={newProvider.base_url} onChange={e => setNewProvider(p => ({ ...p, base_url: e.target.value }))} className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 focus:outline-none focus:ring-1 focus:ring-brand" />
            <input type="password" placeholder="API Key (optional)" value={newProvider.api_key} onChange={e => setNewProvider(p => ({ ...p, api_key: e.target.value }))} className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 focus:outline-none focus:ring-1 focus:ring-brand" />
            <button onClick={handleAddProvider} className="w-full h-7 bg-brand text-white rounded-md text-xs font-medium hover:bg-brand-hover transition-colors">
              Create Provider
            </button>
          </div>
        )}

        {/* System Prompt */}
        <div>
          <label className="text-xs font-medium text-neutral-400 mb-2 block">System Prompt</label>
          <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} className="w-full bg-surface-raised border border-border rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:ring-1 focus:ring-brand resize-none h-32 font-mono text-xs" placeholder="You are Grok, a personal AI agent..." />
          <button onClick={handleSavePrompt} className="w-full h-8 mt-2 bg-brand/10 text-brand hover:bg-brand/20 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5">
            <Save size={12} /> {saved ? 'Saved!' : 'Save Prompt'}
          </button>
        </div>
      </div>
    </div>
  )
}
