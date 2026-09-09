import { useEffect, useRef } from 'react'
import { useGameStore } from '@/store/gameStore'
import { setRoundPhase, ensureRealDefinition, applyRoundScoring } from './roundApi'

/**
 * Orquestra les transicions AUTOMÀTIQUES de fase. Perquè no hi hagi curses
 * (múltiples dispositius disparant la mateixa transició), només el NARRADOR
 * executa aquestes transicions: ell no escriu ni vota, sempre és present i únic.
 *
 * Transicions automàtiques (quan TOTS els no-narradors han completat):
 *  - writing_definitions → narrator_reading (tots han enviat definició)
 *  - voting_real → voting_funny o reveal (tots han votat la real)
 *  - voting_funny → reveal (tots han votat la graciosa)
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

    // 1) Escriptura → tots els no-narradors han enviat definició
    if (round.phase === 'writing_definitions') {
      const authored = new Set(
        definitions.filter((d) => d.author_player_id).map((d) => d.author_player_id)
      )
      const allWritten = nonNarrator.every((p) => authored.has(p.id))
      if (allWritten && lastActionRef.current !== actionKey('writing_definitions')) {
        lastActionRef.current = actionKey('writing_definitions')
        // Insereix la definició real barrejada abans de llegir/votar.
        ;(async () => {
          if (round.real_definition) await ensureRealDefinition(round.id, round.real_definition)
          await setRoundPhase(round.id, 'narrator_reading')
        })()
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
        const next = game.score_funny_enabled ? 'voting_funny' : 'reveal'
        void setRoundPhase(round.id, next)
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
