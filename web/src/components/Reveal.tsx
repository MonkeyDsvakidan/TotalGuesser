import { useEffect, useState } from 'react'
import { formatValue, perfectLastPick, revealOrder, standings, totals } from '../game/logic'
import type { Game } from '../game/types'
import type { Category, RosterPlayer, Team } from '../lib/types'
import Icon from './Icon'
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

const COUNT_MS = 1400 // Zahl zählt hoch
const HOLD_MS = 900 // Ergebnis kurz stehen lassen, bevor der nächste Wert kommt

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function distanceText(total: number, target: number): string {
  if (total === target) return 'genau auf dem Ziel'
  return total < target ? `fehlen ${formatValue(target - total)}` : `${formatValue(total - target)} drüber`
}

// Spielstand-Tafel: Summe pro Spieler, Balken bis zum Ziel
function Scoreboard({ game, sums }: { game: Game; sums: number[] }) {
  const scale = Math.max(game.target, ...sums) * 1.05
  return (
    <ul className="scoreboard board" aria-label="Zwischenstand">
      {game.settings.players.map((name, i) => {
        const over = sums[i] > game.target
        return (
          <li key={name} className={over && game.settings.rule === 'bust' ? 'bust' : ''}>
            <div className="score-line">
              <span className="score-name">{name}</span>
              <span className="digits">{formatValue(sums[i])}</span>
            </div>
            <div className="bar" aria-hidden="true">
              <div className="bar-fill" style={{ transform: `scaleX(${sums[i] / scale})` }} />
              <div className="bar-target" style={{ left: `${(game.target / scale) * 100}%` }} />
            </div>
            <div className="board-hint">{distanceText(sums[i], game.target)}</div>
          </li>
        )
      })}
    </ul>
  )
}

export default function Reveal({ game, teams, categories, rosters, onRevealNext, onRevealAll, onRematch, onNewSetup }: Props) {
  const order = revealOrder(game)
  const done = game.revealed >= order.length
  const next = order[game.revealed]
  const lastRound = game.rounds[game.rounds.length - 1]
  const sums = totals(game, true)

  // Wert, der gerade hochzählt; erst danach wird er im Spielstand gespeichert
  const [counting, setCounting] = useState(false)
  const [shown, setShown] = useState(0)

  useEffect(() => {
    if (!counting || !next) return
    const value = next.value
    let frame = 0
    let hold = 0
    const finish = () => {
      setShown(value)
      hold = window.setTimeout(() => {
        setCounting(false)
        onRevealNext()
      }, HOLD_MS)
    }
    if (reducedMotion()) {
      finish()
    } else {
      const start = performance.now()
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / COUNT_MS)
        // Langsamer zum Schluss: die letzten Stellen machen die Spannung
        setShown(Math.round(value * (1 - (1 - p) ** 3) * 10) / 10)
        if (p < 1) frame = requestAnimationFrame(tick)
        else finish()
      }
      frame = requestAnimationFrame(tick)
    }
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(hold)
    }
    // next ändert sich erst nach onRevealNext, darum reicht counting
  }, [counting])

  const results = done ? standings(game) : []

  return (
    <div className="reveal">
      {!done && next && (
        <section className="turn">
          <div className="muted small num">
            Wert {game.revealed + 1} von {order.length}
          </div>
          <div className="reveal-card board">
            <div className="board-label">{game.settings.players[next.playerIndex]}</div>
            <div className="reveal-pick">{next.name}</div>
            <div className={`digits reveal-value${counting ? ' counting' : ''}`} aria-live="polite">
              {counting ? formatValue(shown) : '?'}
            </div>
            <div className="board-hint">
              steht bei {formatValue(sums[next.playerIndex])} · {distanceText(sums[next.playerIndex], game.target)}
            </div>
          </div>
          <div className="actions">
            <button type="button" className="primary big" disabled={counting} onClick={() => setCounting(true)}>
              {counting ? 'Wird aufgedeckt …' : 'Aufdecken'}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setCounting(false)
                onRevealAll()
              }}
            >
              Alle aufdecken
            </button>
          </div>
        </section>
      )}

      {done && (
        <section className="outcome">
          <h2>Ergebnis</h2>
          <ol className="standings">
            {results.map((s) => {
              const perfect = perfectLastPick(game, s.playerIndex, rosters[lastRound.teamId] ?? [])
              return (
                <li key={s.playerIndex} className={s.winner ? 'winner' : ''}>
                  <div className="standing-line">
                    <span className="rank digits">{s.rank}</span>
                    <span className="name">
                      {game.settings.players[s.playerIndex]}
                      {s.winner && <Icon name="trophy" label="Sieger" />}
                    </span>
                    <span className="total digits">{formatValue(s.total)}</span>
                  </div>
                  <div className="standing-meta muted small">
                    {s.distance === 0
                      ? 'Genau getroffen'
                      : `${s.over ? '+' : '−'}${formatValue(s.distance)}${game.settings.rule === 'bust' && s.over ? ' · drüber' : ''}`}
                    {perfect && perfect.total !== s.total && (
                      <>
                        {' · '}Perfekter letzter Pick: {perfect.player.name} ({formatValue(perfect.value)}) → {formatValue(perfect.total)}
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
          {results.every((s) => !s.winner) && <p className="muted">Alle über dem Ziel – niemand gewinnt.</p>}
          <p className="muted small">
            Kategorie{game.settings.categoryMode === 'mixed' ? 'n wechselnd' : `: ${categories.get(game.rounds[0].categoryKey)?.label}`}
            {game.settings.playoffs && ' · mit Playoffs'}
          </p>
          <div className="actions">
            <button type="button" className="primary big" onClick={onRematch}>
              Revanche
            </button>
            <button type="button" className="secondary" onClick={onNewSetup}>
              Neues Spiel einrichten
            </button>
          </div>
        </section>
      )}

      {!done && <Scoreboard game={game} sums={sums} />}

      <PicksTable game={game} teams={teams} revealed={game.revealed} />
    </div>
  )
}
