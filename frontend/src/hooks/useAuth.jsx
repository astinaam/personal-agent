import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { api } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      api.auth.me().then(u => { setUser(u); setLoading(false) }).catch(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = useCallback(async (email, password) => {
    const res = await api.auth.login(email, password)
    localStorage.setItem('token', res.token)
    setUser(res.user)
    return res.user
  }, [])

  const register = useCallback(async (email, password) => {
    const res = await api.auth.register(email, password)
    localStorage.setItem('token', res.token)
    setUser(res.user)
    return res.user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
