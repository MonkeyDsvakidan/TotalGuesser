import { playerValue } from '../lib/data'
import type { RosterPlayer } from '../lib/types'
import type { Game, Pick, RoundSpec, Rule } from './types'

// Gleiche Normalisierung wie search_name im Import-Skript
export function normalize(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.']/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
}

// Jedes Wort der Eingabe muss ein Wortanfang im Namen sein ("leb jam" findet "lebron james")
function matchScore(query: string, player: RosterPlayer): number | null {
  const words = query.split(' ')
  const candidates = [player.search, ...player.aliases.map(normalize)]
  let best: number | null = null
  for (const candidate of candidates) {
    const tokens = candidate.split(' ')
    const ok = words.every((w) => tokens.some((t) => t.startsWith(w)))
    if (!ok) continue
    const score = candidate === query ? 0 : candidate.startsWith(query) ? 1 : 2
    best = best === null ? score : Math.min(best, score)
  }
  return best
}

export function searchRoster(roster: RosterPlayer[], input: string, limit = 8): RosterPlayer[] {
  const query = normalize(input)
  if (!query) return []
  return roster
    .map((player) => ({ player, score: matchScore(query, player) }))
    .filter((m): m is { player: RosterPlayer; score: number } => m.score !== null)
    .sort((a, b) => a.score - b.score || a.player.name.localeCompare(b.player.name))
    .slice(0, limit)
    .map((m) => m.player)
}

export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// Auf zwei signifikante Stellen runden: 54 -> 54, 1234 -> 1200, 7.3 -> 7.3
export function roundNicely(value: number): number {
  if (value <= 0) return 0
  const step = 10 ** (Math.floor(Math.log10(value)) - 1)
  return Math.round(value / step) * step
}

// Ziel = Summe der Mediane pro Runde × Zufallsfaktor 0.8–1.3 (PLAN.md, Abschnitt 3)
export function computeTarget(
  rounds: RoundSpec[],
  rosters: Record<string, RosterPlayer[]>,
  random: () => number = Math.random,
): number {
  const base = rounds.reduce((sum, round) => {
    const values = (rosters[round.teamId] ?? []).map((p) => playerValue(p, round.categoryKey))
    return sum + median(values)
  }, 0)
  const factor = 0.8 + random() * 0.5
  return Math.max(1, roundNicely(base * factor))
}

export function pickRandom<T>(items: T[], random: () => number = Math.random): T {
  return items[Math.floor(random() * items.length)]
}

// Verschiedene Teams pro Runde, solange genug Teams vorhanden sind
export function pickTeams(teamIds: string[], count: number, random: () => number = Math.random): string[] {
  const result: string[] = []
  let pool: string[] = []
  while (result.length < count) {
    if (pool.length === 0) pool = [...teamIds]
    const index = Math.floor(random() * pool.length)
    result.push(pool.splice(index, 1)[0])
  }
  return result
}

// Reihenfolge rotiert jede Runde: Runde 0 beginnt Spieler 0, Runde 1 Spieler 1, ...
export function turnOrder(roundIndex: number, playerCount: number): number[] {
  return Array.from({ length: playerCount }, (_, i) => (roundIndex + i) % playerCount)
}

export function currentTurn(game: Game): { round: number; playerIndex: number } | null {
  const n = game.settings.players.length
  const round = game.picks.findIndex((picks) => picks.length < n)
  if (round === -1) return null
  return { round, playerIndex: turnOrder(round, n)[game.picks[round].length] }
}

export function namedIds(game: Game): Set<string> {
  return new Set(game.picks.flat().flatMap((p) => (p.rosterId ? [p.rosterId] : [])))
}

// Alle Picks in Aufdeck-Reihenfolge (Runde für Runde)
export function revealOrder(game: Game): Pick[] {
  return game.picks.flat()
}

export function totals(game: Game, revealedOnly = false): number[] {
  const sums = game.settings.players.map(() => 0)
  const picks = revealOrder(game)
  const visible = revealedOnly ? picks.slice(0, game.revealed) : picks
  for (const pick of visible) sums[pick.playerIndex] += pick.value
  return sums.map((s) => Math.round(s * 10) / 10)
}

export interface Standing {
  playerIndex: number
  total: number
  distance: number
  over: boolean
  rank: number // 1 = Sieger; bei Gleichstand gleicher Rang
  winner: boolean
}

export function standings(game: Game): Standing[] {
  const rule: Rule = game.settings.rule
  const list = totals(game).map((total, playerIndex) => ({
    playerIndex,
    total,
    distance: Math.round(Math.abs(total - game.target) * 10) / 10,
    over: total > game.target,
  }))
  // Bei 'bust' kommen alle, die drüber sind, hinter alle anderen
  const key = (s: (typeof list)[number]) => (rule === 'bust' && s.over ? 1e12 : 0) + s.distance
  list.sort((a, b) => key(a) - key(b))

  let rank = 0
  let lastKey: number | null = null
  return list.map((s, i) => {
    if (key(s) !== lastKey) rank = i + 1
    lastKey = key(s)
    const winner = rank === 1 && !(rule === 'bust' && s.over)
    return { ...s, rank, winner }
  })
}

// Bester mögliche letzte Pick: was hätte der Spieler in der letzten Runde nennen sollen?
export function perfectLastPick(
  game: Game,
  playerIndex: number,
  roster: RosterPlayer[],
): { player: RosterPlayer; value: number; total: number } | null {
  const lastRound = game.rounds.length - 1
  const own = game.picks[lastRound].find((p) => p.playerIndex === playerIndex)
  if (!own) return null
  const before = totals(game)[playerIndex] - own.value
  const taken = namedIds(game)
  if (own.rosterId) taken.delete(own.rosterId)

  const categoryKey = game.rounds[lastRound].categoryKey
  let best: { player: RosterPlayer; value: number; total: number } | null = null
  for (const player of roster) {
    if (taken.has(player.id)) continue
    const value = playerValue(player, categoryKey)
    const total = before + value
    if (game.settings.rule === 'bust' && total > game.target) continue
    if (!best || Math.abs(game.target - total) < Math.abs(game.target - best.total)) {
      best = { player, value, total: Math.round(total * 10) / 10 }
    }
  }
  return best
}

export function formatValue(value: number): string {
  return value.toLocaleString('de-CH', { maximumFractionDigits: 1 })
}
