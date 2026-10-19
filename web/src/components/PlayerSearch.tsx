import { useEffect, useRef, useState } from 'react'
import { searchRoster } from '../game/logic'
import type { RosterPlayer } from '../lib/types'

interface Props {
  roster: RosterPlayer[]
  taken: Set<string>
  onPick: (player: RosterPlayer) => void
}

export default function PlayerSearch({ roster, taken, onPick }: Props) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const results = searchRoster(roster, query)
  const firstFree = results.find((p) => !taken.has(p.id))

  useEffect(() => {
    inputRef.current?.focus()
  }, [roster])

  const pick = (player: RosterPlayer) => {
    onPick(player)
    setQuery('')
    inputRef.current?.focus()
  }

  return (
    <div className="search">
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && firstFree) {
            e.preventDefault()
            pick(firstFree)
          }
        }}
        placeholder="Spielername …"
        aria-label="Spieler suchen"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
      {query && (
        <ul className="results" role="listbox">
          {results.length === 0 && <li className="muted empty">Kein Spieler dieses Teams gefunden</li>}
          {results.map((p) => {
            const used = taken.has(p.id)
            return (
              <li key={p.id}>
                <button type="button" disabled={used} onClick={() => pick(p)}>
                  <span>{p.name}</span>
                  <span className="muted">
                    {used ? 'schon genannt' : p.first === p.last ? `${p.first}` : `${p.first}–${p.last}`}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
