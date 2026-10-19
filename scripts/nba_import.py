"""NBA-Import: Teams, Spieler, player_teams sowie Team- und Karriere-Totals.

Quelle ist nba_api (offizielle NBA-Statistiken). Gezählt wird nur die Regular Season.
Pro Spieler ist eine Anfrage nötig (PlayerCareerStats); Antworten werden in
scripts/.cache/ gespeichert, damit ein abgebrochener Lauf weitermachen kann.

Franchise-Umzüge: nba_api vergibt pro Franchise eine feste TEAM_ID
(z. B. Seattle SuperSonics = OKC Thunder). Umzüge werden deshalb zusammengefasst.

Beispiele:
    python nba_import.py --active-only
    python nba_import.py --limit 50
    python nba_import.py --player-id 2544
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import unicodedata
from collections import defaultdict
from pathlib import Path

from dotenv import load_dotenv
from nba_api.stats.endpoints import playercareerstats
from nba_api.stats.static import players as static_players
from nba_api.stats.static import teams as static_teams
from supabase import Client, create_client

SPORT = "nba"
CAREER_TEAM = "all"
CACHE_DIR = Path(__file__).parent / ".cache" / "nba_career"
REQUEST_PAUSE_S = 0.8
UPSERT_CHUNK = 500
FLUSH_EVERY_PLAYERS = 50


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


# --- Supabase ---------------------------------------------------------------


def supabase_client() -> Client:
    load_dotenv(Path(__file__).parent / ".env")
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY fehlen (siehe scripts/.env.example).")
    return create_client(url, key)


def upsert(db: Client, table: str, rows: list[dict], on_conflict: str) -> None:
    for i in range(0, len(rows), UPSERT_CHUNK):
        db.table(table).upsert(rows[i : i + UPSERT_CHUNK], on_conflict=on_conflict).execute()


# --- nba_api ----------------------------------------------------------------


def fetch_career(player_id: int, retries: int = 4) -> list[dict]:
    """Saison-Totals der Regular Season, aus dem Cache oder von stats.nba.com."""
    cache_file = CACHE_DIR / f"{player_id}.json"
    if cache_file.exists():
        return json.loads(cache_file.read_text())

    for attempt in range(retries):
        try:
            data = playercareerstats.PlayerCareerStats(player_id=player_id, timeout=30)
            rows = data.get_normalized_dict()["SeasonTotalsRegularSeason"]
            break
        except Exception as exc:  # nba_api wirft je nach Fehler unterschiedliche Typen
            wait = 2 ** (attempt + 1)
            print(f"  Fehler bei Spieler {player_id}: {exc} – neuer Versuch in {wait}s")
            time.sleep(wait)
    else:
        raise RuntimeError(f"Spieler {player_id} konnte nicht geladen werden")

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_file.write_text(json.dumps(rows))
    time.sleep(REQUEST_PAUSE_S)
    return rows


# --- Berechnung -------------------------------------------------------------


def compute_player(pid: int, seasons: list[dict]) -> tuple[list[dict], list[dict], dict[int, str]]:
    """Liefert (player_teams, stat_values, {NBA-Team-ID: Kürzel}) für einen Spieler."""
    # TOT-Zeilen (Saison mit Trade) sind Summen der Team-Zeilen -> weglassen
    rows = [r for r in seasons if r["TEAM_ID"] and r["TEAM_ABBREVIATION"] != "TOT"]
    if not rows:
        return [], [], {}

    by_team: dict[int, list[dict]] = defaultdict(list)
    for r in rows:
        by_team[r["TEAM_ID"]].append(r)

    p = player_key(pid)
    stats: list[dict] = []

    def stat(category: str, team: str, value: float) -> None:
        stats.append({"player_id": p, "category_key": category, "team_id": team, "value": value})

    stat("career_total_pts", CAREER_TEAM, sum(num(r["PTS"]) for r in rows))
    stat("career_total_reb", CAREER_TEAM, sum(num(r["REB"]) for r in rows))
    stat("career_total_ast", CAREER_TEAM, sum(num(r["AST"]) for r in rows))
    stat("career_games", CAREER_TEAM, sum(num(r["GP"]) for r in rows))

    links: list[dict] = []
    for nba_team_id, team_rows in by_team.items():
        t = team_key(nba_team_id)
        starts = [season_start(r["SEASON_ID"]) for r in team_rows]
        links.append({"player_id": p, "team_id": t, "first_season": min(starts), "last_season": max(starts)})

        stat("team_total_pts", t, sum(num(r["PTS"]) for r in team_rows))
        stat("team_total_reb", t, sum(num(r["REB"]) for r in team_rows))
        stat("team_total_ast", t, sum(num(r["AST"]) for r in team_rows))
        stat("team_games", t, sum(num(r["GP"]) for r in team_rows))
        stat("team_seasons", t, len(set(starts)))

        played = [r for r in team_rows if num(r["GP"]) > 0]
        if played:
            for category, column in (
                ("team_best_season_ppg", "PTS"),
                ("team_best_season_rpg", "REB"),
                ("team_best_season_apg", "AST"),
            ):
                best = max(num(r[column]) / num(r["GP"]) for r in played)
                stat(category, t, round(best, 1))

    return links, stats, {tid: team_rows[-1]["TEAM_ABBREVIATION"] for tid, team_rows in by_team.items()}


# --- Ablauf -----------------------------------------------------------------


def import_teams(db: Client) -> dict[int, dict]:
    teams = {}
    for t in static_teams.get_teams():
        teams[t["id"]] = {
            "id": team_key(t["id"]),
            "sport_id": SPORT,
            "name": t["full_name"],
            "short_name": t["abbreviation"],
            "logo_url": f"https://cdn.nba.com/logos/nba/{t['id']}/global/L/logo.svg",
            "active": True,
        }
    upsert(db, "teams", list(teams.values()), "id")
    print(f"{len(teams)} aktuelle Teams gespeichert")
    return teams


def import_players(db: Client, selected: list[dict]) -> None:
    rows = [
        {
            "id": player_key(pl["id"]),
            "sport_id": SPORT,
            "full_name": pl["full_name"],
            "search_name": search_name(pl["full_name"]),
            "is_active": pl["is_active"],
        }
        for pl in selected
    ]
    # aliases bewusst nicht überschreiben: die werden von Hand gepflegt
    upsert(db, "players", rows, "id")
    print(f"{len(rows)} Spieler gespeichert")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--active-only", action="store_true", help="nur aktive Spieler")
    parser.add_argument("--limit", type=int, help="höchstens N Spieler (zum Testen)")
    parser.add_argument("--player-id", type=int, action="append", help="nur diese NBA-Spieler-ID(s)")
    args = parser.parse_args()

    db = supabase_client()
    known_teams = import_teams(db)

    selected = static_players.get_active_players() if args.active_only else static_players.get_players()
    if args.player_id:
        wanted = set(args.player_id)
        selected = [pl for pl in static_players.get_players() if pl["id"] in wanted]
    if args.limit:
        selected = selected[: args.limit]
    import_players(db, selected)

    pending_links: list[dict] = []
    pending_stats: list[dict] = []

    def flush() -> None:
        upsert(db, "player_teams", pending_links, "player_id,team_id")
        upsert(db, "stat_values", pending_stats, "player_id,category_key,team_id")
        pending_links.clear()
        pending_stats.clear()

    for i, pl in enumerate(selected, start=1):
        print(f"[{i}/{len(selected)}] {pl['full_name']}")
        links, stats, team_abbrs = compute_player(pl["id"], fetch_career(pl["id"]))

        # Ehemalige Franchises (z. B. Baltimore Bullets) kennt static_teams nicht
        new_teams = {tid: abbr for tid, abbr in team_abbrs.items() if tid not in known_teams}
        if new_teams:
            rows = []
            for tid, abbr in new_teams.items():
                known_teams[tid] = {
                    "id": team_key(tid),
                    "sport_id": SPORT,
                    "name": abbr,
                    "short_name": abbr,
                    "active": False,
                }
                rows.append(known_teams[tid])
            upsert(db, "teams", rows, "id")

        pending_links.extend(links)
        pending_stats.extend(stats)
        if i % FLUSH_EVERY_PLAYERS == 0:
            flush()

    flush()
    print("Fertig.")


if __name__ == "__main__":
    main()
