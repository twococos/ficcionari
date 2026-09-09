/**
 * Icona de "fet" (check) neta, en comptes de l'emoji ✅ (que es veia com un tick
 * dins d'un requadre verd, poc integrat amb la marca). Cercle accent + check.
 */
export function CheckIcon({ className = 'h-12 w-12' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      role="img"
      aria-hidden="true"
      fill="none"
    >
      <circle cx="12" cy="12" r="11" className="fill-accent" />
      <path
        d="M7 12.5l3.2 3.2L17 8.5"
        className="stroke-primary-dark"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
