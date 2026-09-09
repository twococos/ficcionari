import type { ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl bg-primary-dark/40 p-5 shadow-lg ${className}`}>{children}</div>
  )
}
