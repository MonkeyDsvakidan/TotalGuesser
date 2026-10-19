import { useEffect, useState } from 'react'
import { loadMeta } from './lib/data'
import type { SportMeta } from './lib/types'

// Platzhalter: zeigt Datenstand, Teams und Kategorien. Der Spielablauf (PLAN.md, Abschnitt 5) kommt als Nächstes.
export default function App() {
  const [meta, setMeta] = useState<SportMeta | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadMeta('nba')
      .then(setMeta)
      .catch((e: Error) => setError(e.message))
  }, [])

  return (
    <main className="app">
      <h1>TotalGuesser</h1>
      <p className="lead">Team, Kategorie, Zielzahl – wer am nächsten dran ist, gewinnt.</p>

      {error && (
        <p className="note">
          Keine Daten gefunden ({error}). Zuerst <code>scripts/nba_import.py</code> ausführen.
        </p>
      )}

      {meta && (
        <>
          <p className="note">
            Daten-Stand: {new Date(meta.updated_at).toLocaleDateString('de-CH')} · {meta.teams.length} Teams
          </p>
          <section>
            <h2>Kategorien</h2>
            <ul>
              {meta.categories.map((c) => (
                <li key={c.key}>
                  {c.label} <span className="scope">{c.scope}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  )
}
