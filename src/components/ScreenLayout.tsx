import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from './LanguageSwitcher'

interface ScreenLayoutProps {
  children: ReactNode
  title?: string
  onBack?: () => void
  showLanguage?: boolean
}

export function ScreenLayout({ children, title, onBack, showLanguage = true }: ScreenLayoutProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const handleBack = onBack ?? (() => navigate('/'))

  return (
    <div className="flex min-h-screen flex-col p-6">
      <header className="mb-4 flex items-center justify-between">
        <button
          onClick={handleBack}
          className="rounded-full px-3 py-1.5 text-sm font-bold text-white/80 hover:text-white"
          aria-label={t('common.back')}
        >
          ← {t('common.back')}
        </button>
        {showLanguage && <LanguageSwitcher />}
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col">
        {title && <h1 className="mb-6 text-3xl font-black text-white">{title}</h1>}
        {children}
      </main>
    </div>
  )
}
