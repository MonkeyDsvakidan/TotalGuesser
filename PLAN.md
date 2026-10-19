# Stat-Battle – Webgame-Plan

Ein Ratespiel für 2–6 Spieler. Pro Runde gibt das Spiel ein **Team**, eine **Kategorie** und eine **Zielzahl** vor. Jeder nennt reihum einen Spieler, der für dieses Team gespielt hat. Nach 5 Runden werden die Werte zusammengezählt – wer am nächsten am Ziel ist, gewinnt.

**Grundsatz:** Keine KI und keine Live-API während des Spiels. Alle Daten werden vorher gesammelt, gespeichert und im Spiel nur abgefragt.

> **Entscheidung (19.10.2026):** Statt Supabase werden die Daten als statische JSON-Dateien in `web/public/data/` gespeichert (siehe README). Das Datenmodell in Abschnitt 2 gilt sinngemäss weiter: Kategorien und Scopes bleiben gleich, die Werte liegen pro Team in einer Datei. Für den Online-Multiplayer (Modus 2) wird später ein Echtzeit-Dienst gewählt.

---

## 1. Kategorien

Damit *jede* Kategorie funktioniert, gibt es drei Arten (Scopes):

| Scope | Bedeutung | Beispiele Basketball | Beispiele Fussball |
|---|---|---|---|
| `career` | Über die ganze Karriere, egal bei welchem Team | Career High Punkte/Rebounds/Assists, Karriere-Punkte total, Anzahl Spiele, All-Star-Nominierungen, Titel | Karriere-Tore, Länderspiele, Titel |
| `team` | Nur die Zeit beim genannten Team | Punkte total für die Celtics, Spiele für die Bulls, Saisons beim Team | Tore total für den FC Bayern, Einsätze für Bayern |
| `team_best_season` | Beste Einzelsaison beim genannten Team | Höchster Punkteschnitt einer Saison bei den Lakers | Meiste Tore in einer Saison für Bayern |

Wichtig: Bei `career`-Kategorien zählt der Wert aus der ganzen Karriere (wie in unseren bisherigen Runden). Bei `team`-Kategorien zählt nur, was der Spieler für das Rundenteam gemacht hat.

---

## 2. Datenbank (Supabase / Postgres)

Ein generisches Modell: Jeder Wert ist eine Zeile in `stat_values`. So lassen sich neue Kategorien hinzufügen, ohne die Struktur zu ändern.

```sql
create table sports (
  id text primary key            -- 'nba', 'football'
);

create table teams (
  id text primary key,           -- z. B. 'nba_bos', 'fb_bayern'
  sport_id text references sports(id),
  name text not null,            -- 'Boston Celtics', 'FC Bayern München'
  short_name text,
  logo_url text,
  active boolean default true    -- nur aktive Teams für Runden vorschlagen
);

create table players (
  id text primary key,           -- ID aus der Quelle, z. B. 'nba_1628369'
  sport_id text references sports(id),
  full_name text not null,
  search_name text not null,     -- klein, ohne Akzente: 'luka doncic'
  aliases text[] default '{}',   -- 'SGA', 'KD', 'Manu' usw.
  is_active boolean
);

-- Welche Spieler haben für welches Team gespielt
create table player_teams (
  player_id text references players(id),
  team_id text references teams(id),
  first_season int,
  last_season int,
  primary key (player_id, team_id)
);

-- Kategorien
create table categories (
  key text primary key,          -- 'career_high_pts', 'team_total_pts', 'team_total_goals'
  sport_id text references sports(id),
  label text not null,           -- 'Career High Punkte'
  scope text not null check (scope in ('career','team','team_best_season')),
  unit text,                     -- 'Punkte', 'Tore', 'Spiele'
  enabled boolean default true
);

-- Alle Werte
create table stat_values (
  player_id text references players(id),
  category_key text references categories(key),
  team_id text references teams(id),   -- NULL bei scope 'career'
  value numeric not null,
  updated_at timestamptz default now(),
  primary key (player_id, category_key, team_id)
);
-- Hinweis: Postgres erlaubt NULL nicht im Primary Key.
-- Lösung: für career-Werte team_id = 'all' verwenden (ein Pseudo-Team 'all' anlegen).

create index on stat_values (category_key, team_id);
create index on players using gin (to_tsvector('simple', search_name));
```

**Wert für einen Spielzug abfragen:**

```sql
select value from stat_values
where player_id = $1
  and category_key = $2
  and team_id = case when $scope = 'career' then 'all' else $3 end;
```

**Gültigkeit prüfen:** Der Spieler muss in `player_teams` für das Rundenteam stehen und darf in diesem Spiel noch nicht genannt worden sein.

**Fehlende Werte:** Hat ein Spieler für das Team gespielt, aber keinen Wert in der Kategorie (z. B. 0 Tore), zählt 0. Das ist Teil der Strategie.

---

## 3. Zielzahl automatisch berechnen

