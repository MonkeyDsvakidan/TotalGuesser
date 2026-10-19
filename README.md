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

Läuft nur auf einem normalen PC: stats.nba.com blockiert Cloud-Server, auch GitHub Actions (getestet). Ein automatisches Update über GitHub ist deshalb nicht möglich.

```bash
cd scripts
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

python nba_import.py --limit 20       # kurzer Test
python nba_import.py --active-only    # nur aktive Spieler (~500 Anfragen)
python nba_import.py                  # alle Spieler (~5000 Anfragen, mehr als eine Stunde)
python nba_import.py --refresh-active # wöchentliches Update: aktive Spieler neu laden, Rest aus dem Cache
```

Antworten werden in `scripts/.cache/` gespeichert. Ein abgebrochener Lauf macht beim nächsten Start dort weiter. Danach die Dateien in `web/public/data/` committen und pushen – GitHub Pages veröffentlicht sie automatisch.

Festgelegt im Skript:
- Nur Regular Season.
- Saisons mit Trade (`TOT`-Zeilen) werden nicht doppelt gezählt.
- Franchise-Umzüge zählen als ein Team (Seattle SuperSonics = OKC Thunder), weil `nba_api` pro Franchise eine feste ID verwendet.

### 2. Frontend

```bash
cd web
npm install
npm run dev
npm test        # Tests der Spiellogik
```

### 3. Hosting (GitHub Pages)

Jeder Push auf `main` testet, baut und veröffentlicht die Seite automatisch (`.github/workflows/pages.yml`):
https://monkeydsvakidan.github.io/TotalGuesser/

Einmalig nötig: im Repo unter **Settings → Pages → Build and deployment → Source** «GitHub Actions» wählen.

## Spielablauf (Modus 1)

1. **Setup:** 2–6 Spieler, 3/5/7/10 Runden, Kategorie fest oder pro Runde neu, Regel «Nur Nähe zählt» oder «Drüber = verloren».
2. **Runden:** Pro Runde ein zufälliges aktives Team; Teams wiederholen sich erst, wenn alle dran waren. Die Reihenfolge rotiert jede Runde.
3. **Eingabe:** Suche nach Wortanfängen und Spitznamen, nur Spieler des Rundenteams. Bereits genannte Spieler sind ausgegraut. Passen zählt 0, «Rückgängig» nimmt den letzten Pick zurück.
4. **Auflösung:** Werte einzeln oder alle aufdecken, danach Rangliste, Abstand zum Ziel und der perfekte letzte Pick.
5. **Bilanz:** Siege pro Spielername werden im Browser gespeichert. Ein laufendes Spiel übersteht auch ein Neuladen der Seite.

## Stand

- [x] Datenformat (JSON statt Datenbank)
- [x] NBA-Import: Teams, Spieler, Team- und Karriere-Totals, beste Saison
- [x] Spiel-Frontend Modus 1 (ein Gerät)
- [ ] Career Highs (langsames Skript)
- [x] Automatische Zielzahl (Median pro Runde × 0.8–1.3)
- [ ] Wöchentliches Update (von Hand mit `--refresh-active`, GitHub Actions wird von der NBA blockiert)
- [ ] Fussball-Daten
- [ ] Online-Multiplayer
