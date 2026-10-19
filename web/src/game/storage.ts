import type { Game, Settings } from './types'
import { standings } from './logic'

// Alles nur im Browser; Speicherfehler (privater Modus usw.) werden ignoriert
const GAME_KEY = 'totalguesser.game'
const STATS_KEY = 'totalguesser.stats'
const SETTINGS_KEY = 'totalguesser.lastSettings'

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ohne Speicher geht das Spiel trotzdem
  }
}

export const loadGame = () => read<Game>(GAME_KEY)
export const saveGame = (game: Game | null) => write(GAME_KEY, game)

export const loadLastSettings = () => read<Partial<Settings>>(SETTINGS_KEY)
export const saveLastSettings = (settings: Settings) => write(SETTINGS_KEY, settings)

export interface PlayerRecord {
  games: number
  wins: number
}
interface StatsStore {
  counted: string[] // Spiel-IDs, die schon gezählt wurden
  players: Record<string, PlayerRecord>
}

export function loadStats(): Record<string, PlayerRecord> {
  return read<StatsStore>(STATS_KEY)?.players ?? {}
}

export function recordResult(game: Game): void {
  const store = read<StatsStore>(STATS_KEY) ?? { counted: [], players: {} }
  if (store.counted.includes(game.id)) return
  const winners = new Set(standings(game).filter((s) => s.winner).map((s) => s.playerIndex))
  game.settings.players.forEach((name, i) => {
    const key = name.trim()
    const record = store.players[key] ?? { games: 0, wins: 0 }
    store.players[key] = { games: record.games + 1, wins: record.wins + (winners.has(i) ? 1 : 0) }
  })
  store.counted = [...store.counted.slice(-50), game.id]
  write(STATS_KEY, store)
}
