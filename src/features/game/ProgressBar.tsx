/**
 * Barra de progrés festiva (ratlles accent en moviment) que s'omple d'esquerra a
 * dreta de 0% a 100% en `durationMs`. S'usa per al compte enrere d'auto-avanç dels
 * resultats i per a l'últim jugador que queda per escriure.
 *
 * - `variant="bar"`: barra pròpia (p.ex. sota un quadre o a baix de la pantalla).
 * - `variant="fill"`: ompliment absolut per posar DINS d'un botó (com a fons animat).
 *
 * `flush`: barra enganxada a la vora (amplada completa, sense marges) → més
 * gruixuda i amb cantonades rectes perquè quedi arran de pantalla.
 */
export function ProgressBar({
  durationMs,
  variant = 'bar',
  flush = false,
}: {
  durationMs: number
  variant?: 'bar' | 'fill'
  flush?: boolean
}) {
  const fill = (
    <div
      className={`ficc-stripes h-full ${flush ? 'rounded-r-full' : 'rounded-full'}`}
      style={{
        animation: `progressGrow ${durationMs}ms linear forwards, stripesMove 0.6s linear infinite`,
      }}
    />
  )

  if (variant === 'fill') {
    // Fons animat dins d'un contenidor relatiu (el botó). Prou opac perquè
    // contrasti amb el botó (abans quedava massa apagat).
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl opacity-70">
        {fill}
      </div>
    )
  }

  return (
    <div
      className={`w-full overflow-hidden bg-white/25 ${
        flush ? 'h-6' : 'h-3 rounded-full'
      }`}
    >
      {fill}
    </div>
  )
}
