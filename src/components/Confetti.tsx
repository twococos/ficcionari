import { useMemo } from 'react'

// Confeti lleuger fet només amb CSS/DOM (sense dependències ni canvas).
// Genera N trossos amb posició, retard i color deterministes per índex.
const COLORS = ['#F8C800', '#FFFFFF', '#0058F8', '#66A3FF']

export function Confetti({ pieces = 40 }: { pieces?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        left: (i * 97) % 100,
        delay: (i % 10) * 0.15,
        duration: 2.4 + ((i * 37) % 100) / 100,
        color: COLORS[i % COLORS.length],
        size: 6 + (i % 4) * 2,
      })),
    [pieces]
  )

  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {bits.map((b, i) => (
        <span
          key={i}
          className="absolute top-[-10px] animate-[confettiFall_linear_infinite]"
          style={{
            left: `${b.left}%`,
            width: b.size,
            height: b.size * 1.6,
            backgroundColor: b.color,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.duration}s`,
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  )
}
