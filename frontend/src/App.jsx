import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth.jsx'
import { UIProvider } from './hooks/useUI.jsx'
import LoginPage from './pages/LoginPage.jsx'
import ChatPage from './pages/ChatPage.jsx'

function AuthenticatedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen bg-neutral-950 text-neutral-400">Loading...</div>
  return user ? children : <Navigate to="/login" />
}

function GuestRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen bg-neutral-950 text-neutral-400">Loading...</div>
  return user ? <Navigate to="/" /> : children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/" element={<AuthenticatedRoute><ChatPage /></AuthenticatedRoute>} />
      <Route path="/chat/:chatId" element={<AuthenticatedRoute><ChatPage /></AuthenticatedRoute>} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <UIProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </UIProvider>
    </AuthProvider>
  )
}
