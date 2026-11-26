export type Scope = 'career' | 'team' | 'team_best_season'

// 'single_game' = Wert aus einem einzelnen Spiel (Career Highs), 'multi_game' = Karriere, Saison oder Summe
export type CategoryGroup = 'single_game' | 'multi_game'

export interface Category {
  key: string
  label: string
  scope: Scope
  group: CategoryGroup
  unit: string | null
  hint?: string // ersetzt den Standardhinweis zum Scope (z. B. Datenabdeckung beim Fussball)
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
  min_career_points?: number
  playoffs?: boolean // true = Spieler haben Playoff-Werte; fehlt bei älteren Daten
  roster_note?: string | null // wer ins Spiel kommt, z. B. "nur Spieler ab 15 erfassten Einsätzen"
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
  values: Record<string, number> // nur Regular Season
  playoffs?: Record<string, number> // Regular Season + Playoffs, nur Werte, die sich dadurch ändern
}
