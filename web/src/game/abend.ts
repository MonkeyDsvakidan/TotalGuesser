// Abend-Rangliste über alle GameMaster-Spiele (Repo MusicBattle, ROADMAP «Gemeinsamer Raum über die Spiele»).
// Gemeinsamer Code liegt auf der Startseite: /abend.js (Repo monkeydsvakidan.github.io) → window.GMAbend.
// Gleiche Domain = gleicher localStorage. Fehlt das Skript (z. B. lokal mit `npm run dev`), passiert nichts.
import type { Game } from './types'
import { standings } from './logic'

export interface AbendPlace {
  name: string
  place: number
}
interface AbendState {
  games: { game: string; places: AbendPlace[] }[]
  names: string[]
}
interface GMAbendApi {
  load(): AbendState
  record(game: { id: string; game: string; places: AbendPlace[] }): AbendState
  summary(places: AbendPlace[]): string
}
const api = (): GMAbendApi | undefined => (window as unknown as { GMAbend?: GMAbendApi }).GMAbend

// /abend.js vor dem ersten Rendern laden (höchstens 1,5 s warten), damit die Namen im Setup schon da sind
export function loadAbendScript(): Promise<void> {
  return new Promise((resolve) => {
    const s = document.createElement('script')
    s.src = '/abend.js?v=1'
    s.onload = s.onerror = () => resolve()
    setTimeout(resolve, 1500)
    document.head.append(s)
  })
}

// Plätze für die Abend-Rangliste: Rang aus dem Endstand; bei «Drüber = raus» rückt, wer drüber ist,
// einen Platz nach hinten – so gewinnt niemand den Abend-Sieg, wenn alle drüber sind
export function abendPlaces(game: Game): AbendPlace[] {
  return standings(game).map((s) => ({
    name: game.settings.players[s.playerIndex],
    place: s.rank + (game.settings.rule === 'bust' && s.over ? 1 : 0),
  }))
}

export function recordAbend(game: Game): void {
  try {
    api()?.record({ id: `tg:${game.id}`, game: 'tg', places: abendPlaces(game) })
  } catch {
    // ohne Rangliste geht das Spiel trotzdem
  }
}

// «Heute Abend: Mia +3 · Leo +1» – leer, wenn /abend.js fehlt
export function abendSummary(game: Game): string {
  try {
    return api()?.summary(abendPlaces(game)) ?? ''
  } catch {
    return ''
  }
}

// Gruppe des letzten Spiels heute Abend (z. B. eben Music Battle gespielt) – nur wenn es kein TotalGuesser war
export function abendGroup(): string[] {
  try {
    const games = api()?.load().games ?? []
    const last = games[games.length - 1]
    return last && last.game !== 'tg' ? last.places.map((p) => p.name) : []
  } catch {
    return []
  }
}

// Alle Namen des Abends (für die Auswahlliste bei den Namensfeldern)
export function abendNames(): string[] {
  try {
    return api()?.load().names ?? []
  } catch {
    return []
  }
}
