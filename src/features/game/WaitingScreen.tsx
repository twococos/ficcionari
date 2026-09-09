import type { ReactNode } from 'react'

/** Pantalla d'espera genèrica per als jugadors mentre actua el narrador o la resta. */
export function WaitingScreen({
  message,
  children,
}: {
  message: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-accent" />
      <p className="text-lg font-bold text-white/80">{message}</p>
      {children}
    </div>
  )
}
