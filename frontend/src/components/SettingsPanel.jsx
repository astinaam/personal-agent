import { useState, useEffect, useCallback } from 'react'
import { useUI } from '../hooks/useUI.jsx'
import { api } from '../api'
import { useAuth } from '../hooks/useAuth.jsx'
import {
  X, Save, Key, Bot, Plus, Trash2, Eye, EyeOff, RefreshCw, CheckCircle, AlertCircle,
  ChevronDown, MessageSquare, Wand2, Zap
} from 'lucide-react'

export default function SettingsPanel() {
  const { closePanel } = useUI()
  const { user } = useAuth()
  const [tab, setTab] = useState('providers')

  // Providers state
  const [providers, setProviders] = useState([])
  const [modelsByProvider, setModelsByProvider] = useState({})
  const [expandedProvider, setExpandedProvider] = useState(null)
  const [addingProvider, setAddingProvider] = useState(false)
  const [newProvider, setNewProvider] = useState({ name: '', slug: '', base_url: '', api_key: '' })
  const [showKey, setShowKey] = useState({})
  const [testingProvider, setTestingProvider] = useState(null)
  const [testResult, setTestResult] = useState(null)

  // Skills state
  const [skills, setSkills] = useState([])
  const [addingSkill, setAddingSkill] = useState(false)
  const [newSkill, setNewSkill] = useState({ name: '', description: '', content: '' })
  const [editingSkill, setEditingSkill] = useState(null)

  // Prompt designer state
  const [design, setDesign] = useState({ base_prompt: '', include_memories: true, include_project_memories: true, skill_ids: [] })
  const [preview, setPreview] = useState('')
  const [saved, setSaved] = useState(false)

  const loadProviders = useCallback(async () => {
    const res = await api.models.list()
    setModelsByProvider(Object.fromEntries(res.items.map(i => [i.provider.id, i])))
    const p = await api.providers.list()
    setProviders(p.items)
  }, [])

  const loadSkills = useCallback(async () => {
    const res = await api.skills.list()
    setSkills(res.items)
  }, [])

  const loadDesign = useCallback(async () => {
    const res = await api.config.getSystemPrompt()
    if (res.design) {
      setDesign(res.design)
    } else if (res.prompt) {
      setDesign(prev => ({ ...prev, base_prompt: res.prompt }))
    }
  }, [])

  useEffect(() => {
    loadProviders()
    loadSkills()
    loadDesign()
  }, [loadProviders, loadSkills, loadDesign])

  // Build preview
  useEffect(() => {
    const parts = [design.base_prompt]
    const activeSkills = skills.filter(s => design.skill_ids.includes(s.id) && s.is_active)
    if (activeSkills.length > 0) {
      parts.push('SKILLS:\n' + activeSkills.map(s => `- ${s.name}: ${s.content}`).join('\n'))
    }
    if (design.include_memories) {
      parts.push('MEMORIES:\n[Relevant memories will be included here]')
    }
    setPreview(parts.filter(Boolean).join('\n\n'))
  }, [design, skills])

  // Provider handlers
  const handleToggleProvider = async (id, active) => {
    await api.providers.update(id, { is_active: !active })
    loadProviders()
  }

  const handleUpdateKey = async (id, key) => {
    if (!key) return
    await api.providers.update(id, { api_key: key })
    loadProviders()
  }

  const handleDeleteProvider = async (id) => {
    await api.providers.delete(id)
    loadProviders()
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
    loadProviders()
  }

  const handleRefreshOpenRouter = async () => {
    await api.models.refreshOpenRouter()
    loadProviders()
  }

  // Skill handlers
  const handleAddSkill = async () => {
    if (!newSkill.name || !newSkill.content) return
    await api.skills.create(newSkill)
    setAddingSkill(false)
    setNewSkill({ name: '', description: '', content: '' })
    loadSkills()
  }

  const handleUpdateSkill = async (id) => {
    const s = skills.find(x => x.id === id)
    if (!s) return
    await api.skills.update(id, { name: s.name, description: s.description, content: s.content, is_active: s.is_active })
    setEditingSkill(null)
    loadSkills()
  }

  const handleDeleteSkill = async (id) => {
    await api.skills.delete(id)
    loadSkills()
  }

  const toggleSkillInDesign = (id) => {
    setDesign(prev => ({
      ...prev,
      skill_ids: prev.skill_ids.includes(id)
        ? prev.skill_ids.filter(x => x !== id)
        : [...prev.skill_ids, id]
    }))
  }

  // Designer handlers
  const handleSaveDesign = async () => {
    await api.config.setSystemPrompt({ design })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const toggleShowKey = (id) => {
    setShowKey(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const tabs = [
    { key: 'providers', label: 'Providers', icon: Key },
    { key: 'skills', label: 'Skills', icon: Zap },
    { key: 'designer', label: 'Prompt', icon: Wand2 },
  ]

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

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 h-9 text-[10px] font-medium flex items-center justify-center gap-1 transition-colors ${
                tab === t.key ? 'bg-surface-raised text-brand' : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <Icon size={12} /> {t.label}
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">

        {/* ====== PROVIDERS TAB ====== */}
        {tab === 'providers' && (
          <>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-neutral-400">Providers & Models</label>
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

                      <div>
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Models ({provModels.length})</span>
                        <div className="mt-1 space-y-0.5 max-h-28 overflow-y-auto scrollbar-thin">
                          {provModels.map(m => (
                            <div key={m.id} className="flex items-center justify-between px-2 py-1 rounded text-xs text-neutral-300">
                              <span className="truncate">{m.display_name}</span>
                              {m.supports_vision && <span className="text-[9px] text-neutral-500">👁</span>}
                            </div>
                          ))}
                          {provModels.length === 0 && <p className="text-xs text-neutral-600 py-1">No models</p>}
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

            {addingProvider && (
              <div className="border border-border rounded-lg p-3 space-y-2 bg-surface-raised">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-300">New Provider</span>
                  <button onClick={() => setAddingProvider(false)} className="text-neutral-500 hover:text-neutral-300"><X size={12} /></button>
                </div>
                <input placeholder="Name (e.g. My Ollama)" value={newProvider.name} onChange={e => setNewProvider(p => ({ ...p, name: e.target.value }))} className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 focus:outline-none focus:ring-1 focus:ring-brand" />
                <input placeholder="Slug (e.g. ollama)" value={newProvider.slug} onChange={e => setNewProvider(p => ({ ...p, slug: e.target.value }))} className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 focus:outline-none focus:ring-1 focus:ring-brand" />
                <input placeholder="Base URL" value={newProvider.base_url} onChange={e => setNewProvider(p => ({ ...p, base_url: e.target.value }))} className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 focus:outline-none focus:ring-1 focus:ring-brand" />
                <input type="password" placeholder="API Key (optional)" value={newProvider.api_key} onChange={e => setNewProvider(p => ({ ...p, api_key: e.target.value }))} className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 focus:outline-none focus:ring-1 focus:ring-brand" />
                <button onClick={handleAddProvider} className="w-full h-7 bg-brand text-white rounded-md text-xs font-medium hover:bg-brand-hover transition-colors">
                  Create Provider
                </button>
              </div>
            )}
          </>
        )}

        {/* ====== SKILLS TAB ====== */}
        {tab === 'skills' && (
          <>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-neutral-400">Skills (mini prompts)</label>
              <button onClick={() => setAddingSkill(true)} className="text-brand hover:text-brand-hover text-xs flex items-center gap-1">
                <Plus size={12} /> Add
              </button>
            </div>

            {addingSkill && (
              <div className="border border-border rounded-lg p-3 space-y-2 bg-surface-raised mb-2">
                <input placeholder="Skill name" value={newSkill.name} onChange={e => setNewSkill(p => ({ ...p, name: e.target.value }))} className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 focus:outline-none focus:ring-1 focus:ring-brand" />
                <input placeholder="Description (optional)" value={newSkill.description} onChange={e => setNewSkill(p => ({ ...p, description: e.target.value }))} className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 focus:outline-none focus:ring-1 focus:ring-brand" />
                <textarea placeholder="Content — what this skill does, injected into system prompt" value={newSkill.content} onChange={e => setNewSkill(p => ({ ...p, content: e.target.value }))} className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-brand resize-none h-20" />
                <div className="flex gap-2">
                  <button onClick={handleAddSkill} className="flex-1 h-7 bg-brand text-white rounded-md text-xs font-medium hover:bg-brand-hover">Save</button>
                  <button onClick={() => setAddingSkill(false)} className="h-7 px-3 bg-surface-raised text-neutral-400 rounded-md text-xs">Cancel</button>
                </div>
              </div>
            )}

            {skills.map(s => (
              <div key={s.id} className="border border-border rounded-lg p-3 mb-2 bg-surface-raised">
                {editingSkill === s.id ? (
                  <>
                    <input value={s.name} onChange={e => setSkills(prev => prev.map(x => x.id === s.id ? { ...x, name: e.target.value } : x))} className="w-full bg-surface border border-border rounded-lg px-2.5 py-1 text-xs text-neutral-300 focus:outline-none focus:ring-1 focus:ring-brand mb-1" />
                    <input value={s.description || ''} onChange={e => setSkills(prev => prev.map(x => x.id === s.id ? { ...x, description: e.target.value } : x))} className="w-full bg-surface border border-border rounded-lg px-2.5 py-1 text-xs text-neutral-300 focus:outline-none focus:ring-1 focus:ring-brand mb-1" />
                    <textarea value={s.content} onChange={e => setSkills(prev => prev.map(x => x.id === s.id ? { ...x, content: e.target.value } : x))} className="w-full bg-surface border border-border rounded-lg px-2.5 py-1 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-brand resize-none h-16 mb-1" />
                    <div className="flex gap-2">
                      <button onClick={() => handleUpdateSkill(s.id)} className="flex-1 h-6 bg-brand text-white rounded text-xs">Save</button>
                      <button onClick={() => setEditingSkill(null)} className="h-6 px-2 bg-surface-raised text-neutral-400 rounded text-xs">Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-neutral-300">{s.name}</span>
                      <div className="flex items-center gap-1">
                        <span className={`text-[9px] px-1 rounded ${s.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-neutral-700 text-neutral-500'}`}>{s.is_active ? 'ON' : 'OFF'}</span>
                        <button onClick={() => setEditingSkill(s.id)} className="text-neutral-500 hover:text-neutral-300"><Zap size={10} /></button>
                        <button onClick={() => handleDeleteSkill(s.id)} className="text-red-400 hover:text-red-300"><Trash2 size={10} /></button>
                      </div>
                    </div>
                    {s.description && <p className="text-[10px] text-neutral-500 mb-1">{s.description}</p>}
                    <p className="text-[10px] text-neutral-400 line-clamp-2">{s.content}</p>
                  </>
                )}
              </div>
            ))}

            {skills.length === 0 && <p className="text-xs text-neutral-600 text-center py-4">No skills yet</p>}
          </>
        )}

        {/* ====== PROMPT DESIGNER TAB ====== */}
        {tab === 'designer' && (
          <>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-neutral-400 mb-1 block">Base System Prompt</label>
                <textarea
                  value={design.base_prompt}
                  onChange={e => setDesign(prev => ({ ...prev, base_prompt: e.target.value }))}
                  className="w-full bg-surface-raised border border-border rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-brand resize-none h-24 font-mono"
                  placeholder="You are Grok, a personal AI agent..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-400">Context Blocks</label>
                <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                  <input type="checkbox" checked={design.include_memories} onChange={e => setDesign(prev => ({ ...prev, include_memories: e.target.checked }))} className="rounded border-border" />
                  Include global memories
                </label>
                <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                  <input type="checkbox" checked={design.include_project_memories} onChange={e => setDesign(prev => ({ ...prev, include_project_memories: e.target.checked }))} className="rounded border-border" />
                  Include project memories (when in project)
                </label>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-400 mb-1 block">Active Skills</label>
                {skills.length === 0 && <p className="text-[10px] text-neutral-600">No skills yet — create in Skills tab</p>}
                <div className="space-y-1">
                  {skills.filter(s => s.is_active).map(s => (
                    <label key={s.id} className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={design.skill_ids.includes(s.id)}
                        onChange={() => toggleSkillInDesign(s.id)}
                        className="rounded border-border"
                      />
                      <span className="truncate">{s.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSaveDesign}
                className="w-full h-8 bg-brand/10 text-brand hover:bg-brand/20 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
              >
                <Save size={12} /> {saved ? 'Saved!' : 'Save Design'}
              </button>

              <div>
                <label className="text-xs font-medium text-neutral-400 mb-1 block">Preview</label>
                <div className="bg-surface-raised border border-border rounded-lg p-3 text-[10px] text-neutral-400 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto scrollbar-thin">
                  {preview || 'No content yet'}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
