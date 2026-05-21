import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUI } from '../hooks/useUI.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { api } from '../api'
import { PanelLeft, Settings, Book, Plus, Trash2, LogOut, Menu, X } from 'lucide-react'

export default function Sidebar({ selectedChatId }) {
  const [chats, setChats] = useState([])
  const { sidebarOpen, toggleSidebar, mobileSidebarOpen, closeMobileSidebar, openPanel } = useUI()
  const { logout } = useAuth()
  const navigate = useNavigate()

  const loadChats = () => api.chats.list().then(res => setChats(res))
  useEffect(() => { loadChats() }, [])

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

  // Mobile overlay drawer
  const MobileOverlay = mobileSidebarOpen && (
    <div className="fixed inset-0 z-50 flex sm:hidden">
      <div className="w-64 bg-surface border-r border-border flex flex-col h-full">
        <div className="h-14 border-b border-border flex items-center justify-between px-3 shrink-0">
          <span className="text-sm font-semibold text-neutral-300">Chats</span>
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
          <div className="p-1.5 space-y-0.5">
            {chats.map(chat => (
              <div key={chat.id} className={`group flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-raised cursor-pointer transition-colors ${selectedChatId === String(chat.id) ? 'bg-surface-raised' : ''}`} onClick={() => handleNavigate(`/chat/${chat.id}`)}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-neutral-300 truncate">{chat.title}</p>
                  <p className="text-xs text-neutral-600">{new Date(chat.created_at).toLocaleDateString()}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteChat(chat.id) }} className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded hover:bg-red-500/10 text-neutral-500 hover:text-red-500 flex items-center justify-center transition-opacity">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {chats.length === 0 && <p className="text-xs text-neutral-600 text-center py-4">No chats yet</p>}
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
          <span className="text-sm font-semibold text-neutral-300">Chats</span>
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
          <div className="p-1.5 space-y-0.5">
            {chats.map(chat => (
              <div key={chat.id} className={`group flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-raised cursor-pointer transition-colors ${selectedChatId === String(chat.id) ? 'bg-surface-raised' : ''}`} onClick={() => handleNavigate(`/chat/${chat.id}`)}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-neutral-300 truncate">{chat.title}</p>
                  <p className="text-xs text-neutral-600">{new Date(chat.created_at).toLocaleDateString()}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteChat(chat.id) }} className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded hover:bg-red-500/10 text-neutral-500 hover:text-red-500 flex items-center justify-center transition-opacity">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {chats.length === 0 && <p className="text-xs text-neutral-600 text-center py-4">No chats yet</p>}
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
