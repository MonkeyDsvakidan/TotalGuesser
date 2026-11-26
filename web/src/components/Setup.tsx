import { useState } from 'react'
import type { Category, CategoryGroup, Scope } from '../lib/types'
import type { Settings } from '../game/types'
import type { PlayerRecord } from '../game/storage'
import { SPORTS, type Sport } from '../lib/sports'
import Icon from './Icon'

const MIN_PLAYERS = 2
const MAX_PLAYERS = 6

const DEFAULT_SETTINGS: Settings = {
  players: ['', ''],
  rounds: 5,
  categoryGroup: 'multi_game',
  categoryMode: 'fixed',
  categoryKey: null,
  rule: 'closest',
  playoffs: false,
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
  playoffsAvailable: boolean // Daten enthalten Playoff-Werte
  initial: Partial<Settings> | null
  stats: Record<string, PlayerRecord>
  starting: boolean
  onStart: (settings: Settings) => void
}

export default function Setup({ sport, availableSports, onSportChange, categories, playoffsAvailable, initial, stats, starting, onStart }: Props) {
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

  const groupTitle = GROUPS.find((g) => g.id === settings.categoryGroup)?.title
  const categoryText =
    settings.categoryMode === 'mixed'
      ? 'Kategorie jede Runde neu'
      : (groupCategories.find((c) => c.key === selectedKey)?.label ?? 'Kategorie zufällig')
  const withPlayoffs = Boolean(sport.hasPlayoffs && playoffsAvailable && settings.playoffs)
  const summary = `${settings.rounds} Runden · ${categoryText} · ${settings.rule === 'bust' ? 'Drüber = verloren' : 'Nur Nähe zählt'}${withPlayoffs ? ' · Mit Playoffs' : ''}`

  const knownPlayers = Object.entries(stats).filter(([, r]) => r.games > 0)

  return (
    <form
      className="setup"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onStart({ ...settings, categoryKey: selectedKey, players: names })
      }}
    >
      <div className="setup-main">
        <fieldset className="step">
          <legend>
            <span className="step-no">1</span>Sportart
          </legend>
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

        <fieldset className="step">
          <legend>
            <span className="step-no">2</span>Spieler
          </legend>
          <div className="players">
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
                    <Icon name="x" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {settings.players.length < MAX_PLAYERS && (
            <button type="button" className="secondary add" onClick={() => update({ players: [...settings.players, ''] })}>
              <Icon name="plus" />
              Spieler
            </button>
          )}
          {duplicate && <p className="error small">Jeder Name nur einmal.</p>}
        </fieldset>

        <fieldset className="step">
          <legend>
            <span className="step-no">3</span>Kategorie
          </legend>
          <div className="groups">
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
        </fieldset>

        <details className="more">
          <summary>
            <span className="more-title">
              Mehr Optionen
              <Icon name="chevron" />
            </span>
            <span className="muted small">{summary}</span>
          </summary>

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
            <legend>Kategorie aus «{groupTitle}»</legend>
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
            {settings.categoryMode === 'mixed' && <p className="muted small">Jede Runde eine zufällige Kategorie aus «{groupTitle}».</p>}
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

          {sport.hasPlayoffs && (
            <fieldset disabled={!playoffsAvailable}>
              <legend>Playoffs</legend>
              <div className="segmented">
                <label className={`${withPlayoffs ? '' : 'on'}${playoffsAvailable ? '' : ' disabled'}`}>
                  <input type="radio" name="playoffs" checked={!withPlayoffs} onChange={() => update({ playoffs: false })} />
                  Nur Regular Season
                </label>
                <label className={`${withPlayoffs ? 'on' : ''}${playoffsAvailable ? '' : ' disabled'}`}>
                  <input type="radio" name="playoffs" checked={withPlayoffs} onChange={() => update({ playoffs: true })} />
                  Mit Playoffs
                </label>
              </div>
              <p className="muted small">
                {playoffsAvailable
                  ? 'Mit Playoffs zählen Totals, Spiele, Saisonschnitte und Career Highs inklusive Playoff-Spiele.'
                  : 'Noch keine Playoff-Daten – kommen mit dem nächsten NBA-Import.'}
              </p>
            </fieldset>
          )}
        </details>
      </div>

      {/* Start: am Computer rechts neben den Schritten, auf dem Handy über der Leiste fixiert, sobald alle Namen da sind */}
      <div className={`setup-start${valid ? ' ready' : ''}`}>
        <p className="setup-summary">
          <strong>
            {sport.label} · {settings.players.length} Spieler
          </strong>
          <span className="muted small">{summary}</span>
        </p>
        <button type="submit" className="primary big" disabled={!valid || starting}>
          {starting ? 'Lade Teams …' : 'Spiel starten'}
        </button>
        {!valid && !duplicate && <p className="muted small hint">Alle Spielernamen eintragen, dann geht es los.</p>}
      </div>

      {knownPlayers.length > 0 && (
        <section className="stats">
          <h2>Bilanz</h2>
          <ul>
            {knownPlayers
              .sort(([, a], [, b]) => b.wins - a.wins || a.games - b.games)
              .map(([name, r]) => (
                <li key={name}>
                  <span>{name}</span>
                  <span className="muted num">
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
