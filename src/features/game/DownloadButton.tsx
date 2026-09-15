import { useTranslation } from 'react-i18next'

/**
 * Botó per desar la pantalla com a imatge, sempre amb la icona de descàrrega.
 *
 * - Per defecte és quadrat, per anar al costat d'un botó d'acció (com "Ronda
 *   següent") sense competir-hi visualment.
 * - `fullWidth` l'estén a tot l'ample, per quan va sol.
 */
export function DownloadButton({
  onClick,
  busy = false,
  label,
  fullWidth = false,
  className = '',
}: {
  onClick: () => void
  busy?: boolean
  /** Text accessible; per defecte, el de desar la imatge. */
  label?: string
  fullWidth?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const title = label ?? t('common.saveImage')

  return (
    <button
      onClick={onClick}
      disabled={busy}
      title={title}
      aria-label={title}
      className={`flex h-[60px] items-center justify-center rounded-2xl border-2 border-white/40 text-white shadow-lg transition hover:border-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
        fullWidth ? 'w-full' : 'w-[60px] shrink-0'
      } ${className}`}
    >
      {busy ? (
        <span className="text-sm font-extrabold">…</span>
      ) : (
        <DownloadIcon className="h-6 w-6" />
      )}
    </button>
  )
}

/** Fletxa cap avall sobre una safata: icona de descàrrega convencional. */
function DownloadIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  )
}
