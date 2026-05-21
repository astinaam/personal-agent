import { createContext, useContext, useState, useCallback } from 'react'

const UIContext = createContext(null)

export function UIProvider({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [rightPanel, setRightPanel] = useState(null)

  const toggleSidebar = useCallback(() => setSidebarOpen(p => !p), [])
  const openPanel = useCallback((panel) => setRightPanel(panel), [])
  const closePanel = useCallback(() => setRightPanel(null), [])

  return (
    <UIContext.Provider value={{ sidebarOpen, toggleSidebar, rightPanel, openPanel, closePanel }}>
      {children}
    </UIContext.Provider>
  )
}

export const useUI = () => useContext(UIContext)
