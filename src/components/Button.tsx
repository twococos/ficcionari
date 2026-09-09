import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'accent' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  children: ReactNode
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-white text-primary hover:bg-white/90 active:scale-[0.98]',
  accent: 'bg-accent text-primary-dark hover:brightness-105 active:scale-[0.98]',
  ghost: 'bg-transparent text-white border-2 border-white/40 hover:border-white active:scale-[0.98]',
}

export function Button({ variant = 'primary', className = '', children, ...props }: ButtonProps) {
  return (
    <button
      className={`rounded-2xl px-6 py-4 text-lg font-800 font-extrabold shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
