import { useTranslation } from 'react-i18next'
import { Card } from '@/components/Card'
import { ROUND_OPTIONS, POINTS_MIN, POINTS_MAX } from '@/game/constants'
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n/config'

/** Valors de les opcions configurables d'una partida. */
export interface GameOptionsValue {
  language: SupportedLanguage
  rounds: number
  funnyMode: boolean
  showDefinitionOnPick: boolean
  pointsGuessReal: number
  pointsDeceived: number
  pointsFunniest: number
}

/**
 * Camps d'opcions d'una partida (rondes, idioma, modes i puntuació), compartits
 * entre la creació de partida i l'edició des del lobby. Controlat: rep el valor
 * i notifica cada canvi via `onChange` (patró parcial per camp).
 *
 * `showLanguage` permet amagar el selector d'idioma (p.ex. al lobby, si es vol).
 */
export function GameOptionsFields({
  value,
  onChange,
  showLanguage = true,
}: {
  value: GameOptionsValue
  onChange: (patch: Partial<GameOptionsValue>) => void
  showLanguage?: boolean
}) {
  const { t } = useTranslation()

  return (
    <>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold text-white/80">{t('create.rounds')}</span>
        <div className="flex gap-2">
          {ROUND_OPTIONS.map((r) => (
            <button
              key={r}
              onClick={() => onChange({ rounds: r })}
              aria-pressed={value.rounds === r}
              className={`flex-1 rounded-2xl py-3 text-lg font-extrabold transition ${
                value.rounds === r
                  ? 'bg-accent text-primary-dark'
                  : 'bg-primary-dark/40 text-white/70 hover:text-white'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {showLanguage && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold text-white/80">{t('create.gameLanguage')}</span>
          <div className="flex gap-2">
            {SUPPORTED_LANGUAGES.map((lng) => (
              <button
                key={lng}
                onClick={() => onChange({ language: lng })}
                aria-pressed={value.language === lng}
                className={`flex-1 rounded-2xl py-3 font-extrabold transition ${
                  value.language === lng
                    ? 'bg-accent text-primary-dark'
                    : 'bg-primary-dark/40 text-white/70 hover:text-white'
                }`}
              >
                {t(`language.${lng}`)}
              </button>
            ))}
          </div>
          <span className="text-xs text-white/50">{t('create.gameLanguageHint')}</span>
        </div>
      )}

      <ToggleField
        label={t('create.funnyMode')}
        hint={t('create.funnyModeHint')}
        value={value.funnyMode}
        onChange={(v) => onChange({ funnyMode: v })}
      />

      <ToggleField
        label={t('create.showDefinition')}
        hint={t('create.showDefinitionHint')}
        value={value.showDefinitionOnPick}
        onChange={(v) => onChange({ showDefinitionOnPick: v })}
      />

      <div className="flex flex-col gap-3">
        <span className="text-sm font-bold text-white/80">{t('create.pointsTitle')}</span>
        <PointField
          label={t('create.pointsGuessReal')}
          value={value.pointsGuessReal}
          onChange={(v) => onChange({ pointsGuessReal: v })}
        />
        <PointField
          label={t('create.pointsDeceived')}
          value={value.pointsDeceived}
          onChange={(v) => onChange({ pointsDeceived: v })}
        />
        {value.funnyMode && (
          <PointField
            label={t('create.pointsFunniest')}
            value={value.pointsFunniest}
            onChange={(v) => onChange({ pointsFunniest: v })}
          />
        )}
      </div>
    </>
  )
}

/** Interruptor (on/off) amb etiqueta i descripció, dins d'una targeta. */
export function ToggleField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <Card>
      <button
        onClick={() => onChange(!value)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-pressed={value}
      >
        <span>
          <span className="block font-bold text-white">{label}</span>
          <span className="block text-xs text-white/50">{hint}</span>
        </span>
        <span
          className={`relative h-7 w-12 shrink-0 rounded-full transition ${
            value ? 'bg-accent' : 'bg-white/20'
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
              value ? 'left-6' : 'left-1'
            }`}
          />
        </span>
      </button>
    </Card>
  )
}

/** Camp numèric per a un valor de punts (enters, entre POINTS_MIN i POINTS_MAX). */
export function PointField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl bg-primary-dark/40 px-4 py-3">
      <span className="text-sm text-white">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={POINTS_MIN}
        max={POINTS_MAX}
        value={value}
        onChange={(e) => {
          const n = Math.round(Number(e.target.value))
          if (Number.isNaN(n)) return
          onChange(Math.max(POINTS_MIN, Math.min(POINTS_MAX, n)))
        }}
        className="w-16 rounded-xl border-2 border-white/20 bg-primary-dark/60 px-2 py-1.5 text-center font-extrabold text-accent outline-none focus:border-accent"
      />
    </label>
  )
}
