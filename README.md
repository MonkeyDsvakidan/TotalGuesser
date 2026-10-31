# TotalGuesser

Ratespiel für 2–6 Spieler, mit NBA- oder Fussballdaten: Pro Runde gibt es ein **Team**, eine **Kategorie** und eine **Zielzahl**. Reihum nennt jeder einen Spieler, der für dieses Team gespielt hat. Nach 5 Runden werden die Werte addiert – wer am nächsten am Ziel ist, gewinnt.

Keine KI, keine Live-API und keine Datenbank im Spiel: Ein Skript sammelt die Daten vorher und schreibt sie als statische JSON-Dateien, die das Frontend nur lädt. Details im [Plan](PLAN.md).

## Aufbau

| Ordner | Inhalt |
|---|---|
| `scripts/` | Python-Import (NBA über `nba_api`, Fussball über den Transfermarkt-Datensatz) → JSON-Dateien |
| `scripts/aliases/` | Von Hand gepflegte Spitznamen (`SGA`, `KD`, …) |
| `web/` | Frontend (Vite + React + TypeScript) |
| `web/public/data/<sport>/` | Generierte Spieldaten |

## Daten

```
web/public/data/nba/
  meta.json                 Datenstand, Kategorien, Teams (mit Spielerzahl)
  teams/nba_<team-id>.json  Alle Spieler eines Teams mit Karriere- und Teamwerten
web/public/data/football/
  meta.json                 gleich aufgebaut, Kategorien mit eigenem Hinweis (hint)
  teams/fb_<verein-id>.json Alle Spieler eines Vereins (IDs von Transfermarkt)
```

Die Sportart wird im Setup gewählt; das Frontend lädt beim Start die `meta.json` aller Sportarten.

Das Frontend lädt pro Runde nur die Datei des Rundenteams. Ein Spieler ohne Wert in einer Kategorie zählt 0.

## Einrichtung

### 1. NBA-Daten erzeugen

Läuft nur auf einem normalen PC: stats.nba.com blockiert Cloud-Server, auch GitHub Actions (getestet). Ein automatisches Update über GitHub ist deshalb nicht möglich.

```bash
cd scripts
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

python nba_import.py --limit 20       # kurzer Test
python nba_import.py --active-only    # nur aktive Spieler (~1000 Anfragen, etwa 20–30 Minuten)
python nba_import.py                  # alle Spieler (~10'000 Anfragen, mehrere Stunden)
python nba_import.py --skip-highs     # ohne Career Highs (halb so viele Anfragen)
python nba_import.py --min-points 500 # Untergrenze ändern (Standard 1000 Karrierepunkte, 0 = alle)
python nba_import.py --refresh-active # wöchentliches Update: aktive Spieler neu laden, Rest aus dem Cache
```

Antworten werden in `scripts/.cache/` gespeichert. Ein abgebrochener Lauf macht beim nächsten Start dort weiter. Danach die Dateien in `web/public/data/` committen und pushen – GitHub Pages veröffentlicht sie automatisch.

Festgelegt im Skript:
- Nur Regular Season.
- Nur Spieler mit mindestens 1'000 Karrierepunkten kommen ins Spiel (`--min-points`), damit keine unbekannten Ergänzungsspieler im Kader sind.
- Career Highs (bestes Einzelspiel) kommen aus `PlayerProfileV2`. Fehlen sie für einen Spieler (z. B. sehr alte Saisons), zählt der Wert 0.
- Saisons mit Trade (`TOT`-Zeilen) werden nicht doppelt gezählt.
- Franchise-Umzüge zählen als ein Team (Seattle SuperSonics = OKC Thunder), weil `nba_api` pro Franchise eine feste ID verwendet.

### 2. Fussball-Daten erzeugen

