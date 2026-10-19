import { currentTurn, namedIds } from '../game/logic'
import type { Game } from '../game/types'
import type { Category, RosterPlayer, Team } from '../lib/types'
import PicksTable from './PicksTable'
import PlayerSearch from './PlayerSearch'
import RoundHeader from './RoundHeader'

interface Props {
  game: Game
  teams: Map<string, Team>
  categories: Map<string, Category>
  rosters: Record<string, RosterPlayer[]>
  minCareerPoints?: number
  onPick: (player: RosterPlayer | null) => void
  onUndo: () => void
  onReveal: () => void
}

export default function Play({ game, teams, categories, rosters, minCareerPoints, onPick, onUndo, onReveal }: Props) {
  const turn = currentTurn(game)
  const anyPick = game.picks.some((p) => p.length > 0)

  return (
    <div className="play">
      {turn ? (
        <section className="turn">
          <div className="muted small">
            Runde {turn.round + 1} von {game.rounds.length}
          </div>
          <RoundHeader
            team={teams.get(game.rounds[turn.round].teamId)!}
            category={categories.get(game.rounds[turn.round].categoryKey)!}
          />
          <h2 className="whose-turn">{game.settings.players[turn.playerIndex]} ist dran</h2>
          <PlayerSearch
            roster={rosters[game.rounds[turn.round].teamId] ?? []}
            taken={namedIds(game)}
            onPick={onPick}
            minCareerPoints={minCareerPoints}
          />
          <div className="actions">
            <button type="button" className="secondary" onClick={() => onPick(null)}>
              Passen (zählt 0)
            </button>
            {anyPick && (
              <button type="button" className="secondary" onClick={onUndo}>
                Rückgängig
              </button>
            )}
          </div>
        </section>
      ) : (
        <section className="turn done">
          <h2>Alle Runden gespielt</h2>
          <p className="muted">Jetzt werden die Werte aufgedeckt.</p>
          <div className="actions">
            <button type="button" className="primary" onClick={onReveal}>
              Auflösung starten
            </button>
            <button type="button" className="secondary" onClick={onUndo}>
              Rückgängig
            </button>
          </div>
        </section>
      )}

      <PicksTable game={game} teams={teams} />
    </div>
  )
}
