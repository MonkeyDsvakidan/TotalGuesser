import type { CategoryGroup } from '../lib/types'

export type Rule = 'closest' | 'bust'

export interface Settings {
  players: string[]
  rounds: number
  categoryGroup: CategoryGroup
  // 'fixed' = eine Kategorie für alle Runden, 'mixed' = pro Runde zufällig aus der Gruppe
  categoryMode: 'fixed' | 'mixed'
  categoryKey: string | null // nur bei 'fixed'; null = zufällig
  rule: Rule
}

export interface RoundSpec {
  teamId: string
  categoryKey: string
}

export interface Pick {
  playerIndex: number
  rosterId: string | null // null = gepasst
  name: string
  value: number
}

export interface Game {
  id: string
  sport: string
  settings: Settings
  rounds: RoundSpec[]
  target: number
  picks: Pick[][] // pro Runde, in Zugreihenfolge
  phase: 'play' | 'reveal'
  revealed: number // Anzahl aufgedeckter Picks
}
