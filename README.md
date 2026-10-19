# TotalGuesser

Ratespiel für 2–6 Spieler: Pro Runde gibt es ein **Team**, eine **Kategorie** und eine **Zielzahl**. Reihum nennt jeder einen Spieler, der für dieses Team gespielt hat. Nach 5 Runden werden die Werte addiert – wer am nächsten am Ziel ist, gewinnt.

Keine KI und keine Live-API im Spiel: Alle Daten werden vorher gesammelt, in Supabase gespeichert und im Spiel nur abgefragt. Details im [Plan](PLAN.md).

## Aufbau

| Ordner | Inhalt |
|---|---|
| `supabase/migrations/` | Datenbankschema und NBA-Kategorien |
| `scripts/` | Python-Import (NBA über `nba_api`) |
| `web/` | Frontend (Vite + React + TypeScript) |

## Einrichtung

### 1. Datenbank

Migrationen im Supabase-Projekt einspielen, z. B. mit der Supabase CLI:

```bash
supabase link --project-ref <projekt-ref>
supabase db push
```

Oder den Inhalt der Dateien in `supabase/migrations/` der Reihe nach im SQL-Editor ausführen.

### 2. NBA-Daten importieren

Läuft lokal (stats.nba.com blockiert viele Cloud-Server).

```bash
cd scripts
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY eintragen

python nba_import.py --limit 20       # kurzer Test
python nba_import.py --active-only    # aktive Spieler (~500 Anfragen)
python nba_import.py                  # alle Spieler (~5000 Anfragen, mehr als eine Stunde)
```

Antworten werden in `scripts/.cache/` gespeichert. Ein abgebrochener Lauf macht beim nächsten Start dort weiter.

Festgelegt im Skript:
- Nur Regular Season.
- Saisons mit Trade (`TOT`-Zeilen) werden nicht doppelt gezählt.
- Franchise-Umzüge zählen als ein Team (Seattle SuperSonics = OKC Thunder), weil `nba_api` pro Franchise eine feste ID verwendet.

### 3. Frontend

```bash
cd web
npm install
cp .env.example .env.local   # Projekt-URL und Publishable Key eintragen
npm run dev
```

## Stand

- [x] Supabase-Schema
- [x] NBA-Import: Teams, Spieler, `player_teams`, Team- und Karriere-Totals
- [ ] Spiel-Frontend Modus 1 (ein Gerät)
- [ ] Career Highs (langsames Skript)
- [ ] Automatische Zielzahl
- [ ] Wöchentliches Update
- [ ] Fussball-Daten
- [ ] Online-Multiplayer
