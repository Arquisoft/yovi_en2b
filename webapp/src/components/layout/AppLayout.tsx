import { Outlet } from 'react-router-dom'
import { AppNavbar } from './AppNavbar'

export function AppLayout() {
  return (
    <div className="h-dvh flex flex-col bg-background">
      <AppNavbar />
      <main className="flex-1 min-h-0">
        <Outlet />
      </main>
    </div>
  )
}
