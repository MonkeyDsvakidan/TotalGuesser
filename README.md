# TotalGuesser

Ratespiel für 2–6 Spieler: Pro Runde gibt es ein **Team**, eine **Kategorie** und eine **Zielzahl**. Reihum nennt jeder einen Spieler, der für dieses Team gespielt hat. Nach 5 Runden werden die Werte addiert – wer am nächsten am Ziel ist, gewinnt.

Keine KI, keine Live-API und keine Datenbank im Spiel: Ein Skript sammelt die Daten vorher und schreibt sie als statische JSON-Dateien, die das Frontend nur lädt. Details im [Plan](PLAN.md).

## Aufbau

| Ordner | Inhalt |
|---|---|
| `scripts/` | Python-Import (NBA über `nba_api`) → JSON-Dateien |
| `scripts/aliases/` | Von Hand gepflegte Spitznamen (`SGA`, `KD`, …) |
| `web/` | Frontend (Vite + React + TypeScript) |
| `web/public/data/<sport>/` | Generierte Spieldaten |

## Daten

```
web/public/data/nba/
  meta.json                 Datenstand, Kategorien, Teams (mit Spielerzahl)
  teams/nba_<team-id>.json  Alle Spieler eines Teams mit Karriere- und Teamwerten
```

Das Frontend lädt pro Runde nur die Datei des Rundenteams. Ein Spieler ohne Wert in einer Kategorie zählt 0.

## Einrichtung

### 1. NBA-Daten erzeugen

Läuft lokal (stats.nba.com blockiert viele Cloud-Server).

```bash
cd scripts
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

python nba_import.py --limit 20       # kurzer Test
python nba_import.py --active-only    # nur aktive Spieler (~500 Anfragen)
python nba_import.py                  # alle Spieler (~5000 Anfragen, mehr als eine Stunde)
python nba_import.py --refresh-active # Update: aktive Spieler neu laden, Rest aus dem Cache
```

Antworten werden in `scripts/.cache/` gespeichert. Ein abgebrochener Lauf macht beim nächsten Start dort weiter. Danach die Dateien in `web/public/data/` committen.

Festgelegt im Skript:
- Nur Regular Season.
- Saisons mit Trade (`TOT`-Zeilen) werden nicht doppelt gezählt.
- Franchise-Umzüge zählen als ein Team (Seattle SuperSonics = OKC Thunder), weil `nba_api` pro Franchise eine feste ID verwendet.

### 2. Frontend

```bash
cd web
npm install
npm run dev
```

Für das Hosting reicht ein statischer Host (GitHub Pages, Netlify, Vercel): `npm run build` erzeugt `web/dist/`.

## Stand

- [x] Datenformat (JSON statt Datenbank)
- [x] NBA-Import: Teams, Spieler, Team- und Karriere-Totals, beste Saison
- [ ] Spiel-Frontend Modus 1 (ein Gerät)
- [ ] Career Highs (langsames Skript)
- [ ] Automatische Zielzahl
- [ ] Wöchentliches Update
- [ ] Fussball-Daten
- [ ] Online-Multiplayer
