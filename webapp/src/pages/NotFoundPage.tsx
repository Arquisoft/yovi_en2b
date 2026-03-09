import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Home, Hexagon } from 'lucide-react'

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="text-center">
        <Hexagon className="w-20 h-20 text-muted-foreground mx-auto mb-6 opacity-50" />
        <h1 className="text-6xl font-bold text-foreground mb-2">404</h1>
        <p className="text-xl text-muted-foreground mb-8">
          Page not found
        </p>
        <Link to="/games">
          <Button>
            <Home className="w-4 h-4 mr-2" />
            Back to Games
          </Button>
        </Link>
      </div>
    </div>
  )
}
