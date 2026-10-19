import type { RosterPlayer, SportMeta } from './types'

const BASE = `${import.meta.env.BASE_URL}data`

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/${path}`)
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`)
  return res.json() as Promise<T>
}

export function loadMeta(sport: string): Promise<SportMeta> {
  return getJson(`${sport}/meta.json`)
}

export function loadRoster(sport: string, teamId: string): Promise<RosterPlayer[]> {
  return getJson(`${sport}/teams/${teamId}.json`)
}

// Fehlender Wert = 0 (z. B. ein Spieler ohne Spiel in dieser Saison), siehe PLAN.md
export function playerValue(player: RosterPlayer, categoryKey: string): number {
  return player.values[categoryKey] ?? 0
}