Damit das Ziel zu Team und Kategorie passt, wird es aus den Daten abgeleitet statt fest vorgegeben:

1. Alle Werte für Kategorie + Team laden (`stat_values` × `player_teams`).
2. Median der Werte nehmen.
3. Ziel = Median × Anzahl Runden × Zufallsfaktor zwischen 0.8 und 1.3, sinnvoll gerundet.

Bei gemischten Runden (jede Runde anderes Team) wird pro Runde ein Median berechnet und aufsummiert.

Beispiel: Median Career High Rebounds liegt bei ~11 → Ziel um 55 (wie unser 54er-Spiel).

---

## 4. Datenbeschaffung (einmalig + regelmässiges Update)

Ein Python-Skript im Ordner `/scripts` holt die Daten und lädt sie per Supabase-Client hoch. Es läuft **lokal oder als geplanter Job**, nie im Spiel selbst.

### Basketball (NBA)

- Paket `nba_api` (greift auf die offiziellen NBA-Statistiken zu).
- `PlayerCareerStats` liefert pro Saison und Team die Totals (Punkte, Rebounds, Assists, Spiele usw.).
  - Daraus: `team_total_*` (Summe pro Team), `career_total_*` (Summe über alles), `team_best_season_*`.
  - Achtung: Zeilen mit Team `TOT` (Spieler wurde in einer Saison getradet) beim Summieren weglassen, sonst doppelt gezählt.
- Career Highs: über `PlayerGameLog` pro Saison das Maximum berechnen. Das sind sehr viele Abfragen → nur für Spieler ab einer Mindestanzahl Spiele, mit Pausen zwischen den Requests, Fortschritt zwischenspeichern.
- Franchise-Umzüge festlegen: z. B. Seattle SuperSonics → zählen als OKC Thunder oder als eigenes Team? Einmal entscheiden und im Skript fest abbilden.

### Fussball

- Schwieriger, weil gute Daten oft kostenpflichtig sind.
- Option A: Öffentliche Transfermarkt-Datensätze auf GitHub/Kaggle (Spieler, Vereine, Einsätze, Tore). Einschränkung: decken meist nur die letzten ~10–15 Jahre und die grossen Wettbewerbe ab. Legenden wie Gerd Müller fehlen dann.
- Option B: Kostenpflichtige API (z. B. API-Football) mit Free-Tier zum Testen.
- Option C: Für Klassiker (FC Bayern, Real, Barça) eine kleine eigene CSV mit den historischen Top-Spielern pflegen und ergänzen.
- Empfehlung: Erst Basketball fertig bauen, Fussball als zweiten Schritt.

### Updates

- Wöchentlicher Job (GitHub Action oder Supabase Edge Function mit Cron), der nur aktive Spieler neu berechnet.
- `updated_at` im Spiel anzeigen («Daten-Stand: 12.10.2026»), damit klar ist, wie aktuell die Werte sind.

---

## 5. Spielablauf (Frontend)

1. **Setup:** Sportart, Spielernamen, Anzahl Runden (Standard 5), Kategorie (fest für alle Runden oder pro Runde wechselnd), Regeln (nur Nähe zählt / wer drüber ist, verliert).
2. **Runde:** Team und Kategorie anzeigen, Ziel oben fixiert. Reihenfolge rotiert jede Runde.
3. **Eingabe:** Suchfeld mit Autovervollständigung, gefiltert auf Spieler dieses Teams. Bereits genannte Spieler ausgegraut.
4. **Werte verdeckt:** Während des Spiels keine Zahlen zeigen, nur die Namen in einer Tabelle.
5. **Auflösung:** Werte einzeln aufdecken (Animation), Summen, Abstand zum Ziel, Sieger. Optional: Wer wäre der «perfekte» Pick gewesen?
6. **Statistik über Partien hinweg:** Siegesbilanz pro Spieler (lokal im Browser oder in Supabase).

**Modus 1 (einfach):** Ein Gerät, wird herumgereicht.
**Modus 2 (später):** Jeder am eigenen Handy, Lobby mit Raumcode über Supabase Realtime.

---

## 6. Reihenfolge der Umsetzung

1. Supabase-Tabellen anlegen (Abschnitt 2).
2. NBA-Skript: Spieler, Teams, `player_teams` und Team-/Karriere-Totals (schnell, wenige Abfragen).
3. Spiel-Frontend Modus 1 mit diesen Kategorien.
4. Career Highs nachladen (langsames Skript).
5. Automatische Zielzahl.
6. Wöchentliches Update.
7. Fussball-Daten.
8. Online-Multiplayer.

---

## 7. Offene Entscheidungen

- Zählen Playoff-Werte mit oder nur Regular Season? (Vorschlag: nur Regular Season, wie die üblichen Career-High-Angaben.)
- Darf ein Team mehrmals in einem Spiel vorkommen?
- Franchise-Umzüge: zusammenfassen oder getrennt?
- Soll man im Fussball auch Nationalteams spielen können?
