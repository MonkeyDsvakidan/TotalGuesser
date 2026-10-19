import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import type { Category } from './lib/types'

// Platzhalter: zeigt die Kategorien aus Supabase. Der Spielablauf (PLAN.md, Abschnitt 5) kommt als Nächstes.
export default function App() {
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    supabase
      .from('categories')
      .select('*')
      .eq('enabled', true)
      .order('key')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setCategories(data ?? [])
      })
  }, [])

  return (
    <main className="app">
      <h1>TotalGuesser</h1>
      <p className="lead">Team, Kategorie, Zielzahl – wer am nächsten dran ist, gewinnt.</p>

      {!supabase && <p className="note">Supabase ist nicht konfiguriert: <code>web/.env.local</code> anlegen (siehe <code>.env.example</code>).</p>}
      {error && <p className="note">Fehler beim Laden: {error}</p>}

      {categories.length > 0 && (
        <section>
          <h2>Kategorien</h2>
          <ul>
            {categories.map((c) => (
              <li key={c.key}>
                {c.label} <span className="scope">{c.scope}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
