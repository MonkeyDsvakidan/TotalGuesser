import { useEffect, useMemo, useState } from 'react'
import Play from './components/Play'
import Reveal from './components/Reveal'
import Setup from './components/Setup'
import { computeTarget, currentTurn, formatValue, pickRandom, pickTeams, revealOrder } from './game/logic'
import { loadGame, loadLastSettings, loadSport, loadStats, recordResult, saveGame, saveLastSettings, saveSport } from './game/storage'
import type { Game, Settings } from './game/types'
import { loadMeta, loadRoster, playerValue, rosterNote } from './lib/data'
import { DEFAULT_SPORT, SPORTS, sportById } from './lib/sports'
import type { RosterPlayer, SportMeta } from './lib/types'

async function loadRosters(sport: string, teamIds: string[]): Promise<Record<string, RosterPlayer[]>> {
  const unique = [...new Set(teamIds)]
  const lists = await Promise.all(unique.map((id) => loadRoster(sport, id)))
  return Object.fromEntries(unique.map((id, i) => [id, lists[i]]))
}

export default function App() {
  // Metadaten aller Sportarten vorab laden, damit ein Wechsel im Setup die Eingaben nicht verliert
  const [metas, setMetas] = useState<Record<string, SportMeta>>({})
  const [metaErrors, setMetaErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [game, setGame] = useState<Game | null>(() => loadGame())
  const [selectedSport, setSelectedSport] = useState(() => loadSport() ?? DEFAULT_SPORT)
  const [rosters, setRosters] = useState<Record<string, RosterPlayer[]>>({})
  const [starting, setStarting] = useState(false)
  const [stats, setStats] = useState(() => loadStats())

  useEffect(() => {
    for (const s of SPORTS) {
      loadMeta(s.id)
        .then((m) => setMetas((all) => ({ ...all, [s.id]: m })))
        .catch((e: Error) => setMetaErrors((all) => ({ ...all, [s.id]: e.message })))
    }
  }, [])

  // Ein laufendes Spiel bestimmt die Sportart; ohne Daten für die gewählte auf eine vorhandene ausweichen
  const loadedSports = new Set(Object.keys(metas))
  const allSettled = SPORTS.every((s) => metas[s.id] || metaErrors[s.id])
  const fallbackSport = allSettled && !metas[selectedSport] ? SPORTS.find((s) => metas[s.id])?.id : undefined
  const sport = sportById(game?.sport ?? fallbackSport ?? selectedSport)
  const meta = metas[sport.id] ?? null

  // Nach einem Neuladen der Seite die Kader des laufenden Spiels wieder holen
  useEffect(() => {
    if (!game) return
    const missing = game.rounds.map((r) => r.teamId).filter((id) => !rosters[id])
    if (missing.length === 0) return
    loadRosters(game.sport, missing)
      .then((loaded) => setRosters((r) => ({ ...r, ...loaded })))
      .catch((e: Error) => setError(e.message))
  }, [game, rosters])

  useEffect(() => saveGame(game), [game])

  const teams = useMemo(() => new Map(meta?.teams.map((t) => [t.id, t]) ?? []), [meta])
  const categories = useMemo(() => new Map(meta?.categories.map((c) => [c.key, c]) ?? []), [meta])

  const changeSport = (id: string) => {
    setSelectedSport(id)
    saveSport(id)
  }

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
      const loaded = await loadRosters(sport.id, teamIds)
      setRosters((r) => ({ ...r, ...loaded }))
      setGame({
        id: crypto.randomUUID(),
        sport: sport.id,
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

  if (!meta && metaErrors[sport.id] && (allSettled || game)) {
    return (
      <main className="app">
        <h1>TotalGuesser</h1>
        <p className="error">
          Keine Daten gefunden ({metaErrors[sport.id]}). Zuerst <code>scripts/{sport.importScript}</code> ausführen.
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
            sport={sport}
            availableSports={loadedSports}
            onSportChange={changeSport}
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
          rosterNote={rosterNote(meta)}
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
