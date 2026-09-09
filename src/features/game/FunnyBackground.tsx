import { useEffect, useRef, useState } from 'react'

const OUT_MS = 450

/**
 * Overlay de fons accent per a la fase de votació de la més graciosa.
 * Entra amb una bombolla que s'expandeix (`bubbleIn`) i, en deixar la fase,
 * es contreu (`bubbleOut`) abans de desmuntar-se, de manera que la tornada al
 * fons blau també queda animada.
 */
export function FunnyBackground({ active }: { active: boolean }) {
  const [visible, setVisible] = useState(active)
  const [leaving, setLeaving] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (active) {
      clearTimeout(timerRef.current)
      setLeaving(false)
      setVisible(true)
    } else if (visible) {
      // Anima la sortida i desmunta després.
      setLeaving(true)
      timerRef.current = setTimeout(() => {
        setVisible(false)
        setLeaving(false)
      }, OUT_MS)
    }
    return () => clearTimeout(timerRef.current)
  }, [active, visible])

  if (!visible) return null

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 bg-accent"
      style={{
        animation: leaving
          ? `bubbleOut ${OUT_MS}ms ease-in forwards`
          : 'bubbleIn 500ms ease-out both',
      }}
    />
  )
}
