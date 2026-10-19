"""NBA-Import: schreibt Teams, Kategorien und Spielerwerte als statische JSON-Dateien.

Quelle ist nba_api (offizielle NBA-Statistiken). Gezählt wird nur die Regular Season.
Pro Spieler ist eine Anfrage nötig (PlayerCareerStats); Antworten werden in
scripts/.cache/ gespeichert, damit ein abgebrochener Lauf weitermachen kann.

Pro Spieler sind zwei Anfragen nötig: PlayerCareerStats (Saison-Totals) und
PlayerProfileV2 (Career Highs, also beste Einzelspiele).

Ausgabe (Standard: web/public/data/nba/):
    meta.json             Datenstand, Kategorien, Teams
    teams/<team_id>.json  alle Spieler eines Teams mit Karriere- und Teamwerten

Franchise-Umzüge: nba_api vergibt pro Franchise eine feste TEAM_ID
(z. B. Seattle SuperSonics = OKC Thunder). Umzüge werden deshalb zusammengefasst.

Beispiele:
    python nba_import.py --limit 50          # kurzer Test
    python nba_import.py --active-only       # nur aktive Spieler
    python nba_import.py                     # alle Spieler
    python nba_import.py --refresh-active    # wöchentliches Update
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
import time
import unicodedata
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from nba_api.stats.endpoints import playercareerstats, playerprofilev2
from nba_api.stats.static import players as static_players
from nba_api.stats.static import teams as static_teams

SPORT = "nba"
SCRIPTS_DIR = Path(__file__).parent
CACHE_DIR = SCRIPTS_DIR / ".cache"
ALIASES_FILE = SCRIPTS_DIR / "aliases" / "nba.json"
DEFAULT_OUT = SCRIPTS_DIR.parent / "web" / "public" / "data" / SPORT
REQUEST_PAUSE_S = 0.8

# scope: 'career' = ganze Karriere, 'team' = nur beim Rundenteam, 'team_best_season' = beste Saison beim Team
# group: 'single_game' = Wert aus einem einzelnen Spiel, 'multi_game' = Karriere, Saison oder Summe vieler Spiele
CATEGORIES = [
    {"key": "career_high_pts", "label": "Career High Punkte", "scope": "career", "group": "single_game", "unit": "Punkte"},
    {"key": "career_high_reb", "label": "Career High Rebounds", "scope": "career", "group": "single_game", "unit": "Rebounds"},
    {"key": "career_high_ast", "label": "Career High Assists", "scope": "career", "group": "single_game", "unit": "Assists"},
    {"key": "career_high_fg3m", "label": "Career High Dreier", "scope": "career", "group": "single_game", "unit": "Dreier"},
    {"key": "career_high_stl", "label": "Career High Steals", "scope": "career", "group": "single_game", "unit": "Steals"},
    {"key": "career_high_blk", "label": "Career High Blocks", "scope": "career", "group": "single_game", "unit": "Blocks"},
    {"key": "career_total_pts", "label": "Karriere-Punkte total", "scope": "career", "group": "multi_game", "unit": "Punkte"},
    {"key": "career_total_reb", "label": "Karriere-Rebounds total", "scope": "career", "group": "multi_game", "unit": "Rebounds"},
    {"key": "career_total_ast", "label": "Karriere-Assists total", "scope": "career", "group": "multi_game", "unit": "Assists"},
    {"key": "career_games", "label": "Karriere-Spiele", "scope": "career", "group": "multi_game", "unit": "Spiele"},
    {"key": "team_total_pts", "label": "Punkte für das Team", "scope": "team", "group": "multi_game", "unit": "Punkte"},
    {"key": "team_total_reb", "label": "Rebounds für das Team", "scope": "team", "group": "multi_game", "unit": "Rebounds"},
    {"key": "team_total_ast", "label": "Assists für das Team", "scope": "team", "group": "multi_game", "unit": "Assists"},
    {"key": "team_games", "label": "Spiele für das Team", "scope": "team", "group": "multi_game", "unit": "Spiele"},
    {"key": "team_seasons", "label": "Saisons beim Team", "scope": "team", "group": "multi_game", "unit": "Saisons"},
    {"key": "team_best_season_ppg", "label": "Bester Punkteschnitt einer Saison", "scope": "team_best_season", "group": "multi_game", "unit": "Punkte/Spiel"},
    {"key": "team_best_season_rpg", "label": "Bester Reboundschnitt einer Saison", "scope": "team_best_season", "group": "multi_game", "unit": "Rebounds/Spiel"},
    {"key": "team_best_season_apg", "label": "Bester Assistschnitt einer Saison", "scope": "team_best_season", "group": "multi_game", "unit": "Assists/Spiel"},
]

# STAT-Namen in PlayerProfileV2 -> Kategorie
CAREER_HIGH_STATS = {
    "PTS": "career_high_pts",
    "REB": "career_high_reb",
    "AST": "career_high_ast",
    "FG3M": "career_high_fg3m",
    "STL": "career_high_stl",
    "BLK": "career_high_blk",
}


def team_key(nba_team_id: int) -> str:
    return f"nba_{nba_team_id}"


def player_key(nba_player_id: int) -> str:
    return f"nba_{nba_player_id}"


def search_name(name: str) -> str:
    decomposed = unicodedata.normalize("NFKD", name)
    ascii_only = "".join(c for c in decomposed if not unicodedata.combining(c))
    return " ".join(ascii_only.lower().replace(".", "").replace("'", "").split())


def season_start(season_id: str) -> int:
    # '2003-04' -> 2003
    return int(season_id[:4])


def num(value) -> float:
    return float(value) if value is not None else 0.0


def clean(value: float) -> int | float:
    # 1600.0 -> 1600, damit die JSON-Dateien kleiner bleiben
    return int(value) if float(value).is_integer() else value


# --- nba_api ----------------------------------------------------------------


def fetch_cached(kind: str, player_id: int, load, refresh: bool, retries: int) -> list[dict]:
    """Antwort aus scripts/.cache/<kind>/ oder von stats.nba.com (mit Wiederholungen)."""
    cache_file = CACHE_DIR / kind / f"{player_id}.json"
    if cache_file.exists() and not refresh:
        return json.loads(cache_file.read_text())

    for attempt in range(retries):
        try:
            rows = load()
            break
        except Exception as exc:  # nba_api wirft je nach Fehler unterschiedliche Typen
            wait = 2 ** (attempt + 1)
            print(f"  Fehler bei Spieler {player_id} ({kind}): {exc} – neuer Versuch in {wait}s")
            time.sleep(wait)
    else:
        raise RuntimeError(f"Spieler {player_id} konnte nicht geladen werden ({kind})")

    cache_file.parent.mkdir(parents=True, exist_ok=True)
    cache_file.write_text(json.dumps(rows))
    time.sleep(REQUEST_PAUSE_S)
    return rows


def fetch_career(player_id: int, refresh: bool = False) -> list[dict]:
    """Saison-Totals der Regular Season."""
    return fetch_cached(
        "nba_career",
        player_id,
        lambda: playercareerstats.PlayerCareerStats(player_id=player_id, timeout=30)
        .get_normalized_dict()["SeasonTotalsRegularSeason"],
        refresh,
        retries=4,
    )


def fetch_career_highs(player_id: int, refresh: bool = False) -> list[dict]:
    """Beste Einzelspiele der Karriere (eine Zeile pro Statistik, bei Gleichstand mehrere)."""
    return fetch_cached(
        "nba_highs",
        player_id,
        lambda: playerprofilev2.PlayerProfileV2(player_id=player_id, timeout=30)
        .get_normalized_dict()
        .get("CareerHighs", []),
        refresh,
        retries=2,
    )


# --- Berechnung -------------------------------------------------------------


def compute_career_highs(rows: list[dict]) -> dict:
    """Career Highs als Kategoriewerte; fehlt eine Statistik (z. B. alte Saisons), bleibt sie weg."""
    highs: dict[str, float] = {}
    for r in rows:
        category = CAREER_HIGH_STATS.get(r.get("STAT"))
        if category and r.get("STAT_VALUE") is not None:
            highs[category] = max(highs.get(category, 0), num(r["STAT_VALUE"]))
    return {k: clean(v) for k, v in highs.items()}


def compute_player(seasons: list[dict]) -> tuple[dict, dict[int, dict]]:
    """Liefert (Karrierewerte, {NBA-Team-ID: Teameintrag}) für einen Spieler."""
    # TOT-Zeilen (Saison mit Trade) sind Summen der Team-Zeilen -> weglassen
    rows = [r for r in seasons if r["TEAM_ID"] and r["TEAM_ABBREVIATION"] != "TOT"]
    if not rows:
        return {}, {}

    career = {
        "career_total_pts": clean(sum(num(r["PTS"]) for r in rows)),
        "career_total_reb": clean(sum(num(r["REB"]) for r in rows)),
        "career_total_ast": clean(sum(num(r["AST"]) for r in rows)),
        "career_games": clean(sum(num(r["GP"]) for r in rows)),
    }

    by_team: dict[int, list[dict]] = defaultdict(list)
    for r in rows:
        by_team[r["TEAM_ID"]].append(r)

    teams: dict[int, dict] = {}
    for nba_team_id, team_rows in by_team.items():
        starts = [season_start(r["SEASON_ID"]) for r in team_rows]
        values = {
            "team_total_pts": clean(sum(num(r["PTS"]) for r in team_rows)),
            "team_total_reb": clean(sum(num(r["REB"]) for r in team_rows)),
            "team_total_ast": clean(sum(num(r["AST"]) for r in team_rows)),
            "team_games": clean(sum(num(r["GP"]) for r in team_rows)),
            "team_seasons": len(set(starts)),
        }
        played = [r for r in team_rows if num(r["GP"]) > 0]
        if played:
            for category, column in (
                ("team_best_season_ppg", "PTS"),
                ("team_best_season_rpg", "REB"),
                ("team_best_season_apg", "AST"),
            ):
                values[category] = clean(round(max(num(r[column]) / num(r["GP"]) for r in played), 1))

        teams[nba_team_id] = {
            "abbr": team_rows[-1]["TEAM_ABBREVIATION"],
            "first": min(starts),
            "last": max(starts),
            "values": values,
        }
    return career, teams


# --- Ausgabe ----------------------------------------------------------------


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


def load_aliases() -> dict[str, list[str]]:
    if not ALIASES_FILE.exists():
        return {}
    return json.loads(ALIASES_FILE.read_text(encoding="utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--active-only", action="store_true", help="nur aktive Spieler exportieren")
    parser.add_argument("--refresh-active", action="store_true", help="aktive Spieler neu laden statt aus dem Cache")
    parser.add_argument("--limit", type=int, help="höchstens N Spieler (zum Testen)")
    parser.add_argument("--skip-highs", action="store_true", help="keine Career Highs laden (halb so viele Anfragen)")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help=f"Zielordner (Standard: {DEFAULT_OUT})")
    args = parser.parse_args()

    selected = static_players.get_active_players() if args.active_only else static_players.get_players()
    if args.limit:
        selected = selected[: args.limit]
    aliases = load_aliases()

    teams = {
        t["id"]: {
            "id": team_key(t["id"]),
            "name": t["full_name"],
            "short_name": t["abbreviation"],
            "logo_url": f"https://cdn.nba.com/logos/nba/{t['id']}/global/L/logo.svg",
            "active": True,
        }
        for t in static_teams.get_teams()
    }
    rosters: dict[int, list[dict]] = defaultdict(list)
    load_highs = not args.skip_highs
    highs_failures = 0

    for i, pl in enumerate(selected, start=1):
        print(f"[{i}/{len(selected)}] {pl['full_name']}")
        try:
            seasons = fetch_career(pl["id"], refresh=args.refresh_active and pl["is_active"])
        except RuntimeError:
            if i == 1:
                sys.exit(
                    "stats.nba.com ist nicht erreichbar. Die NBA blockiert viele Cloud-Server "
                    "(auch GitHub Actions) – das Skript auf einem normalen PC ausführen."
                )
            raise
        career, player_teams = compute_player(seasons)

        if player_teams and load_highs:
            try:
                career.update(compute_career_highs(fetch_career_highs(pl["id"], refresh=args.refresh_active and pl["is_active"])))
                highs_failures = 0
            except RuntimeError as exc:
                # Career Highs sind ein Zusatz: ein einzelner Fehler bricht den Lauf nicht ab
                print(f"  {exc}")
                highs_failures += 1
                if highs_failures >= 5:
                    print("  Career Highs mehrmals hintereinander fehlgeschlagen – für diesen Lauf abgeschaltet.")
                    load_highs = False

        for nba_team_id, entry in player_teams.items():
            # Ehemalige Franchises (z. B. Baltimore Bullets) kennt static_teams nicht
            teams.setdefault(
                nba_team_id,
                {"id": team_key(nba_team_id), "name": entry["abbr"], "short_name": entry["abbr"], "logo_url": None, "active": False},
            )
            rosters[nba_team_id].append(
                {
                    "id": player_key(pl["id"]),
                    "name": pl["full_name"],
                    "search": search_name(pl["full_name"]),
                    "aliases": aliases.get(player_key(pl["id"]), []),
                    "active": pl["is_active"],
                    "first": entry["first"],
                    "last": entry["last"],
                    "values": {**career, **entry["values"]},
                }
            )

    # Alte Ausgabe ersetzen, damit keine verwaisten Teamdateien liegen bleiben
    shutil.rmtree(args.out / "teams", ignore_errors=True)
    for nba_team_id, roster in rosters.items():
        roster.sort(key=lambda p: p["search"])
        write_json(args.out / "teams" / f"{teams[nba_team_id]['id']}.json", roster)

    meta_teams = [
        {**team, "player_count": len(rosters[nba_team_id])}
        for nba_team_id, team in teams.items()
        if rosters.get(nba_team_id)
    ]
    meta_teams.sort(key=lambda t: (not t["active"], t["name"]))
    write_json(
        args.out / "meta.json",
        {
            "sport": SPORT,
            "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            # Kategorien ohne einen einzigen Wert (z. B. Career Highs mit --skip-highs) weglassen
            "categories": [
                c for c in CATEGORIES if any(c["key"] in p["values"] for roster in rosters.values() for p in roster)
            ],
            "teams": meta_teams,
        },
    )
    print(f"Fertig: {len(meta_teams)} Teams, {sum(len(r) for r in rosters.values())} Einträge in {args.out}")


if __name__ == "__main__":
    main()
