import { formatValue, perfectLastPick, revealOrder, standings } from '../game/logic'
import type { Game } from '../game/types'
import type { Category, RosterPlayer, Team } from '../lib/types'
import PicksTable from './PicksTable'

interface Props {
  game: Game
  teams: Map<string, Team>
  categories: Map<string, Category>
  rosters: Record<string, RosterPlayer[]>
  onRevealNext: () => void
  onRevealAll: () => void
  onRematch: () => void
  onNewSetup: () => void
}

export default function Reveal({ game, teams, categories, rosters, onRevealNext, onRevealAll, onRematch, onNewSetup }: Props) {
  const order = revealOrder(game)
  const done = game.revealed >= order.length
  const next = order[game.revealed]
  const lastRound = game.rounds[game.rounds.length - 1]

  return (
    <div className="reveal">
      {!done && next && (
        <section className="turn">
          <div className="muted small">
            Wert {game.revealed + 1} von {order.length}
          </div>
          <h2>
            {game.settings.players[next.playerIndex]}: {next.name}
          </h2>
          <div className="actions">
            <button type="button" className="primary" onClick={onRevealNext}>
              Aufdecken
            </button>
            <button type="button" className="secondary" onClick={onRevealAll}>
              Alle aufdecken
            </button>
          </div>
        </section>
      )}

      <PicksTable game={game} teams={teams} revealed={game.revealed} />

      {done && (
        <section className="outcome">
          <h2>Ergebnis</h2>
          <ol className="standings">
            {standings(game).map((s) => {
              const perfect = perfectLastPick(game, s.playerIndex, rosters[lastRound.teamId] ?? [])
              return (
                <li key={s.playerIndex} className={s.winner ? 'winner' : ''}>
                  <div className="standing-line">
                    <span className="rank">{s.rank}.</span>
                    <span className="name">
                      {game.settings.players[s.playerIndex]}
                      {s.winner && (
                        <svg className="trophy" viewBox="0 0 24 24" width="18" height="18" role="img" aria-label="Sieger">
                          <path
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"
                          />
                        </svg>
                      )}
                    </span>
                    <span className="total">{formatValue(s.total)}</span>
                    <span className="muted small">
                      {s.distance === 0
                        ? 'genau getroffen!'
                        : `${s.over ? '+' : '−'}${formatValue(s.distance)}${game.settings.rule === 'bust' && s.over ? ' · drüber' : ''}`}
                    </span>
                  </div>
                  {perfect && perfect.total !== s.total && (
                    <div className="muted small perfect">
                      Perfekter letzter Pick: {perfect.player.name} ({formatValue(perfect.value)}) → {formatValue(perfect.total)}
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
          {standings(game).every((s) => !s.winner) && <p className="muted">Alle über dem Ziel – niemand gewinnt.</p>}
          <p className="muted small">
            Kategorie{game.settings.categoryMode === 'mixed' ? 'n wechselnd' : `: ${categories.get(game.rounds[0].categoryKey)?.label}`}
          </p>
          <div className="actions">
            <button type="button" className="primary" onClick={onRematch}>
              Revanche
            </button>
            <button type="button" className="secondary" onClick={onNewSetup}>
              Neues Spiel einrichten
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
