import { useState, useEffect } from 'react'
import { useUI } from '../hooks/useUI.jsx'
import { api } from '../api'
import { X, Plus, Trash2, Edit3, Save, Star, Globe, Folder } from 'lucide-react'

export default function MemoryPanel() {
  const { closePanel, selectedProject } = useUI()
  const [memories, setMemories] = useState([])
  const [filter, setFilter] = useState('current') // 'all', 'global', 'current'
  const [editing, setEditing] = useState(null)
  const [newContent, setNewContent] = useState('')
  const [newCategory, setNewCategory] = useState('general')
  const [newImportance, setNewImportance] = useState(1)
  const [showAdd, setShowAdd] = useState(false)

  const load = () => {
    let promise
    if (filter === 'global') {
      promise = api.memories.list(null)
    } else if (filter === 'current' && selectedProject) {
      promise = api.memories.list(selectedProject.id)
    } else {
      // 'all' not directly supported by backend; load both and merge
      Promise.all([
        api.memories.list(null),
        selectedProject ? api.memories.list(selectedProject.id) : Promise.resolve([])
      ]).then(([global, proj]) => {
        const merged = [...global, ...proj]
        // dedupe by id
        const seen = new Set()
        setMemories(merged.filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true }))
      })
      return
    }
    promise.then(res => setMemories(res))
  }

  useEffect(() => { load() }, [filter, selectedProject])

  const handleAdd = async () => {
    if (!newContent.trim()) return
    const project_id = filter === 'current' ? selectedProject?.id : null
    await api.memories.create({ content: newContent, category: newCategory, importance: newImportance, project_id })
    setNewContent('')
    setNewCategory('general')
    setNewImportance(1)
    setShowAdd(false)
    load()
  }

  const handleUpdate = async (id) => {
    const mem = memories.find(m => m.id === id)
    if (!mem) return
    await api.memories.update(id, { content: mem.content, category: mem.category, importance: mem.importance, project_id: mem.project_id })
    setEditing(null)
    load()
  }

  const handleDelete = async (id) => {
    await api.memories.delete(id)
    load()
  }

  const updateField = (id, field, value) => {
    setMemories(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m))
  }

  const filterTabs = [
    { key: 'all', label: 'All' },
    { key: 'global', label: 'Global' },
    { key: 'current', label: selectedProject?.name || 'Project' },
  ]

  return (
    <div className="w-full sm:w-80 shrink-0 border-l border-border bg-surface flex flex-col animate-fade-in absolute sm:relative right-0 top-0 h-full z-30 shadow-2xl sm:shadow-none">
      <div className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0">
        <h3 className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
          <Star size={16} className="text-amber-500" /> Memories
        </h3>
        <button onClick={closePanel} className="w-7 h-7 rounded-lg hover:bg-surface-raised text-neutral-500 flex items-center justify-center">
          <X size={15} />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex border-b border-border">
        {filterTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex-1 h-8 text-[10px] font-medium transition-colors ${
              filter === tab.key ? 'bg-surface-raised text-brand' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
        <button onClick={() => setShowAdd(!showAdd)} className="w-full h-8 bg-brand/10 text-brand hover:bg-brand/20 rounded-lg text-xs font-medium transition-colors mb-3 flex items-center justify-center gap-1.5">
          <Plus size={14} /> Add Memory
        </button>

        {showAdd && (
          <div className="bg-surface-raised border border-border rounded-xl p-3 mb-3 space-y-2">
            <textarea
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              placeholder="What to remember..."
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-brand resize-none h-20"
            />
            <div className="flex gap-2">
              <input value={newCategory} onChange={e => setNewCategory(e.target.value)} className="flex-1 bg-surface border border-border rounded-lg px-3 py-1.5 text-xs text-neutral-300 focus:outline-none focus:ring-1 focus:ring-brand" placeholder="Category" />
              <input type="number" min="0" max="10" step="0.1" value={newImportance} onChange={e => setNewImportance(parseFloat(e.target.value))} className="w-16 bg-surface border border-border rounded-lg px-2 py-1.5 text-xs text-neutral-300 focus:outline-none focus:ring-1 focus:ring-brand" />
            </div>
            <button onClick={handleAdd} className="w-full h-7 bg-brand text-white rounded-lg text-xs font-medium hover:bg-brand-hover">
              Save {filter === 'current' && selectedProject ? `to ${selectedProject.name}` : ''}
            </button>
          </div>
        )}

        {memories.map(mem => (
          <div key={mem.id} className="bg-surface-raised border border-border rounded-xl p-3 mb-2 group">
            {editing === mem.id ? (
              <>
                <textarea
                  value={mem.content}
                  onChange={e => updateField(mem.id, 'content', e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-brand resize-none h-20 mb-2"
                />
                <div className="flex gap-2 mb-2">
                  <input value={mem.category} onChange={e => updateField(mem.id, 'category', e.target.value)} className="flex-1 bg-surface border border-border rounded-lg px-2 py-1 text-xs text-neutral-300 focus:outline-none focus:ring-1 focus:ring-brand" />
                  <input type="number" value={mem.importance} onChange={e => updateField(mem.id, 'importance', parseFloat(e.target.value))} className="w-14 bg-surface border border-border rounded-lg px-2 py-1 text-xs text-neutral-300 focus:outline-none focus:ring-1 focus:ring-brand" />
                </div>
                <button onClick={() => handleUpdate(mem.id)} className="w-full h-7 bg-brand text-white rounded-lg text-xs font-medium hover:bg-brand-hover flex items-center justify-center gap-1">
                  <Save size={12} /> Save
                </button>
              </>
            ) : (
              <>
                <p className="text-xs text-neutral-200 mb-2 leading-relaxed">{mem.content}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-surface px-1.5 py-0.5 rounded text-neutral-500">{mem.category}</span>
                    <span className="text-[10px] text-neutral-600">{mem.importance.toFixed(1)}</span>
                    {mem.project_id ? (
                      <span className="text-[10px] text-brand flex items-center gap-0.5"><Folder size={8} /> Project</span>
                    ) : (
                      <span className="text-[10px] text-neutral-500 flex items-center gap-0.5"><Globe size={8} /> Global</span>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setEditing(mem.id)} className="w-5 h-5 rounded hover:bg-surface-elevated text-neutral-500 flex items-center justify-center">
                      <Edit3 size={10} />
                    </button>
                    <button onClick={() => handleDelete(mem.id)} className="w-5 h-5 rounded hover:bg-red-500/10 text-red-500 flex items-center justify-center">
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}

        {memories.length === 0 && (
          <p className="text-xs text-neutral-600 text-center py-4">No memories in this scope</p>
        )}
      </div>
    </div>
  )
}
