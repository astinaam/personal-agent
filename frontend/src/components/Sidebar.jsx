import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUI } from '../hooks/useUI.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { api } from '../api'
import { PanelLeft, Settings, Book, Plus, Trash2, LogOut, Menu, X, Folder, FolderOpen, MoreHorizontal } from 'lucide-react'

export default function Sidebar({ selectedChatId }) {
  const [projects, setProjects] = useState([])
  const [chatsByProject, setChatsByProject] = useState({})
  const [addingProject, setAddingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [expandedProject, setExpandedProject] = useState(null)
  const [editingProject, setEditingProject] = useState(null)
  const [editName, setEditName] = useState('')

  const { sidebarOpen, toggleSidebar, mobileSidebarOpen, closeMobileSidebar, openPanel, selectedProject, selectProject } = useUI()
  const { logout } = useAuth()
  const navigate = useNavigate()

  const loadProjects = () => api.projects.list().then(res => {
    setProjects(res.items)
    // Auto-select global if nothing selected
    if (!selectedProject && res.items.length > 0) {
      const global = res.items.find(p => p.is_global)
      selectProject(global || res.items[0])
      setExpandedProject(global?.id || res.items[0]?.id)
    }
  })

  const loadChats = () => {
    api.chats.list().then(res => {
      const byProj = {}
      for (const c of res) {
        const pid = c.project_id || 'none'
        if (!byProj[pid]) byProj[pid] = []
        byProj[pid].push(c)
      }
      setChatsByProject(byProj)
    })
  }

  useEffect(() => { loadProjects(); loadChats() }, [])

  useEffect(() => {
    if (selectedProject) {
      setExpandedProject(selectedProject.id)
    }
  }, [selectedProject])

  const handleNewChat = () => {
    closeMobileSidebar()
    navigate('/')
  }

  const handleDeleteChat = async (id) => {
    await api.chats.delete(id)
    loadChats()
    navigate('/')
  }

  const handleNavigate = (path) => {
    closeMobileSidebar()
    navigate(path)
  }

  const handleSelectProject = (project) => {
    selectProject(project)
    setExpandedProject(project.id)
    closeMobileSidebar()
  }

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return
    const slug = newProjectName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    await api.projects.create({ name: newProjectName, slug })
    setAddingProject(false)
    setNewProjectName('')
    loadProjects()
  }

  const handleDeleteProject = async (id) => {
    if (!confirm('Delete project? Chats move to Global.')) return
    await api.projects.delete(id)
    loadProjects()
    loadChats()
  }

  const handleRenameProject = async (id) => {
    if (!editName.trim()) return
    await api.projects.update(id, { name: editName })
    setEditingProject(null)
    setEditName('')
    loadProjects()
  }

  const currentChats = chatsByProject[selectedProject?.id] || []

  const ProjectList = () => (
    <div className="space-y-0.5">
      {projects.map(project => {
        const isSelected = selectedProject?.id === project.id
        const isExpanded = expandedProject === project.id
        return (
          <div key={project.id}>
            <div
              className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                isSelected ? 'bg-brand/10 text-brand' : 'hover:bg-surface-raised text-neutral-400'
              }`}
              onClick={() => handleSelectProject(project)}
            >
              <span className="text-xs">{isExpanded ? <FolderOpen size={14} /> : <Folder size={14} />}</span>
              <span className="flex-1 text-xs font-medium truncate">{project.name}</span>
              {!project.is_global && (
                <div className="hidden group-hover:flex items-center gap-0.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingProject(project.id); setEditName(project.name) }}
                    className="w-5 h-5 rounded hover:bg-surface text-neutral-500 flex items-center justify-center"
                  >
                    <MoreHorizontal size={10} />
                  </button>
                </div>
              )}
            </div>
            {editingProject === project.id && (
              <div className="px-2 py-1 flex gap-1">
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleRenameProject(project.id)}
                  className="flex-1 bg-surface border border-border rounded px-2 py-0.5 text-xs text-neutral-300 focus:outline-none focus:ring-1 focus:ring-brand"
                  autoFocus
                />
                <button onClick={() => handleRenameProject(project.id)} className="text-brand text-xs">Save</button>
                <button onClick={() => { setEditingProject(null); handleDeleteProject(project.id) }} className="text-red-400 text-xs">Del</button>
              </div>
            )}
          </div>
        )
      })}
      {addingProject ? (
        <div className="px-2 py-1 flex gap-1">
          <input
            value={newProjectName}
            onChange={e => setNewProjectName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateProject()}
            placeholder="Project name"
            className="flex-1 bg-surface border border-border rounded px-2 py-0.5 text-xs text-neutral-300 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-brand"
            autoFocus
          />
          <button onClick={handleCreateProject} className="text-brand text-xs">Add</button>
        </div>
      ) : (
        <button
          onClick={() => setAddingProject(true)}
          className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-neutral-500 hover:text-neutral-300 hover:bg-surface-raised transition-colors"
        >
          <Plus size={12} /> New Project
        </button>
      )}
    </div>
  )

  const ChatList = () => (
    <div className="p-1.5 space-y-0.5">
      {currentChats.map(chat => (
        <div
          key={chat.id}
          className={`group flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-raised cursor-pointer transition-colors ${selectedChatId === String(chat.id) ? 'bg-surface-raised' : ''}`}
          onClick={() => handleNavigate(`/chat/${chat.id}`)}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm text-neutral-300 truncate">{chat.title}</p>
            <p className="text-xs text-neutral-600">{new Date(chat.created_at).toLocaleDateString()}</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); handleDeleteChat(chat.id) }}
            className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded hover:bg-red-500/10 text-neutral-500 hover:text-red-500 flex items-center justify-center transition-opacity"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      {currentChats.length === 0 && <p className="text-xs text-neutral-600 text-center py-4">No chats in this project</p>}
    </div>
  )

  // Mobile overlay drawer
  const MobileOverlay = mobileSidebarOpen && (
    <div className="fixed inset-0 z-50 flex sm:hidden">
      <div className="w-64 bg-surface border-r border-border flex flex-col h-full">
        <div className="h-14 border-b border-border flex items-center justify-between px-3 shrink-0">
          <span className="text-sm font-semibold text-neutral-300">Workspace</span>
          <div className="flex gap-1">
            <button onClick={closeMobileSidebar} className="w-7 h-7 rounded-lg hover:bg-surface-raised text-neutral-500 flex items-center justify-center">
              <X size={15} />
            </button>
            <button onClick={handleNewChat} className="w-7 h-7 rounded-lg hover:bg-surface-raised text-brand flex items-center justify-center">
              <Plus size={15} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-2">
            <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider px-2 py-1">Projects</div>
            <ProjectList />
          </div>
          <div className="border-t border-border p-2">
            <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider px-2 py-1">
              {selectedProject?.name || 'Chats'}
            </div>
            <ChatList />
          </div>
        </div>
        <div className="border-t border-border p-2 flex gap-1 shrink-0">
          <button onClick={() => { closeMobileSidebar(); openPanel('memories') }} className="flex-1 h-8 rounded-lg hover:bg-surface-raised text-neutral-500 text-xs flex items-center justify-center gap-1.5">
            <Book size={14} /> Memories
          </button>
          <button onClick={() => { closeMobileSidebar(); openPanel('settings') }} className="flex-1 h-8 rounded-lg hover:bg-surface-raised text-neutral-500 text-xs flex items-center justify-center gap-1.5">
            <Settings size={14} /> Settings
          </button>
        </div>
        <div className="border-t border-border p-2 shrink-0">
          <button onClick={() => { closeMobileSidebar(); logout() }} className="w-full h-8 rounded-lg hover:bg-red-500/10 text-neutral-500 text-xs flex items-center justify-center gap-1.5">
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </div>
      <div className="flex-1 bg-black/60" onClick={closeMobileSidebar} />
    </div>
  )

  // Desktop collapsed sidebar (icon bar)
  if (!sidebarOpen) {
    return (
      <>
        {MobileOverlay}
        <div className="hidden sm:flex w-14 shrink-0 border-r border-border flex-col items-center py-3 gap-2">
          <button onClick={toggleSidebar} className="w-8 h-8 rounded-lg hover:bg-surface-raised text-neutral-500 flex items-center justify-center mb-2">
            <PanelLeft size={18} />
          </button>
          <button onClick={handleNewChat} className="w-8 h-8 rounded-lg hover:bg-surface-raised text-brand flex items-center justify-center">
            <Plus size={18} />
          </button>
          <div className="flex-1" />
          <button onClick={() => openPanel('memories')} className="w-8 h-8 rounded-lg hover:bg-surface-raised text-neutral-500 flex items-center justify-center">
            <Book size={18} />
          </button>
          <button onClick={() => openPanel('settings')} className="w-8 h-8 rounded-lg hover:bg-surface-raised text-neutral-500 flex items-center justify-center">
            <Settings size={18} />
          </button>
          <button onClick={logout} className="w-8 h-8 rounded-lg hover:bg-red-500/10 text-red-500 flex items-center justify-center">
            <LogOut size={18} />
          </button>
        </div>
      </>
    )
  }

  // Desktop expanded sidebar
  return (
    <>
      {MobileOverlay}
      <div className="hidden sm:flex w-64 shrink-0 border-r border-border flex-col bg-surface">
        <div className="h-14 border-b border-border flex items-center justify-between px-3 shrink-0">
          <span className="text-sm font-semibold text-neutral-300">Workspace</span>
          <div className="flex gap-1">
            <button onClick={toggleSidebar} className="w-7 h-7 rounded-lg hover:bg-surface-raised text-neutral-500 flex items-center justify-center">
              <PanelLeft size={15} />
            </button>
            <button onClick={handleNewChat} className="w-7 h-7 rounded-lg hover:bg-surface-raised text-brand flex items-center justify-center">
              <Plus size={15} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-2">
            <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider px-2 py-1">Projects</div>
            <ProjectList />
          </div>
          <div className="border-t border-border p-2">
            <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider px-2 py-1">
              {selectedProject?.name || 'Chats'}
            </div>
            <ChatList />
          </div>
        </div>
        <div className="border-t border-border p-2 flex gap-1 shrink-0">
          <button onClick={() => openPanel('memories')} className="flex-1 h-8 rounded-lg hover:bg-surface-raised text-neutral-500 text-xs flex items-center justify-center gap-1.5">
            <Book size={14} /> Memories
          </button>
          <button onClick={() => openPanel('settings')} className="flex-1 h-8 rounded-lg hover:bg-surface-raised text-neutral-500 text-xs flex items-center justify-center gap-1.5">
            <Settings size={14} /> Settings
          </button>
        </div>
        <div className="border-t border-border p-2 shrink-0">
          <button onClick={logout} className="w-full h-8 rounded-lg hover:bg-red-500/10 text-neutral-500 text-xs flex items-center justify-center gap-1.5">
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </div>
    </>
  )
}
