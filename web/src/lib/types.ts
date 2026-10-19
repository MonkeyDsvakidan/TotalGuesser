export type Scope = 'career' | 'team' | 'team_best_season'

export interface Category {
  key: string
  sport_id: string
  label: string
  scope: Scope
  unit: string | null
  enabled: boolean
}

export interface Team {
  id: string
  sport_id: string | null
  name: string
  short_name: string | null
  logo_url: string | null
  active: boolean
}
