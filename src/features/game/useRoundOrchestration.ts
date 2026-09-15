import { useEffect, useRef } from 'react'
import { useGameStore } from '@/store/gameStore'
import {
  setRoundPhase,
  ensureRealDefinition,
  applyRoundScoring,
  nextPhaseAfterVote,
} from './roundApi'

/**
 * Orquestra les transicions AUTOMÀTIQUES de fase. Perquè no hi hagi curses
 * (múltiples dispositius disparant la mateixa transició), només el NARRADOR
 * executa aquestes transicions: ell no escriu ni vota, sempre és present i únic.
 *
 * Transicions automàtiques (quan TOTS els no-narradors han completat, o bé
 * quan s'exhaureix el temps límit d'escriptura si la partida en té):
 *  - writing_definitions → narrator_reading (tots han enviat definició / temps)
 *  - voting_real → voting_funny o reveal (tots han votat la real)
 *  - voting_funny → reveal (tots han votat la graciosa)
 *
 * Les votacions, a més, les pot tancar el narrador a mà des de VotingPhase.
 */
export function useRoundOrchestration() {
  const game = useGameStore((s) => s.game)
  const round = useGameStore((s) => s.round)
  const definitions = useGameStore((s) => s.definitions)
  const votes = useGameStore((s) => s.votes)
  const players = useGameStore((s) => s.players)
  const isNarrator = useGameStore((s) => s.isNarrator)

  // Evita disparar la mateixa transició més d'un cop mentre es propaga.
  const lastActionRef = useRef<string>('')

  useEffect(() => {
    if (!game || !round) return
    if (!isNarrator()) return

    const connected = players.filter((p) => p.is_connected)
    // Jugadors que han de fer accions (tots menys el narrador).
    const nonNarrator = connected.filter((p) => p.id !== round.narrator_player_id)
    const nonNarratorCount = nonNarrator.length
    if (nonNarratorCount === 0) return

    const actionKey = (phase: string) => `${round.id}:${phase}`

    // 1) Escriptura → tots els no-narradors han enviat definició, o bé s'ha
    //    exhaurit el temps límit configurat per a la partida.
    if (round.phase === 'writing_definitions') {
      const authored = new Set(
        definitions.filter((d) => d.author_player_id).map((d) => d.author_player_id)
      )
      const allWritten = nonNarrator.every((p) => authored.has(p.id))

      const goToReading = () => {
        if (lastActionRef.current === actionKey('writing_definitions')) return
        lastActionRef.current = actionKey('writing_definitions')
        // Insereix la definició real barrejada abans de llegir/votar.
        ;(async () => {
          if (round.real_definition) await ensureRealDefinition(round.id, round.real_definition)
          await setRoundPhase(round.id, 'narrator_reading')
        })()
      }

      if (allWritten) {
        goToReading()
        return
      }

      // Temps límit: el narrador passa de fase encara que falti gent. El
      // temporitzador es basa en l'instant d'entrada a la fase, així que
      // sobreviu a recàrregues del dispositiu del narrador.
      const limitMs = (game.write_time_limit_seconds ?? 0) * 1000
      if (limitMs > 0) {
        const remaining = limitMs - (Date.now() - new Date(round.phase_started_at).getTime())
        // Marge perquè els auto-enviaments dels jugadors arribin abans de passar.
        const timer = setTimeout(goToReading, Math.max(0, remaining) + 1500)
        return () => clearTimeout(timer)
      }
      return
    }

    // 2) Votació real → tots els no-narradors han votat 'real'
    if (round.phase === 'voting_real') {
      const voters = new Set(
        votes.filter((v) => v.vote_type === 'real').map((v) => v.voter_player_id)
      )
      const allVoted = nonNarrator.every((p) => voters.has(p.id))
      if (allVoted && lastActionRef.current !== actionKey('voting_real')) {
        lastActionRef.current = actionKey('voting_real')
        void setRoundPhase(round.id, nextPhaseAfterVote('real', game.score_funny_enabled))
      }
      return
    }

    // 3) Votació graciosa → tots els no-narradors han votat 'funny'
    if (round.phase === 'voting_funny') {
      const voters = new Set(
        votes.filter((v) => v.vote_type === 'funny').map((v) => v.voter_player_id)
      )
      const allVoted = nonNarrator.every((p) => voters.has(p.id))
      if (allVoted && lastActionRef.current !== actionKey('voting_funny')) {
        lastActionRef.current = actionKey('voting_funny')
        void setRoundPhase(round.id, 'reveal')
      }
      return
    }

    // 4) En entrar al reveal, apliquem els punts una sola vegada (el narrador).
    if (round.phase === 'reveal' && !round.scored) {
      if (lastActionRef.current !== actionKey('reveal')) {
        lastActionRef.current = actionKey('reveal')
        void applyRoundScoring(round, definitions, votes, game)
      }
      return
    }
  }, [game, round, definitions, votes, players, isNarrator])
}
