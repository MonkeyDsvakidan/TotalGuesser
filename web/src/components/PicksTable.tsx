import { formatValue, revealOrder, totals } from '../game/logic'
import type { Game } from '../game/types'
import type { Team } from '../lib/types'

interface Props {
  game: Game
  teams: Map<string, Team>
  // Anzahl aufgedeckter Werte; undefined = keine Werte zeigen (während des Spiels)
  revealed?: number
}

export default function PicksTable({ game, teams, revealed }: Props) {
  const players = game.settings.players
  const order = revealOrder(game)
  const showValues = revealed !== undefined
  const sums = showValues ? totals(game, true) : null

  return (
    <div className="table-wrap">
      <table className="picks">
        <thead>
          <tr>
            <th scope="col">Runde</th>
            {players.map((name) => (
              <th key={name} scope="col">
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {game.rounds.map((round, r) => (
            <tr key={r}>
              <th scope="row">
                {r + 1}
                <span className="muted small"> {teams.get(round.teamId)?.short_name}</span>
              </th>
              {players.map((_, playerIndex) => {
                const pick = game.picks[r].find((p) => p.playerIndex === playerIndex)
                if (!pick) return <td key={playerIndex} className="muted">–</td>
                const isRevealed = showValues && order.indexOf(pick) < revealed
                return (
                  <td key={playerIndex}>
                    <div className={pick.rosterId ? '' : 'muted'}>{pick.name}</div>
                    {showValues && (
                      <div className={isRevealed ? 'value revealed' : 'value hidden'}>
                        {isRevealed ? formatValue(pick.value) : '?'}
                      </div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
        {sums && (
          <tfoot>
            <tr>
              <th scope="row">Summe</th>
              {sums.map((s, i) => (
                <td key={i} className="sum">
                  {formatValue(s)}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
