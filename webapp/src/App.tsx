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
import { OnlineLobbyPage } from './pages/OnlineLobbyPage'
import { OnlineRoomPage } from './pages/OnlineRoomPage'
import { OnlineHostLobbyPage } from './pages/OnlineHostLobbyPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { StatsPage } from './pages/StatsPage'
import { RankingPage } from './pages/RankingPage'
import { useTranslation } from 'react-i18next'
import { GameReplayPage } from './pages/GameReplayPage'
import { GameHistoryPage } from './pages/GameHistoryPage'
import { ProfilePage } from './pages/ProfilePage'

function App() {
  const { isLoading } = useAuth()
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">{t('app.loading')}</p>
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
          {/* Online routes — parameterised by :variant so any registered
              variant gets matchmaking, room hosting, and queue UI for free.
              These literals rank above the generic /games/:variant catch-all
              because each segment is more specific. */}
          <Route path="/games/:variant/online" element={<OnlineRoomPage />} />
          <Route path="/games/:variant/online/host" element={<OnlineHostLobbyPage />} />
          <Route path="/games/:variant/online/queue" element={<OnlineLobbyPage />} />
          {/* Generic variant routes */}
          <Route path="/games/:variant" element={<GameModePage />} />
          <Route path="/games/:variant/config/:mode" element={<GameConfigPage />} />
          <Route path="/games/:variant/play/:gameId" element={<GameYPage />} />
          <Route path="/games/:variant/replay/:gameId" element={<GameReplayPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/ranking" element={<RankingPage />} />
          <Route path="/history" element={<GameHistoryPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App