Quelle ist der öffentliche Transfermarkt-Datensatz [dcaribou/transfermarkt-datasets](https://github.com/dcaribou/transfermarkt-datasets) (Lizenz CC0). Nur Python-Standardbibliothek, kein `pip install` nötig, Laufzeit etwa 20 Sekunden.

```bash
cd scripts
python football_import.py                  # CSV-Dateien laden (~55 MB, einmalig) und exportieren
python football_import.py --refresh        # neue Version des Datensatzes laden
python football_import.py --min-games 50   # Untergrenze ändern (Standard 30 erfasste Einsätze, 0 = alle)
```

Festgelegt im Skript:
- Vereine: alle, die seit 2012/13 in einer Top-5-Liga gespielt haben (Bundesliga, Premier League, LaLiga, Serie A, Ligue 1). Runden gibt es nur mit den Vereinen der aktuellen Saison.
- Gezählt werden alle erfassten Vereinsspiele: Liga, nationaler Pokal, Supercup und Europapokal. Spiele in zweiten Ligen und vor 2012/13 fehlen im Datensatz – Karriere- und Vereinswerte älterer Spieler sind deshalb kleiner als in Wirklichkeit, und «erste Saison» ist frühestens 2012.
- Länderspiele und Länderspieltore kommen aus dem Spielerprofil und gelten für die ganze Karriere. WM- und EM-Spiele zählen nicht zu den Vereinswerten.
- Vereinsnamen auf Deutsch und Kurznamen für die Tabelle stehen in `CLUB_NAMES` / `CLUB_SHORT_NAMES`.
- Spitznamen in `scripts/aliases/football.json`; Namen mit Umlaut sind automatisch auch mit ae/oe/ue suchbar («Mueller»).
- Der Datensatz wird zurzeit nicht mehr aktualisiert (Stand 6. Juli 2026, Saison 2025/26).

### 3. Frontend

```bash
cd web
npm install
npm run dev
npm test        # Tests der Spiellogik
```

### 4. Hosting (GitHub Pages)

Jeder Push auf `main` testet, baut und veröffentlicht die Seite automatisch (`.github/workflows/pages.yml`):
https://monkeydsvakidan.github.io/TotalGuesser/

Einmalig nötig: im Repo unter **Settings → Pages → Build and deployment → Source** «GitHub Actions» wählen.

### 5. Auf dem iPhone-Home-Bildschirm

Seite in Safari öffnen → Teilen-Knopf → **Zum Home-Bildschirm**. Das Spiel startet dann wie eine App ohne Safari-Leisten (Manifest und Icons in `web/public/`). Die Icons erzeugt `python scripts/make_icons.py` (braucht Pillow).

## Spielablauf (Modus 1)

1. **Setup:** Sportart (NBA oder Fussball), 2–6 Spieler, 3/5/7/10 Runden, Regel «Nur Nähe zählt» oder «Drüber = verloren». Kategorien sind getrennt in **Einzelnes Spiel** (Career Highs) und **Karriere & mehrere Spiele**; innerhalb der Gruppe fest oder pro Runde neu.
2. **Zielzahl:** Vor der ersten Runde wird der Vorschlag angezeigt; er lässt sich mit −/+ oder per Eingabe anpassen oder neu würfeln. Nach «Start» ist das Ziel fix.
3. **Runden:** Pro Runde ein zufälliges aktives Team; Teams wiederholen sich erst, wenn alle dran waren. Wer in Runde 1 beginnt, ist zufällig; danach rotiert die Reihenfolge jede Runde.
4. **Eingabe:** Suche nach Wortanfängen und Spitznamen, nur Spieler des Rundenteams. Bereits genannte Spieler sind ausgegraut. Passen zählt 0, «Rückgängig» nimmt den letzten Pick zurück.
5. **Auflösung:** Werte einzeln oder alle aufdecken, danach Rangliste, Abstand zum Ziel und der perfekte letzte Pick.
6. **Bilanz:** Siege pro Spielername werden im Browser gespeichert. Ein laufendes Spiel übersteht auch ein Neuladen der Seite.

## Stand

- [x] Datenformat (JSON statt Datenbank)
- [x] NBA-Import: Teams, Spieler, Team- und Karriere-Totals, beste Saison
- [x] Spiel-Frontend Modus 1 (ein Gerät)
- [x] Automatische Zielzahl: pro Runde das obere Viertel (75. Perzentil) der Stammspieler des Teams (≥ 50 Spiele fürs Team), summiert × Zufallsfaktor 0.8–1.3
- [x] Career Highs (Code fertig, Daten kommen mit dem nächsten Import)
- [ ] Wöchentliches Update (von Hand mit `--refresh-active`, GitHub Actions wird von der NBA blockiert)
- [x] Fussball-Daten (Top-5-Ligen ab 2012/13, Transfermarkt-Datensatz)
- [ ] Online-Multiplayer
