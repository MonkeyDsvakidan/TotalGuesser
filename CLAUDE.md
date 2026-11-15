# TotalGuesser – Hinweise für Claude

Private Spieleseite von Aladin Kermo (für ihn und Freunde): Ratespiel für 2–6 Spieler mit NBA- oder Fussballdaten. Ablauf und Datenaufbau stehen in `README.md` und `PLAN.md`.

- **Technik:** Frontend in `web/` (Vite + React + TypeScript). Keine Datenbank, keine Live-API: Ein Python-Skript in `scripts/` erzeugt vorher statische JSON-Dateien unter `web/public/data/<sport>/`.
- **Veröffentlichung:** GitHub Pages über `.github/workflows/pages.yml`, Push auf `main` = live. Der Workflow führt `npm ci`, `npm test` und `npm run build` aus.
- **Testen:** Spiellogik als reine Funktionen mit Vitest (`web/src/game/logic.test.ts`), ausführen in `web/` mit `npm test`. Oberfläche bei 375 px und 1280 px ansehen, hell und dunkel.
- **Spielstand** liegt im `localStorage` – beim Ändern des Formats alte Spielstände weiter lesen können (oder sauber verwerfen).
- Aladin programmiert nicht selbst: Erklärungen einfach halten, Deutsch (Schweiz, «ss» statt «ß»). Änderungen als Pull Request, ein PR pro Thema.

## Allgemeine Regeln (zusätzlich)

Zusätzlich zu dieser Datei gelten die Skills aus Aladins Konto: **webseiten-check** (hier Teil A Design und Teil C Sicherheit – privates Projekt), beim Programmieren **ponytail**, bei Design-Arbeiten **unslop** (unter `.claude/skills/`, falls vorhanden). Bei einem Widerspruch geht diese Datei vor. Ist unklar, welche Regel gilt, zuerst bei Aladin nachfragen.
