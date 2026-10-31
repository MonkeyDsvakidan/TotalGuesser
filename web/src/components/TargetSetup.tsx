import { useState } from 'react'
import { formatValue, targetStep } from '../game/logic'
import type { Game } from '../game/types'
import type { Category, Team } from '../lib/types'
import PicksTable from './PicksTable'

interface Props {
  game: Game
  teams: Map<string, Team>
  categories: Map<string, Category>
  onTargetChange: (target: number) => void
  onReroll: () => void
  onStart: () => void
}

// Akzeptiert "1'200", "7,5" usw.; null = keine gültige Zielzahl
function parseTarget(text: string): number | null {
  const value = Number(text.replace(',', '.').replace(/['’\s]/g, ''))
  return text.trim() !== '' && Number.isFinite(value) && value > 0 ? value : null
}

// Vor der ersten Runde: Zielzahl übernehmen, anpassen oder neu würfeln; nach dem Start ist sie fix
export default function TargetSetup({ game, teams, categories, onTargetChange, onReroll, onStart }: Props) {
  const [draft, setDraft] = useState(String(game.target))
  const [shownTarget, setShownTarget] = useState(game.target)
  // Zielzahl wurde ausserhalb des Eingabefelds geändert (Knöpfe, neu würfeln)
  if (shownTarget !== game.target) {
    setShownTarget(game.target)
    setDraft(String(game.target))
  }

  const valid = parseTarget(draft) !== null
  const step = targetStep(game.target)

  const change = (value: number) => {
    const rounded = Math.max(step, Math.round(value / step) * step)
    onTargetChange(Math.round(rounded * 10) / 10)
  }

  const categoryKeys = [...new Set(game.rounds.map((r) => r.categoryKey))]

  return (
    <div className="play">
      <section className="turn target-setup">
        <h2>Zielzahl festlegen</h2>
        <p className="muted small">
          {categoryKeys.length === 1 ? categories.get(categoryKeys[0])?.label : 'Kategorie wechselt jede Runde'} ·{' '}
          {game.rounds.length} Runden
        </p>

        <div className="target-editor">
          <button type="button" className="icon" aria-label={`Ziel um ${formatValue(step)} senken`} onClick={() => change(game.target - step)}>
            −
          </button>
          <input
            type="text"
            inputMode="decimal"
            value={draft}
            aria-label="Zielzahl"
            onChange={(e) => {
              setDraft(e.target.value)
              const value = parseTarget(e.target.value)
              if (value !== null) {
                setShownTarget(value)
                onTargetChange(value)
              }
            }}
          />
          <button type="button" className="icon" aria-label={`Ziel um ${formatValue(step)} erhöhen`} onClick={() => change(game.target + step)}>
            +
          </button>
        </div>
        {!valid && <p className="error small">Bitte eine Zahl grösser als 0 eingeben.</p>}

        <p className="muted small">
          Vorschlag aus den Daten der Teams. Nach dem Start lässt sich das Ziel nicht mehr ändern.
        </p>
        <p>
          Es beginnt <strong>{game.settings.players[game.startPlayer ?? 0]}</strong>
        </p>

        <div className="actions">
          <button type="button" className="primary" disabled={!valid} onClick={onStart}>
            Start
          </button>
          <button type="button" className="secondary" onClick={onReroll}>
            Neu würfeln
          </button>
        </div>
      </section>

      <PicksTable game={game} teams={teams} />
    </div>
  )
}
