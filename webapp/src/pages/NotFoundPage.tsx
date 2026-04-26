import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Home, Hexagon } from 'lucide-react'
 
export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="text-center">
        <Hexagon className="w-20 h-20 text-muted-foreground mx-auto mb-6 opacity-50" />
        <h1 className="text-6xl font-bold text-foreground mb-2">{t('notFound.heading')}</h1>
        <p className="text-xl text-muted-foreground mb-8">{t('notFound.message')}</p>
        <Link to="/games">
          <Button>
            <Home className="w-4 h-4 mr-2" />
            {t('notFound.backToGames')}
          </Button>
        </Link>
      </div>
    </div>
  )
}