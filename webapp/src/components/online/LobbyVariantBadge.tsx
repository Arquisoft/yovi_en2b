import { useTranslation } from 'react-i18next'

interface LobbyVariantBadgeProps {
  variant: string
}

export function LobbyVariantBadge({ variant }: Readonly<LobbyVariantBadgeProps>) {
  const { t } = useTranslation()
  const name = t(`variants.${variant}.name`, { defaultValue: variant })
  return (
    <div className="inline-flex items-center justify-center px-3 py-1 rounded-full border border-border bg-muted/50 text-xs font-medium text-muted-foreground">
      {t('online.variantLabel', { name })}
    </div>
  )
}
