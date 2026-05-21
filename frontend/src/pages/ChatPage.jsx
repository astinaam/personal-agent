import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api'
import Sidebar from '../components/Sidebar.jsx'
import InputBar from '../components/InputBar.jsx'
import MemoryPanel from '../components/MemoryPanel.jsx'
import SettingsPanel from '../components/SettingsPanel.jsx'
import { useUI } from '../hooks/useUI.jsx'
import { ChevronDown, Menu } from 'lucide-react'

export default function ChatPage() {
  const { chatId } = useParams()
  const navigate = useNavigate()
  const { rightPanel, openMobileSidebar } = useUI()
  const [messages, setMessages] = useState([])
  const [providers, setProviders] = useState([])
  const [selectedProvider, setSelectedProvider] = useState(null)
  const [selectedModel, setSelectedModel] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [partialResponse, setPartialResponse] = useState('')
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState([])
  const messagesEndRef = useRef(null)

  // Load providers + models
  useEffect(() => {
    api.models.list().then(res => {
      const items = res.items || []
      setProviders(items)
      if (items.length > 0) {
        const firstProvider = items[0]
        setSelectedProvider(firstProvider.provider)
        if (firstProvider.models.length > 0) {
          setSelectedModel(firstProvider.models[0])
        }
      }
    })
  }, [])

  // When chat loads, sync provider/model
  useEffect(() => {
    if (chatId) {
      api.chats.get(chatId).then(chat => {
        setMessages(chat.messages)
        if (chat.provider_id && chat.model_id) {
          const prov = providers.find(p => p.provider.id === chat.provider_id)
          if (prov) {
            setSelectedProvider(prov.provider)
            const mdl = prov.models.find(m => m.id === chat.model_id)
            if (mdl) setSelectedModel(mdl)
          }
        }
      }).catch(() => navigate('/'))
    } else {
      setMessages([])
      setPartialResponse('')
      setUploadedFiles([])
    }
  }, [chatId, navigate, providers])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }
  useEffect(scrollToBottom, [messages, partialResponse])

  const handleProviderChange = (providerId) => {
    const prov = providers.find(p => p.provider.id === providerId)
    if (!prov) return
    setSelectedProvider(prov.provider)
    if (prov.models.length > 0) {
      setSelectedModel(prov.models[0])
    } else {
      setSelectedModel(null)
    }
  }

  const handleSend = useCallback(async (text, files) => {
    let chat_id = chatId ? parseInt(chatId) : null
    const allFiles = [...uploadedFiles, ...(files || [])]
    if (files?.length) setUploadedFiles(prev => [...prev, ...files])

    const userMsg = { role: 'user', content: text, files: allFiles }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)
    setPartialResponse('')

    try {
      const body = {
        message: text,
        chat_id,
        provider_id: selectedProvider?.id,
        model_id: selectedModel?.id,
        files: allFiles.map(f => f.id || f.filename)
      }
      const res = await api.messages.query(body)
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6))
              if (parsed.content) {
                full += parsed.content
                setPartialResponse(full)
              }
              if (parsed.chat_id && parsed.done) {
                chat_id = parsed.chat_id
                navigate(`/chat/${chat_id}`, { replace: true })
              }
            } catch {}
          }
        }
      }
      setMessages(prev => [...prev, { role: 'assistant', content: full, model_used: selectedModel?.slug || '' }])
      setPartialResponse('')
      setUploadedFiles([])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Ug, problem: ${err.message}`, model_used: 'error' }])
    } finally {
      setIsLoading(false)
    }
  }, [chatId, selectedProvider, selectedModel, uploadedFiles, navigate])

  const displayMessages = [...messages]
  if (partialResponse) {
    displayMessages.push({ role: 'assistant', content: partialResponse })
  }

  const currentProvider = providers.find(p => p.provider.id === selectedProvider?.id)
  const currentModels = currentProvider?.models || []

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100 overflow-hidden relative">
      <Sidebar selectedChatId={chatId} />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={openMobileSidebar} className="sm:hidden w-8 h-8 rounded-lg hover:bg-surface-raised text-neutral-400 flex items-center justify-center">
              <Menu size={18} />
            </button>
            <h2 className="text-sm font-medium text-neutral-300 truncate max-w-[120px] sm:max-w-md">
              {chatId ? 'Chat #' + chatId : 'New Chat'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Model selector pill */}
            <div className="relative">
              <button
                onClick={() => setShowModelPicker(!showModelPicker)}
                className="flex items-center gap-1.5 bg-surface-raised border border-border rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 hover:border-brand/50 transition-colors"
              >
                <span className="truncate max-w-[120px] sm:max-w-[200px]">
                  {selectedProvider?.name || 'Provider'} / {selectedModel?.display_name || 'Model'}
                </span>
                <ChevronDown size={12} />
              </button>

              {showModelPicker && (
                <div className="absolute right-0 top-full mt-1.5 w-64 bg-surface border border-border rounded-xl shadow-xl z-50 p-2 animate-fade-in">
                  <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider px-2 py-1">Provider</div>
                  <div className="flex gap-1 flex-wrap mb-2 px-1">
                    {providers.map(p => (
                      <button
                        key={p.provider.id}
                        onClick={() => handleProviderChange(p.provider.id)}
                        className={`px-2 py-1 rounded-md text-xs transition-colors ${
                          selectedProvider?.id === p.provider.id
                            ? 'bg-brand text-white'
                            : 'bg-surface-raised text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        {p.provider.name}
                      </button>
                    ))}
                  </div>
                  <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider px-2 py-1">Model</div>
                  <div className="space-y-0.5">
                    {currentModels.map(m => (
                      <button
                        key={m.id}
                        onClick={() => { setSelectedModel(m); setShowModelPicker(false) }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between ${
                          selectedModel?.id === m.id
                            ? 'bg-brand/10 text-brand'
                            : 'text-neutral-300 hover:bg-surface-raised'
                        }`}
                      >
                        <span className="truncate">{m.display_name}</span>
                        {m.supports_vision && <span className="text-[9px] text-neutral-500">👁</span>}
                      </button>
                    ))}
                    {currentModels.length === 0 && (
                      <p className="text-xs text-neutral-600 text-center py-2">No models</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {uploadedFiles.length > 0 && (
              <span className="text-xs text-brand px-2 py-1 bg-brand/10 rounded-md shrink-0">
                {uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 scrollbar-thin">
          {displayMessages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in px-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-surface-raised rounded-2xl flex items-center justify-center mb-4">
                <span className="text-2xl sm:text-3xl">🦴</span>
              </div>
              <h2 className="text-lg sm:text-xl font-semibold text-neutral-200 mb-2">Ug, what you want?</h2>
              <p className="text-xs sm:text-sm text-neutral-500 max-w-sm">Talk to me. Ask thing. Upload file. I remember everything.</p>
            </div>
          )}
          {displayMessages.map((msg, i) => (
            <div key={i} className={`flex gap-3 sm:gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''} group animate-fade-in`}>
              <div className={`flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-xs ${
                msg.role === 'user' ? 'bg-brand/20 text-brand' : 'bg-surface-elevated text-neutral-400'
              }`}>
                {msg.role === 'user' ? 'U' : 'G'}
              </div>
              <div className={`max-w-[85%] sm:max-w-[80%] ${msg.role === 'user' ? 'bg-brand text-white' : 'bg-surface-raised text-neutral-200'} px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl text-xs sm:text-sm leading-relaxed`}>
                {msg.content}
                {msg.files?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {msg.files.map((f, j) => (
                      <span key={j} className="text-xs bg-black/20 px-2 py-1 rounded-md truncate max-w-[150px] sm:max-w-[200px]">{f.filename || f.id}</span>
                    ))}
                  </div>
                )}
                {msg.model_used && msg.role === 'assistant' && (
                  <div className="mt-1.5 text-[10px] sm:text-xs text-neutral-500">via {msg.model_used}</div>
                )}
              </div>
            </div>
          ))}
          {isLoading && !partialResponse && (
            <div className="flex gap-3 sm:gap-4 animate-fade-in">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-surface-elevated text-neutral-400 flex items-center justify-center text-xs">G</div>
              <div className="bg-surface-raised px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-neutral-500 rounded-full animate-pulse-glow" />
                  <div className="w-2 h-2 bg-neutral-500 rounded-full animate-pulse-glow" style={{ animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 bg-neutral-500 rounded-full animate-pulse-glow" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <InputBar onSend={handleSend} isLoading={isLoading} />
      </div>

      {/* Right panel */}
      {rightPanel === 'memories' && <MemoryPanel />}
      {rightPanel === 'settings' && <SettingsPanel />}

      {/* Mobile overlay for model picker click-away */}
      {showModelPicker && (
        <div className="fixed inset-0 z-40" onClick={() => setShowModelPicker(false)} />
      )}
    </div>
  )
}
