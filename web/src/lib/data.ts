import type { RosterPlayer, SportMeta, Team } from './types'

const BASE = `${import.meta.env.BASE_URL}data`

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/${path}`)
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`)
  return res.json() as Promise<T>
}

export async function loadMeta(sport: string): Promise<SportMeta> {
  const meta = await getJson<SportMeta>(`${sport}/meta.json`)
  // Ältere Daten haben noch kein group-Feld
  for (const c of meta.categories) {
    c.group ??= c.key.startsWith('career_high_') ? 'single_game' : 'multi_game'
  }
  return meta
}

// Hinweis, wenn ein Spieler nicht gefunden wird; NBA-Daten haben nur min_career_points
export function rosterNote(meta: SportMeta): string | null {
  if (meta.roster_note) return meta.roster_note
  if (meta.min_career_points) return `nur Spieler ab ${meta.min_career_points.toLocaleString('en-US').replace(/,/g, "'")} Karrierepunkten`
  return null
}

export function loadRoster(sport: string, teamId: string): Promise<RosterPlayer[]> {
  return getJson(`${sport}/teams/${teamId}.json`)
}

// Fehlender Wert = 0 (z. B. ein Spieler ohne Spiel in dieser Saison), siehe PLAN.md
export function playerValue(player: RosterPlayer, categoryKey: string): number {
  return player.values[categoryKey] ?? 0
}

// Kurzer Name für Tabelle und Hinweise; NBA-Kürzel wie «BOS» sagen zu wenig, dann der volle Name
export function teamLabel(team: Team): string {
  return team.short_name && !/^[A-Z]{2,4}$/.test(team.short_name) ? team.short_name : team.name
}
