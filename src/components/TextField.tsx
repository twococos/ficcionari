import type { InputHTMLAttributes } from 'react'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
}

export function TextField({ label, hint, className = '', ...props }: TextFieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      {label && <span className="text-sm font-bold text-white/80">{label}</span>}
      <input
        className={`rounded-2xl border-2 border-white/20 bg-primary-dark/40 px-4 py-3 text-white placeholder:text-white/40 outline-none transition focus:border-accent ${className}`}
        {...props}
      />
      {hint && <span className="text-xs text-white/50">{hint}</span>}
    </label>
  )
}
