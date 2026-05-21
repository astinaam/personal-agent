import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api'
import Sidebar from '../components/Sidebar.jsx'
import InputBar from '../components/InputBar.jsx'
import MemoryPanel from '../components/MemoryPanel.jsx'
import SettingsPanel from '../components/SettingsPanel.jsx'
import { useUI } from '../hooks/useUI.jsx'

export default function ChatPage() {
  const { chatId } = useParams()
  const navigate = useNavigate()
  const { rightPanel } = useUI()
  const [messages, setMessages] = useState([])
  const [models, setModels] = useState([])
  const [selectedModel, setSelectedModel] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [partialResponse, setPartialResponse] = useState('')
  const messagesEndRef = useRef(null)
  const [uploadedFiles, setUploadedFiles] = useState([])

  useEffect(() => {
    api.models.list().then(res => { setModels(res.models); setSelectedModel(res.models[0]?.id) })
  }, [])

  useEffect(() => {
    if (chatId) {
      api.chats.get(chatId).then(chat => {
        setMessages(chat.messages)
      }).catch(() => navigate('/'))
    } else {
      setMessages([])
      setPartialResponse('')
      setUploadedFiles([])
    }
  }, [chatId, navigate])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }
  useEffect(scrollToBottom, [messages, partialResponse])

  const handleSend = useCallback(async (text, files) => {
    let chat_id = chatId ? parseInt(chatId) : null
    const allFiles = [...uploadedFiles, ...(files || [])]
    if (files?.length) setUploadedFiles(prev => [...prev, ...files])

    const userMsg = { role: 'user', content: text, files: allFiles }
    const tempAssistant = { role: 'assistant', content: '' }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)
    setPartialResponse('')

    try {
      const res = await api.messages.query({ message: text, model: selectedModel, chat_id, files: allFiles.map(f => f.id || f.filename) })
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
      setMessages(prev => [...prev, { role: 'assistant', content: full, model_used: selectedModel }])
      setPartialResponse('')
      setUploadedFiles([])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Ug, problem: ${err.message}`, model_used: 'error' }])
    } finally {
      setIsLoading(false)
    }
  }, [chatId, selectedModel, uploadedFiles, navigate])

  const displayMessages = [...messages]
  if (partialResponse) {
    displayMessages.push({ role: 'assistant', content: partialResponse })
  }

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100 overflow-hidden">
      <Sidebar selectedChatId={chatId} />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-medium text-neutral-300 truncate max-w-md">
              {chatId ? 'Chat #' + chatId : 'New Chat'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="bg-surface-raised border border-border rounded-lg px-3 py-1.5 text-xs text-neutral-300 focus:outline-none focus:ring-1 focus:ring-brand"
            >
              {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            {uploadedFiles.length > 0 && (
              <span className="text-xs text-brand px-2 py-1 bg-brand/10 rounded-md">
                {uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 scrollbar-thin">
          {displayMessages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in">
              <div className="w-16 h-16 bg-surface-raised rounded-2xl flex items-center justify-center mb-4">
                <span className="text-3xl">🦴</span>
              </div>
              <h2 className="text-xl font-semibold text-neutral-200 mb-2">Ug, what you want?</h2>
              <p className="text-sm text-neutral-500 max-w-sm">Talk to me. Ask thing. Upload file. I remember everything.</p>
            </div>
          )}
          {displayMessages.map((msg, i) => (
            <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''} group animate-fade-in`}>
              <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
                msg.role === 'user' ? 'bg-brand/20 text-brand' : 'bg-surface-elevated text-neutral-400'
              }`}>
                {msg.role === 'user' ? 'U' : 'G'}
              </div>
              <div className={`max-w-[80%] ${msg.role === 'user' ? 'bg-brand text-white' : 'bg-surface-raised text-neutral-200'} px-4 py-3 rounded-2xl text-sm leading-relaxed`}>
                {msg.content}
                {msg.files?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {msg.files.map((f, j) => (
                      <span key={j} className="text-xs bg-black/20 px-2 py-1 rounded-md truncate max-w-[200px]">{f.filename || f.id}</span>
                    ))}
                  </div>
                )}
                {msg.model_used && msg.role === 'assistant' && (
                  <div className="mt-1.5 text-xs text-neutral-500">via {msg.model_used}</div>
                )}
              </div>
            </div>
          ))}
          {isLoading && !partialResponse && (
            <div className="flex gap-4 animate-fade-in">
              <div className="w-8 h-8 rounded-lg bg-surface-elevated text-neutral-400 flex items-center justify-center">G</div>
              <div className="bg-surface-raised px-4 py-3 rounded-2xl">
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
      {rightPanel === 'settings' && <SettingsPanel models={models} selectedModel={selectedModel} onModelChange={setSelectedModel} />}
    </div>
  )
}
