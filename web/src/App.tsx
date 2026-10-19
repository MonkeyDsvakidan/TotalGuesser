import { useEffect, useMemo, useState } from 'react'
import Play from './components/Play'
import Reveal from './components/Reveal'
import Setup from './components/Setup'
import { computeTarget, currentTurn, formatValue, pickRandom, pickTeams, revealOrder } from './game/logic'
import { loadGame, loadLastSettings, loadStats, recordResult, saveGame, saveLastSettings } from './game/storage'
import type { Game, Settings } from './game/types'
import { loadMeta, loadRoster, playerValue } from './lib/data'
import type { RosterPlayer, SportMeta } from './lib/types'

const SPORT = 'nba'

async function loadRosters(teamIds: string[]): Promise<Record<string, RosterPlayer[]>> {
  const unique = [...new Set(teamIds)]
  const lists = await Promise.all(unique.map((id) => loadRoster(SPORT, id)))
  return Object.fromEntries(unique.map((id, i) => [id, lists[i]]))
}

export default function App() {
  const [meta, setMeta] = useState<SportMeta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [game, setGame] = useState<Game | null>(() => loadGame())
  const [rosters, setRosters] = useState<Record<string, RosterPlayer[]>>({})
  const [starting, setStarting] = useState(false)
  const [stats, setStats] = useState(() => loadStats())

  useEffect(() => {
    loadMeta(SPORT)
      .then(setMeta)
      .catch((e: Error) => setError(e.message))
  }, [])

  // Nach einem Neuladen der Seite die Kader des laufenden Spiels wieder holen
  useEffect(() => {
    if (!game) return
    const missing = game.rounds.map((r) => r.teamId).filter((id) => !rosters[id])
    if (missing.length === 0) return
    loadRosters(missing)
      .then((loaded) => setRosters((r) => ({ ...r, ...loaded })))
      .catch((e: Error) => setError(e.message))
  }, [game, rosters])

  useEffect(() => saveGame(game), [game])

  const teams = useMemo(() => new Map(meta?.teams.map((t) => [t.id, t]) ?? []), [meta])
  const categories = useMemo(() => new Map(meta?.categories.map((c) => [c.key, c]) ?? []), [meta])

  const startGame = async (settings: Settings) => {
    if (!meta) return
    saveLastSettings(settings)
    setStarting(true)
    try {
      const activeTeams = meta.teams.filter((t) => t.active).map((t) => t.id)
      const teamIds = pickTeams(activeTeams.length ? activeTeams : meta.teams.map((t) => t.id), settings.rounds)
      const inGroup = meta.categories.filter((c) => c.group === settings.categoryGroup)
      const pool = inGroup.length ? inGroup : meta.categories
      const fixedCategory = pool.find((c) => c.key === settings.categoryKey)?.key ?? pickRandom(pool).key
      const rounds = teamIds.map((teamId) => ({
        teamId,
        categoryKey: settings.categoryMode === 'fixed' ? fixedCategory : pickRandom(pool).key,
      }))
      const loaded = await loadRosters(teamIds)
      setRosters((r) => ({ ...r, ...loaded }))
      setGame({
        id: crypto.randomUUID(),
        sport: SPORT,
        settings,
        rounds,
        target: computeTarget(rounds, loaded),
        picks: rounds.map(() => []),
        phase: 'play',
        revealed: 0,
      })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setStarting(false)
    }
  }

  const pick = (player: RosterPlayer | null) => {
    if (!game) return
    const turn = currentTurn(game)
    if (!turn) return
    const categoryKey = game.rounds[turn.round].categoryKey
    const entry = player
      ? { playerIndex: turn.playerIndex, rosterId: player.id, name: player.name, value: playerValue(player, categoryKey) }
      : { playerIndex: turn.playerIndex, rosterId: null, name: 'gepasst', value: 0 }
    setGame({ ...game, picks: game.picks.map((p, r) => (r === turn.round ? [...p, entry] : p)) })
  }

  const undo = () => {
    if (!game) return
    const last = game.picks.findLastIndex((p) => p.length > 0)
    if (last === -1) return
    setGame({ ...game, picks: game.picks.map((p, r) => (r === last ? p.slice(0, -1) : p)) })
  }

  const reveal = (count: number) => {
    if (!game) return
    const total = revealOrder(game).length
    const updated = { ...game, revealed: Math.min(total, game.revealed + count) }
    if (updated.revealed === total) {
      recordResult(updated)
      setStats(loadStats())
    }
    setGame(updated)
  }

  if (error && !meta) {
    return (
      <main className="app">
        <h1>TotalGuesser</h1>
        <p className="error">
          Keine Daten gefunden ({error}). Zuerst <code>scripts/nba_import.py</code> ausführen.
        </p>
      </main>
    )
  }

  if (!meta) {
    return (
      <main className="app">
        <h1>TotalGuesser</h1>
        <p className="muted">Lade Daten …</p>
      </main>
    )
  }

  const rostersReady = game ? game.rounds.every((r) => rosters[r.teamId]) : true

  return (
    <main className="app">
      <header className="top">
        <h1>TotalGuesser</h1>
        {game && (
          <div className="target" aria-label="Zielzahl">
            <span className="muted small">Ziel</span>
            <strong>{formatValue(game.target)}</strong>
          </div>
        )}
      </header>

      {error && <p className="error">{error}</p>}

      {!game && (
        <>
          <p className="lead">Team, Kategorie, Zielzahl – wer nach allen Runden am nächsten dran ist, gewinnt.</p>
          <Setup
            categories={meta.categories}
            initial={loadLastSettings()}
            stats={stats}
            starting={starting}
            onStart={startGame}
          />
        </>
      )}

      {game && !rostersReady && <p className="muted">Lade Teams …</p>}

      {game && rostersReady && game.phase === 'play' && (
        <Play
          game={game}
          teams={teams}
          categories={categories}
          rosters={rosters}
          minCareerPoints={meta.min_career_points}
          onPick={pick}
          onUndo={undo}
          onReveal={() => setGame({ ...game, phase: 'reveal' })}
        />
      )}

      {game && rostersReady && game.phase === 'reveal' && (
        <Reveal
          game={game}
          teams={teams}
          categories={categories}
          rosters={rosters}
          onRevealNext={() => reveal(1)}
          onRevealAll={() => reveal(Infinity)}
          onRematch={() => startGame(game.settings)}
          onNewSetup={() => setGame(null)}
        />
      )}

      {game && game.phase === 'play' && (
        <button
          type="button"
          className="link"
          onClick={() => {
            if (confirm('Spiel abbrechen?')) setGame(null)
          }}
        >
          Spiel abbrechen
        </button>
      )}

      <footer className="muted small">Daten-Stand: {new Date(meta.updated_at).toLocaleDateString('de-CH')}</footer>
    </main>
  )
}
