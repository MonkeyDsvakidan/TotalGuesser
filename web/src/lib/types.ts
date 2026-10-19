export type Scope = 'career' | 'team' | 'team_best_season'

export interface Category {
  key: string
  label: string
  scope: Scope
  unit: string | null
}

export interface Team {
  id: string
  name: string
  short_name: string | null
  logo_url: string | null
  active: boolean
  player_count: number
}

export interface SportMeta {
  sport: string
  updated_at: string
  categories: Category[]
  teams: Team[]
}

// Ein Spieler im Kader eines Teams; values enthält Karriere- und Teamwerte
export interface RosterPlayer {
  id: string
  name: string
  search: string
  aliases: string[]
  active: boolean
  first: number
  last: number
  values: Record<string, number>
}
