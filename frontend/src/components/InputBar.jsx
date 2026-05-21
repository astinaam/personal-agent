import { useState, useRef, useCallback } from 'react'
import { api } from '../api'
import { Send, Paperclip, Image, Film, X } from 'lucide-react'

export default function InputBar({ onSend, isLoading }) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)
  const imageInputRef = useRef(null)
  const videoInputRef = useRef(null)

  const handleSend = useCallback(() => {
    if (!text.trim() || isLoading) return
    onSend(text, files)
    setText('')
    setFiles([])
    inputRef.current?.focus()
  }, [text, files, onSend, isLoading])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFilePick = async (inputType) => {
    const input = inputType === 'image' ? imageInputRef.current : inputType === 'video' ? videoInputRef.current : fileInputRef.current
    input?.click()
  }

  const handleFileChange = async (e) => {
    const picked = Array.from(e.target.files || [])
    if (picked.length === 0) return
    setUploading(true)
    try {
      const res = await api.files.upload(picked)
      setFiles(prev => [...prev, ...res.files])
    } catch {
      alert('Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const removeFile = (url) => {
    setFiles(prev => prev.filter(f => f.url !== url))
  }

  return (
    <div className="shrink-0 border-t border-border bg-surface">
      {files.length > 0 && (
        <div className="px-4 py-2 flex flex-wrap gap-2 border-b border-border">
          {files.map(f => (
            <div key={f.url} className="flex items-center gap-1.5 bg-surface-raised border border-border rounded-lg px-2.5 py-1.5 text-xs text-neutral-300">
              <span className="truncate max-w-[150px]">{f.filename}</span>
              <span className="text-neutral-600">({(f.size / 1024).toFixed(1)}k)</span>
              <button onClick={() => removeFile(f.url)} className="text-neutral-500 hover:text-red-400 ml-1">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="px-4 py-3 flex items-end gap-2">
        <div className="flex items-center gap-0.5">
          <button onClick={() => handleFilePick('file')} className="w-8 h-8 rounded-lg hover:bg-surface-raised text-neutral-500 flex items-center justify-center" title="Attach file">
            <Paperclip size={16} />
          </button>
          <button onClick={() => handleFilePick('image')} className="w-8 h-8 rounded-lg hover:bg-surface-raised text-neutral-500 flex items-center justify-center" title="Attach image">
            <Image size={16} />
          </button>
          <button onClick={() => handleFilePick('video')} className="w-8 h-8 rounded-lg hover:bg-surface-raised text-neutral-500 flex items-center justify-center" title="Attach video">
            <Film size={16} />
          </button>
        </div>
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type message... (Enter to send, Shift+Enter for new line)"
            rows={1}
            className="w-full bg-surface-raised border border-border rounded-xl px-4 py-2.5 pr-10 text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-brand resize-none min-h-[40px] max-h-[160px] scrollbar-thin"
            style={{ overflow: 'hidden' }}
            onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!text.trim() || isLoading || uploading}
          className="w-9 h-9 bg-brand hover:bg-brand-hover disabled:opacity-30 disabled:hover:bg-brand text-white rounded-xl flex items-center justify-center transition-colors shrink-0"
        >
          {uploading ? '...' : <Send size={16} />}
        </button>
      </div>
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
      <input ref={imageInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} />
      <input ref={videoInputRef} type="file" multiple accept="video/*" className="hidden" onChange={handleFileChange} />
    </div>
  )
}
