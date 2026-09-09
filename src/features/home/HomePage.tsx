import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

export function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col items-center justify-between p-6">
      <header className="flex w-full max-w-md justify-end pt-2">
        <LanguageSwitcher />
      </header>

      <main className="flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 text-center">
        <div>
          <h1 className="text-5xl font-black tracking-tight text-white drop-shadow-md">
            {t('app.name')}
          </h1>
          <p className="mt-3 text-lg font-semibold text-white/80">{t('app.tagline')}</p>
        </div>

        <div className="flex w-full flex-col gap-4">
          <Button variant="accent" onClick={() => navigate('/create')}>
            {t('home.createGame')}
          </Button>
          <Button variant="primary" onClick={() => navigate('/join')}>
            {t('home.joinGame')}
          </Button>
        </div>
      </main>

      <footer className="pb-2 text-center text-xs text-white/40">
        {t('home.attribution')}
      </footer>
    </div>
  )
}
