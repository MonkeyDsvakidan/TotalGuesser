import { useState } from 'react'
import type { Category, CategoryGroup, Scope } from '../lib/types'
import type { Settings } from '../game/types'
import type { PlayerRecord } from '../game/storage'
import { SPORTS, type Sport } from '../lib/sports'

const MIN_PLAYERS = 2
const MAX_PLAYERS = 6

const DEFAULT_SETTINGS: Settings = {
  players: ['', ''],
  rounds: 5,
  categoryGroup: 'multi_game',
  categoryMode: 'fixed',
  categoryKey: null,
  rule: 'closest',
}

const GROUPS: { id: CategoryGroup; title: string }[] = [
  { id: 'single_game', title: 'Einzelnes Spiel' },
  { id: 'multi_game', title: 'Karriere & mehrere Spiele' },
]

const SCOPE_TITLES: Record<Scope, string> = {
  career: 'Ganze Karriere (alle Teams)',
  team: 'Nur beim Rundenteam',
  team_best_season: 'Beste Saison beim Rundenteam',
}

interface Props {
  sport: Sport
  availableSports: Set<string> // Sportarten, für die Daten vorhanden sind
  onSportChange: (sport: string) => void
  categories: Category[]
  initial: Partial<Settings> | null
  stats: Record<string, PlayerRecord>
  starting: boolean
  onStart: (settings: Settings) => void
}

export default function Setup({ sport, availableSports, onSportChange, categories, initial, stats, starting, onStart }: Props) {
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS, ...initial })
  const update = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }))

  const groupCategories = categories.filter((c) => c.group === settings.categoryGroup)
  // Gespeicherte Kategorie aus einer anderen Gruppe nicht übernehmen
  const selectedKey = groupCategories.some((c) => c.key === settings.categoryKey) ? settings.categoryKey : null
  const scopes = [...new Set(groupCategories.map((c) => c.scope))]

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
        if (valid) onStart({ ...settings, categoryKey: selectedKey, players: names })
      }}
    >
      <fieldset>
        <legend>Sportart</legend>
        <div className="segmented">
          {SPORTS.map((s) => {
            const available = availableSports.has(s.id)
            return (
              <label key={s.id} className={`${sport.id === s.id ? 'on' : ''}${available ? '' : ' disabled'}`}>
                <input
                  type="radio"
                  name="sport"
                  checked={sport.id === s.id}
                  disabled={!available}
                  onChange={() => onSportChange(s.id)}
                />
                {s.label}
              </label>
            )
          })}
        </div>
      </fieldset>

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
        <div className="groups" role="radiogroup" aria-label="Art der Kategorie">
          {GROUPS.map((g) => {
            const available = categories.some((c) => c.group === g.id)
            return (
              <label key={g.id} className={`group-card${settings.categoryGroup === g.id ? ' on' : ''}${available ? '' : ' disabled'}`}>
                <input
                  type="radio"
                  name="group"
                  checked={settings.categoryGroup === g.id}
                  disabled={!available}
                  onChange={() => update({ categoryGroup: g.id, categoryKey: null })}
                />
                <span className="group-title">{g.title}</span>
                <span className="muted small">{available ? sport.groupDescriptions[g.id] : 'Noch keine Daten – kommt mit dem nächsten Import'}</span>
              </label>
            )
          })}
        </div>

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
          <div className="category-list" role="radiogroup" aria-label="Kategorie">
            <div className="chips">
              <label className={selectedKey === null ? 'on' : ''}>
                <input type="radio" name="category" checked={selectedKey === null} onChange={() => update({ categoryKey: null })} />
                Zufällig
              </label>
            </div>
            {scopes.map((scope) => (
              <div key={scope}>
                {scopes.length > 1 && <div className="scope-title muted small">{SCOPE_TITLES[scope]}</div>}
                <div className="chips">
                  {groupCategories
                    .filter((c) => c.scope === scope)
                    .map((c) => (
                      <label key={c.key} className={selectedKey === c.key ? 'on' : ''}>
                        <input type="radio" name="category" checked={selectedKey === c.key} onChange={() => update({ categoryKey: c.key })} />
                        {c.label}
                      </label>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {settings.categoryMode === 'mixed' && (
          <p className="muted small">Jede Runde eine zufällige Kategorie aus «{GROUPS.find((g) => g.id === settings.categoryGroup)?.title}».</p>
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
