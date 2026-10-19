import { describe, expect, it } from 'vitest'
import type { RosterPlayer } from '../lib/types'
import {
  computeTarget,
  currentTurn,
  percentile,
  normalize,
  perfectLastPick,
  pickTeams,
  roundNicely,
  searchRoster,
  standings,
  totals,
  turnOrder,
} from './logic'
import type { Game, Pick } from './types'

function player(id: string, name: string, values: Record<string, number> = {}, aliases: string[] = []): RosterPlayer {
  return { id, name, search: normalize(name), aliases, active: false, first: 2000, last: 2005, values }
}

function game(picks: Pick[][], overrides: Partial<Game> = {}): Game {
  return {
    id: 'g1',
    sport: 'nba',
    settings: { players: ['Anna', 'Ben'], rounds: picks.length, categoryGroup: 'multi_game', categoryMode: 'fixed', categoryKey: 'pts', rule: 'closest' },
    rounds: picks.map((_, i) => ({ teamId: `t${i}`, categoryKey: 'pts' })),
    target: 50,
    picks,
    phase: 'reveal',
    revealed: 0,
    ...overrides,
  }
}

const pick = (playerIndex: number, value: number, rosterId: string | null = `p${playerIndex}-${value}`): Pick => ({
  playerIndex,
  rosterId,
  name: rosterId ?? 'gepasst',
  value,
})

describe('normalize', () => {
  it('entfernt Akzente, Punkte und Apostrophe', () => {
    expect(normalize('  Luka Dončić ')).toBe('luka doncic')
    expect(normalize("Shaquille O'Neal")).toBe('shaquille oneal')
    expect(normalize('P.J. Tucker')).toBe('pj tucker')
  })
})

describe('searchRoster', () => {
  const roster = [
    player('1', 'LeBron James'),
    player('2', 'Mike James'),
    player('3', 'Shai Gilgeous-Alexander', {}, ['SGA']),
    player('4', 'Luka Dončić'),
  ]

  it('findet über Wortanfänge', () => {
    expect(searchRoster(roster, 'leb jam').map((p) => p.id)).toEqual(['1'])
    expect(searchRoster(roster, 'james').map((p) => p.id)).toEqual(['1', '2'])
  })

  it('findet über Spitznamen und ohne Akzente', () => {
    expect(searchRoster(roster, 'sga').map((p) => p.id)).toEqual(['3'])
    expect(searchRoster(roster, 'doncic').map((p) => p.id)).toEqual(['4'])
  })

  it('liefert nichts für leere Eingabe', () => {
    expect(searchRoster(roster, '  ')).toEqual([])
  })
})

describe('Zielzahl', () => {
  it('percentile', () => {
    expect(percentile([3, 1, 2], 0.5)).toBe(2)
    expect(percentile([4, 1, 2, 3], 0.5)).toBe(2.5)
    expect(percentile([1, 2, 3, 4, 5], 0.75)).toBe(4)
    expect(percentile([], 0.75)).toBe(0)
  })

  it('roundNicely rundet auf zwei signifikante Stellen', () => {
    expect(roundNicely(54.4)).toBe(54)
    expect(roundNicely(1234)).toBe(1200)
    expect(roundNicely(7.34)).toBeCloseTo(7.3)
  })

  it('nimmt das obere Viertel der Stammspieler, fehlende Werte zählen 0', () => {
    const regular = (id: string, pts?: number) => player(id, id, { team_games: 100, ...(pts === undefined ? {} : { pts }) })
    const rosters = {
      // 5 Stammspieler (einer ohne Wert = 0) und ein Kurzzeit-Spieler, der nicht zählt
      t0: [regular('a', 10), regular('b', 20), regular('c', 30), regular('d', 40), regular('e'), player('f', 'F', { pts: 999, team_games: 3 })],
      // zu wenige Stammspieler: alle zählen
      t1: [player('g', 'G', { pts: 20 }), player('h', 'H', { pts: 40 })],
    }
    const rounds = [
      { teamId: 't0', categoryKey: 'pts' },
      { teamId: 't1', categoryKey: 'pts' },
    ]
    // t0: [0, 10, 20, 30, 40] -> 30; t1: [20, 40] -> 35; Faktor 0.8 + 0.4 * 0.5 = 1.0
    expect(computeTarget(rounds, rosters, () => 0.4)).toBe(65)
  })
})

