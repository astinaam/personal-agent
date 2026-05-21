const API_BASE = '/api'

class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status }
}

async function request(path, options = {}) {
  const token = localStorage.getItem('token')
  const res = await fetch(`${API_BASE}${path}`, {
    ...(token ? { headers: { 'Authorization': `Bearer ${token}`, ...options.headers } } : { headers: options.headers }),
    ...options,
    body: options.body instanceof FormData ? options.body : (options.body ? JSON.stringify(options.body) : undefined),
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers
    }
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new ApiError(data.detail || `HTTP ${res.status}`, res.status)
  }
  if (res.headers.get('content-type')?.includes('text/event-stream')) return res
  return res.status === 204 ? null : res.json()
}

export const api = {
  auth: {
    register: (email, password) => request('/auth/register', { method: 'POST', body: { email, password } }),
    login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
    me: () => request('/auth/me'),
    settings: (data) => request('/auth/me/settings', { method: 'PATCH', body: data })
  },
  providers: {
    list: () => request('/providers'),
    create: (data) => request('/providers', { method: 'POST', body: data }),
    update: (id, data) => request(`/providers/${id}`, { method: 'PATCH', body: data }),
    delete: (id) => request(`/providers/${id}`, { method: 'DELETE' }),
    models: (providerId) => request(`/providers/${providerId}/models`),
    addModel: (providerId, data) => request(`/providers/${providerId}/models`, { method: 'POST', body: data }),
    deleteModel: (providerId, modelId) => request(`/providers/${providerId}/models/${modelId}`, { method: 'DELETE' }),
    test: (id) => request(`/providers/${id}/test`, { method: 'POST' })
  },
  models: {
    list: () => request('/models'),
    refreshOpenRouter: () => request('/models/refresh', { method: 'POST' })
  },
  chats: {
    list: () => request('/chats'),
    get: (id) => request(`/chats/${id}`),
    create: (data) => request('/chats', { method: 'POST', body: data }),
    delete: (id) => request(`/chats/${id}`, { method: 'DELETE' })
  },
  messages: {
    query: (data) => request('/query', { method: 'POST', body: data })
  },
  memories: {
    list: () => request('/memories'),
    create: (data) => request('/memories', { method: 'POST', body: data }),
    update: (id, data) => request(`/memories/${id}`, { method: 'PATCH', body: data }),
    delete: (id) => request(`/memories/${id}`, { method: 'DELETE' })
  },
  config: {
    getSystemPrompt: () => request('/config/system-prompt'),
    setSystemPrompt: (prompt) => request('/config/system-prompt', { method: 'POST', body: { prompt } })
  },
  files: {
    upload: (files) => {
      const fd = new FormData()
      files.forEach(f => fd.append('files', f))
      return request('/upload', { method: 'POST', body: fd })
    }
  }
}
