import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { AppLayout } from './components/layout/AppLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { GameSelectionPage } from './pages/GameSelectionPage'
import { GameModePage } from './pages/GameModePage'
import { GameConfigPage } from './pages/GameConfigPage'
import { GameYPage } from './pages/GameYPage'
import { LobbyPage } from './pages/LobbyPage'
import { NotFoundPage } from './pages/NotFoundPage'

import { StatsPage } from './pages/StatsPage'

function App() {
  const { isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading YOVI...</p>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/games" replace />} />
          <Route path="/games" element={<GameSelectionPage />} />
          <Route path="/games/y" element={<GameModePage />} />
          <Route path="/games/y/config/:mode" element={<GameConfigPage />} />
          <Route path="/games/y/lobby" element={<LobbyPage />} />
          <Route path="/games/y/play/:gameId" element={<GameYPage />} />
          <Route path="/stats" element={<StatsPage />} />
        </Route>
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
