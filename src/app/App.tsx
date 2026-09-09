import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { HomePage } from '@/features/home/HomePage'
import { CreateGamePage } from '@/features/lobby/CreateGamePage'
import { JoinGamePage } from '@/features/lobby/JoinGamePage'
import { LobbyPage } from '@/features/lobby/LobbyPage'
import { GamePage } from '@/features/game/GamePage'
import { PodiumPage } from '@/features/game/PodiumPage'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/create" element={<CreateGamePage />} />
        <Route path="/join" element={<JoinGamePage />} />
        <Route path="/join/:code" element={<JoinGamePage />} />
        <Route path="/lobby/:code" element={<LobbyPage />} />
        <Route path="/game/:code" element={<GamePage />} />
        <Route path="/podium/:code" element={<PodiumPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
