import { createContext, useContext, useState, useCallback } from 'react'

const UIContext = createContext(null)

export function UIProvider({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [rightPanel, setRightPanel] = useState(null)
  const [selectedProject, setSelectedProject] = useState(null)

  const toggleSidebar = useCallback(() => setSidebarOpen(p => !p), [])
  const openMobileSidebar = useCallback(() => setMobileSidebarOpen(true), [])
  const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), [])
  const openPanel = useCallback((panel) => setRightPanel(panel), [])
  const closePanel = useCallback(() => setRightPanel(null), [])
  const selectProject = useCallback((project) => setSelectedProject(project), [])

  return (
    <UIContext.Provider value={{ sidebarOpen, toggleSidebar, mobileSidebarOpen, openMobileSidebar, closeMobileSidebar, rightPanel, openPanel, closePanel, selectedProject, selectProject }}>
      {children}
    </UIContext.Provider>
  )
}

export const useUI = () => useContext(UIContext)
