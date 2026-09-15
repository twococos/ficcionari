import { useTranslation } from 'react-i18next'

/**
 * Banner amb la paraula de la ronda. Es manté visible des que es comencen a
 * escriure les definicions fins als resultats, perquè ningú l'oblidi (sobretot
 * mentre el narrador les llegeix en veu alta).
 *
 * - `tone="default"`: targeta blanca amb la paraula en accent (fons blau).
 * - `tone="onAccent"`: invertida (fons fosc, paraula accent) per a la votació
 *   graciosa, on el fons de pantalla és groc i el blanc no contrastaria.
 * - `compact`: versió reduïda per a les fases on només cal recordar-la.
 */
export function WordBanner({
  word,
  compact = false,
  tone = 'default',
}: {
  word: string
  compact?: boolean
  tone?: 'default' | 'onAccent'
}) {
  const { t } = useTranslation()
  const onAccent = tone === 'onAccent'

  return (
    <div
      className={`text-center ${compact ? 'rounded-2xl px-4 py-2' : 'px-4 py-3'} ${
        onAccent ? 'bg-primary-dark' : 'bg-white'
      }`}
    >
      <p
        className={`text-xs font-bold uppercase tracking-wide ${
          onAccent ? 'text-white/50' : 'text-primary-dark/50'
        }`}
      >
        {t('write.wordIs')}
      </p>
      <p className={`font-black text-accent ${compact ? 'text-2xl' : 'text-3xl'}`}>{word}</p>
    </div>
  )
}
