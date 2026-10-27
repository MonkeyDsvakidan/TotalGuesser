import type { CategoryGroup } from './types'

export interface Sport {
  id: string // Ordner unter public/data/
  label: string
  importScript: string
  groupDescriptions: Record<CategoryGroup, string>
}

export const SPORTS: Sport[] = [
  {
    id: 'nba',
    label: 'Basketball (NBA)',
    importScript: 'nba_import.py',
    groupDescriptions: {
      single_game: 'Career Highs – das beste Spiel eines Spielers',
      multi_game: 'Totals, Spiele, Saisons und Saisonschnitte',
    },
  },
  {
    id: 'football',
    label: 'Fussball (Top-5-Ligen)',
    importScript: 'football_import.py',
    groupDescriptions: {
      single_game: 'Tore, Vorlagen und Scorerpunkte im besten Spiel',
      multi_game: 'Tore, Vorlagen, Einsätze, Länderspiele und beste Saison',
    },
  },
]

export const DEFAULT_SPORT = SPORTS[0].id

export function sportById(id: string): Sport {
  return SPORTS.find((s) => s.id === id) ?? SPORTS[0]
}
