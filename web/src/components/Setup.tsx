import { useState } from 'react'
import type { Category } from '../lib/types'
import type { Settings } from '../game/types'
import type { PlayerRecord } from '../game/storage'

const MIN_PLAYERS = 2
const MAX_PLAYERS = 6

const DEFAULT_SETTINGS: Settings = {
  players: ['', ''],
  rounds: 5,
  categoryMode: 'fixed',
  categoryKey: null,
  rule: 'closest',
}

interface Props {
  categories: Category[]
  initial: Settings | null
  stats: Record<string, PlayerRecord>
  starting: boolean
  onStart: (settings: Settings) => void
}

export default function Setup({ categories, initial, stats, starting, onStart }: Props) {
  const [settings, setSettings] = useState<Settings>(initial ?? DEFAULT_SETTINGS)
  const update = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }))

  const names = settings.players.map((p) => p.trim())
  const duplicate = names.some((n, i) => n && names.indexOf(n) !== i)
  const valid = names.every(Boolean) && !duplicate

  const setName = (index: number, name: string) =>
    update({ players: settings.players.map((p, i) => (i === index ? name : p)) })

  const knownPlayers = Object.entries(stats).filter(([, r]) => r.games > 0)

  return (
    <form
      className="setup"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onStart({ ...settings, players: names })
      }}
    >
      <fieldset>
        <legend>Spieler</legend>
        {settings.players.map((name, i) => (
          <div className="row" key={i}>
            <input
              value={name}
              onChange={(e) => setName(i, e.target.value)}
              placeholder={`Spieler ${i + 1}`}
              aria-label={`Spieler ${i + 1}`}
              maxLength={20}
            />
            {settings.players.length > MIN_PLAYERS && (
              <button
                type="button"
                className="icon"
                aria-label={`Spieler ${i + 1} entfernen`}
                onClick={() => update({ players: settings.players.filter((_, j) => j !== i) })}
              >
                ×
              </button>
            )}
          </div>
        ))}
        {settings.players.length < MAX_PLAYERS && (
          <button type="button" className="secondary" onClick={() => update({ players: [...settings.players, ''] })}>
            + Spieler
          </button>
        )}
        {duplicate && <p className="error">Jeder Name nur einmal.</p>}
      </fieldset>

      <fieldset>
        <legend>Runden</legend>
        <div className="segmented">
          {[3, 5, 7, 10].map((n) => (
            <label key={n} className={settings.rounds === n ? 'on' : ''}>
              <input type="radio" name="rounds" checked={settings.rounds === n} onChange={() => update({ rounds: n })} />
              {n}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Kategorie</legend>
        <div className="segmented">
          <label className={settings.categoryMode === 'fixed' ? 'on' : ''}>
            <input type="radio" name="mode" checked={settings.categoryMode === 'fixed'} onChange={() => update({ categoryMode: 'fixed' })} />
            Fest für alle Runden
          </label>
          <label className={settings.categoryMode === 'mixed' ? 'on' : ''}>
            <input type="radio" name="mode" checked={settings.categoryMode === 'mixed'} onChange={() => update({ categoryMode: 'mixed' })} />
            Jede Runde neu
          </label>
        </div>
        {settings.categoryMode === 'fixed' && (
          <select
            value={settings.categoryKey ?? ''}
            onChange={(e) => update({ categoryKey: e.target.value || null })}
            aria-label="Kategorie"
          >
            <option value="">Zufällig</option>
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        )}
      </fieldset>

      <fieldset>
        <legend>Regel</legend>
        <div className="segmented">
          <label className={settings.rule === 'closest' ? 'on' : ''}>
            <input type="radio" name="rule" checked={settings.rule === 'closest'} onChange={() => update({ rule: 'closest' })} />
            Nur Nähe zählt
          </label>
          <label className={settings.rule === 'bust' ? 'on' : ''}>
            <input type="radio" name="rule" checked={settings.rule === 'bust'} onChange={() => update({ rule: 'bust' })} />
            Drüber = verloren
          </label>
        </div>
      </fieldset>

      <button type="submit" className="primary" disabled={!valid || starting}>
        {starting ? 'Lade Teams …' : 'Spiel starten'}
      </button>

      {knownPlayers.length > 0 && (
        <section className="stats">
          <h2>Bilanz</h2>
          <ul>
            {knownPlayers
              .sort(([, a], [, b]) => b.wins - a.wins || a.games - b.games)
              .map(([name, r]) => (
                <li key={name}>
                  <span>{name}</span>
                  <span className="muted">
                    {r.wins} {r.wins === 1 ? 'Sieg' : 'Siege'} aus {r.games}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      )}
    </form>
  )
}