describe('pickTeams', () => {
  it('wiederholt Teams erst, wenn alle dran waren', () => {
    const teams = pickTeams(['a', 'b', 'c'], 5, () => 0)
    expect(teams).toEqual(['a', 'b', 'c', 'a', 'b'])
  })
})

describe('Zugreihenfolge', () => {
  it('rotiert jede Runde', () => {
    expect(turnOrder(0, 3)).toEqual([0, 1, 2])
    expect(turnOrder(1, 3)).toEqual([1, 2, 0])
  })

  it('currentTurn findet den nächsten Spieler', () => {
    expect(currentTurn(game([[], []]))).toEqual({ round: 0, playerIndex: 0 })
    expect(currentTurn(game([[pick(0, 1), pick(1, 1)], []]))).toEqual({ round: 1, playerIndex: 1 })
    expect(currentTurn(game([[pick(0, 1), pick(1, 1)], [pick(1, 1), pick(0, 1)]]))).toBeNull()
  })
})

describe('Auswertung', () => {
  const picks = [
    [pick(0, 20), pick(1, 30)],
    [pick(1, 25), pick(0, 28)],
  ]

  it('totals, auch nur aufgedeckte', () => {
    expect(totals(game(picks))).toEqual([48, 55])
    expect(totals(game(picks, { revealed: 3 }), true)).toEqual([20, 55])
  })

  it('nur Nähe zählt', () => {
    const [first, second] = standings(game(picks))
    expect(first).toMatchObject({ playerIndex: 0, distance: 2, winner: true })
    expect(second).toMatchObject({ playerIndex: 1, distance: 5, over: true, winner: false })
  })

  it('drüber = verloren', () => {
    const g = game(picks, { target: 54 })
    const closest = standings({ ...g, settings: { ...g.settings, rule: 'closest' } })
    expect(closest[0].playerIndex).toBe(1)
    const bust = standings({ ...g, settings: { ...g.settings, rule: 'bust' } })
    expect(bust[0]).toMatchObject({ playerIndex: 0, winner: true })
  })

  it('alle drüber: niemand gewinnt', () => {
    const g = game(picks, { target: 40 })
    expect(standings({ ...g, settings: { ...g.settings, rule: 'bust' } }).some((s) => s.winner)).toBe(false)
  })

  it('Gleichstand: beide gewinnen', () => {
    const tie = game([[pick(0, 45), pick(1, 55)]])
    expect(standings(tie).filter((s) => s.winner)).toHaveLength(2)
  })
})

describe('perfectLastPick', () => {
  it('sucht den besten freien Spieler der letzten Runde', () => {
    const roster = [
      player('x', 'X', { pts: 2 }),
      player('y', 'Y', { pts: 31 }),
      player('z', 'Z', { pts: 30 }),
      player('p1-25', 'Genannt', { pts: 25 }),
    ]
    const g = game([
      [pick(0, 20), pick(1, 30)],
      [pick(1, 25), pick(0, 28, 'p0-28')],
    ])
    // Anna hat 20 vor der letzten Runde, Ziel 50 -> 30 wäre perfekt
    expect(perfectLastPick(g, 0, roster)).toMatchObject({ value: 30, total: 50 })
    // Ben hat 30, braucht 20: sein eigener Pick (25 -> 55) bleibt erlaubt und ist der beste
    expect(perfectLastPick(g, 1, roster)?.player.id).toBe('p1-25')
  })

  it('respektiert die Drüber-Regel', () => {
    const roster = [player('a', 'A', { pts: 31 }), player('b', 'B', { pts: 25 })]
    // Anna hat 20 vor der letzten Runde: 31 -> 51 ist am nächsten, aber drüber
    const g = game([[pick(0, 20), pick(1, 1)], [pick(1, 1), pick(0, 1)]], { target: 50 })
    expect(perfectLastPick(g, 0, roster)?.value).toBe(31)
    expect(perfectLastPick({ ...g, settings: { ...g.settings, rule: 'bust' } }, 0, roster)?.value).toBe(25)
  })
})
