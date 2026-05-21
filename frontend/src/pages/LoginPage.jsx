import { useState } from 'react'
import { useAuth } from '../hooks/useAuth.jsx'

export default function LoginPage() {
  const { login, register } = useAuth()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isLogin) await login(email, password)
      else await register(email, password)
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-brand rounded-xl mx-auto mb-4 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Personal Agent</h1>
          <p className="text-neutral-500 mt-1">Your caveman AI companion</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand text-sm"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand text-sm"
              placeholder="Min 6 characters"
              required
              minLength={6}
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand hover:bg-brand-hover text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? '...' : isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>
        <p className="text-center text-sm text-neutral-500 mt-4">
          {isLogin ? "No account? " : "Already have account? "}
          <button onClick={() => { setIsLogin(!isLogin); setError('') }} className="text-brand hover:underline">
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
      </div>
    </div>
  )
}
