"""Fussball-Import: schreibt Vereine, Kategorien und Spielerwerte als statische JSON-Dateien.

Quelle ist der öffentliche Transfermarkt-Datensatz (dcaribou/transfermarkt-datasets, CC0):
https://github.com/dcaribou/transfermarkt-datasets
Er enthält jeden Einsatz in den grossen Ligen, nationalen Pokalen und Europapokalen ab der
Saison 2012/13. Ältere Spiele (Gerd Müller usw.) fehlen, deshalb zählen Karrierewerte nur
die erfassten Spiele. Länderspiele und Länderspieltore kommen aus dem Spielerprofil und
decken die ganze Karriere ab.

Die CSV-Dateien (~55 MB) werden einmal nach scripts/.cache/football/ geladen; --refresh lädt
sie neu. Ins Spiel kommen alle Vereine, die seit 2012/13 in einer der Top-5-Ligen gespielt
haben; Runden gibt es nur mit Vereinen der aktuellen Saison.

Ausgabe (Standard: web/public/data/football/):
    meta.json             Datenstand, Kategorien, Vereine
    teams/<team_id>.json  alle Spieler eines Vereins mit Karriere- und Vereinswerten

Beispiele:
    python football_import.py                  # Daten laden (falls nötig) und exportieren
    python football_import.py --refresh        # neue Version des Datensatzes laden
    python football_import.py --min-games 50   # Untergrenze ändern (Standard 30 Einsätze)
"""

from __future__ import annotations

import argparse
import csv
import gzip
import json
import shutil
import unicodedata
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

SPORT = "football"
SCRIPTS_DIR = Path(__file__).parent
CACHE_DIR = SCRIPTS_DIR / ".cache" / "football"
ALIASES_FILE = SCRIPTS_DIR / "aliases" / "football.json"
DEFAULT_OUT = SCRIPTS_DIR.parent / "web" / "public" / "data" / SPORT
SOURCE_URL = "https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data"
TABLES = ("competitions", "clubs", "players", "games", "appearances")
LOGO_URL = "https://tmssl.akamaized.net/images/wappen/head/{club_id}.png"

# Bundesliga, Premier League, LaLiga, Serie A, Ligue 1
LEAGUES = ("L1", "GB1", "ES1", "IT1", "FR1")
# Untergrenze fürs Niveau: wer weniger erfasste Einsätze hat, kommt nicht ins Spiel
DEFAULT_MIN_GAMES = 30

COVERAGE_HINT = "Alle erfassten Spiele seit 2012/13 (Liga, Pokal, Europapokal) – zählt über alle Vereine"

# scope und group wie im NBA-Import; hint ersetzt im Frontend den Standardhinweis zur Kategorie
CATEGORIES = [
    {"key": "career_high_goals", "label": "Meiste Tore in einem Spiel", "scope": "career", "group": "single_game", "unit": "Tore",
     "hint": "Bestes Einzelspiel seit 2012/13 – zählt über alle Vereine"},
    {"key": "career_high_assists", "label": "Meiste Vorlagen in einem Spiel", "scope": "career", "group": "single_game", "unit": "Vorlagen",
     "hint": "Bestes Einzelspiel seit 2012/13 – zählt über alle Vereine"},
    {"key": "career_high_points", "label": "Meiste Scorerpunkte in einem Spiel", "scope": "career", "group": "single_game", "unit": "Scorerpunkte",
     "hint": "Tore + Vorlagen im besten Einzelspiel seit 2012/13 – zählt über alle Vereine"},
    {"key": "career_goals", "label": "Karriere-Tore", "scope": "career", "group": "multi_game", "unit": "Tore", "hint": COVERAGE_HINT},
    {"key": "career_assists", "label": "Karriere-Vorlagen", "scope": "career", "group": "multi_game", "unit": "Vorlagen", "hint": COVERAGE_HINT},
    {"key": "career_games", "label": "Karriere-Einsätze", "scope": "career", "group": "multi_game", "unit": "Einsätze", "hint": COVERAGE_HINT},
    {"key": "international_caps", "label": "Länderspiele", "scope": "career", "group": "multi_game", "unit": "Länderspiele",
     "hint": "Ganze Karriere laut Transfermarkt-Profil"},
    {"key": "international_goals", "label": "Länderspieltore", "scope": "career", "group": "multi_game", "unit": "Tore",
     "hint": "Ganze Karriere laut Transfermarkt-Profil"},
    {"key": "team_goals", "label": "Tore für den Verein", "scope": "team", "group": "multi_game", "unit": "Tore"},
    {"key": "team_assists", "label": "Vorlagen für den Verein", "scope": "team", "group": "multi_game", "unit": "Vorlagen"},
    {"key": "team_games", "label": "Einsätze für den Verein", "scope": "team", "group": "multi_game", "unit": "Einsätze"},
    {"key": "team_seasons", "label": "Saisons beim Verein", "scope": "team", "group": "multi_game", "unit": "Saisons"},
    {"key": "team_yellow_cards", "label": "Gelbe Karten für den Verein", "scope": "team", "group": "multi_game", "unit": "Karten"},
    {"key": "team_best_season_goals", "label": "Meiste Tore in einer Saison", "scope": "team_best_season", "group": "multi_game", "unit": "Tore"},
    {"key": "team_best_season_assists", "label": "Meiste Vorlagen in einer Saison", "scope": "team_best_season", "group": "multi_game", "unit": "Vorlagen"},
]

# Transfermarkt liefert englische oder offizielle Namen; hier die im deutschen Sprachraum üblichen
CLUB_NAMES = {
    "27": "FC Bayern München",
    "2036": "1. FC Heidenheim",
    "5": "AC Mailand",
    "46": "Inter Mailand",
    "12": "AS Rom",
    "398": "Lazio Rom",
    "506": "Juventus Turin",
    "6195": "SSC Neapel",
    "1025": "FC Bologna",
    "13": "Atlético Madrid",
    "150": "Real Betis",
    "714": "Espanyol Barcelona",
    "1041": "Olympique Lyon",
    "244": "Olympique Marseille",
    "4172": "Pisa SC",
}

# Kurznamen für die Spieltabelle; fehlt ein Eintrag, wird der Name gekürzt (siehe short_name)
CLUB_SHORT_NAMES = {
    "27": "Bayern",
    "16": "Dortmund",
    "18": "Gladbach",
    "15": "Leverkusen",
    "24": "Frankfurt",
    "23826": "Leipzig",
    "533": "Hoffenheim",
    "89": "Union Berlin",
    "3": "Köln",
    "39": "Mainz",
    "86": "Bremen",
    "79": "Stuttgart",
    "82": "Wolfsburg",
    "41": "HSV",
    "35": "St. Pauli",
    "281": "Man City",
    "985": "Man United",
    "148": "Tottenham",
    "1237": "Brighton",
    "543": "Wolves",
    "762": "Newcastle",
    "703": "Nottingham",
    "379": "West Ham",
    "984": "West Brom",
    "418": "Real Madrid",
    "131": "Barcelona",
    "13": "Atlético",
    "621": "Bilbao",
    "681": "Sociedad",
    "367": "Rayo",
    "583": "PSG",
    "1041": "Lyon",
    "244": "Marseille",
    "667": "Strasbourg",
    "273": "Rennes",
    "3911": "Brest",
    "5": "Milan",
    "46": "Inter",
    "506": "Juventus",
}

# Wörter, die beim automatischen Kürzen wegfallen
CLUB_NAME_FILLERS = {"fc", "afc", "aj", "cf", "sc", "ac", "acf", "as", "bc", "us", "ssc", "ca", "rcd", "ud", "sv", "vfl", "vfb",
                     "tsg", "fsv", "rc", "ogc", "losc", "sco", "cfc", "calcio", "1.", "1.fc", "1899", "1907", "1909", "1913", "04", "05", "29"}


def team_key(club_id: str) -> str:
    return f"fb_{club_id}"


def player_key(player_id: str) -> str:
    return f"fb_{player_id}"


def search_name(name: str) -> str:
    decomposed = unicodedata.normalize("NFKD", name)
    ascii_only = "".join(c for c in decomposed if not unicodedata.combining(c))
    return " ".join(ascii_only.lower().replace(".", "").replace("'", "").split())


def umlaut_alias(name: str) -> str | None:
    # "Thomas Müller" lässt sich so auch als "Mueller" finden
    replaced = name
    for umlaut, spelled in (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("Ä", "Ae"), ("Ö", "Oe"), ("Ü", "Ue"), ("ß", "ss")):
        replaced = replaced.replace(umlaut, spelled)
    return replaced if replaced != name else None


def short_name(club_id: str, name: str) -> str:
    if club_id in CLUB_SHORT_NAMES:
        return CLUB_SHORT_NAMES[club_id]
    words = [w for w in name.split() if w.lower() not in CLUB_NAME_FILLERS]
    return " ".join(words) or name


def season_of(date: str) -> int:
    # Saisonbeginn im Juli: '2013-03-02' -> 2012 (Saison 2012/13)
    year, month = int(date[:4]), int(date[5:7])
    return year if month >= 7 else year - 1


def num(value: str) -> int:
    return int(float(value)) if value else 0


# --- Datensatz --------------------------------------------------------------


def download(refresh: bool) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    for table in TABLES:
        target = CACHE_DIR / f"{table}.csv.gz"
        if target.exists() and not refresh:
            continue
        print(f"Lade {table}.csv.gz …")
        tmp = target.with_suffix(".part")
        with urllib.request.urlopen(f"{SOURCE_URL}/{table}.csv.gz", timeout=120) as res, tmp.open("wb") as out:
            shutil.copyfileobj(res, out)
        tmp.replace(target)


def read_table(table: str):
    with gzip.open(CACHE_DIR / f"{table}.csv.gz", "rt", encoding="utf-8", newline="") as f:
        yield from csv.DictReader(f)


# --- Berechnung -------------------------------------------------------------


def empty_totals() -> dict:
    return {"games": 0, "goals": 0, "assists": 0, "yellow": 0}


def add_appearance(totals: dict, goals: int, assists: int, yellow: int) -> None:
    totals["games"] += 1
    totals["goals"] += goals
    totals["assists"] += assists
    totals["yellow"] += yellow


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
    parser.add_argument("--refresh", action="store_true", help="CSV-Dateien neu herunterladen")
    parser.add_argument(
        "--min-games",
        type=int,
        default=DEFAULT_MIN_GAMES,
        help=f"nur Spieler mit mindestens so vielen erfassten Einsätzen (Standard: {DEFAULT_MIN_GAMES}, 0 = alle)",
    )
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help=f"Zielordner (Standard: {DEFAULT_OUT})")
    args = parser.parse_args()

    download(args.refresh)

    # Länderspiele (WM, EM usw.) zählen nicht zu den Vereinswerten
    national = {c["competition_id"] for c in read_table("competitions") if c["type"] == "national_team_competition"}

    game_season: dict[str, int] = {}
    club_names: dict[str, str] = {}
    league_seasons: dict[str, set[int]] = defaultdict(set)
    latest_date = ""
    for g in read_table("games"):
        if g["competition_id"] in national:
            continue
        latest_date = max(latest_date, g["date"])
        game_season[g["game_id"]] = int(g["season"]) if g["season"] else season_of(g["date"])
        if g["competition_id"] in LEAGUES:
            for side in ("home", "away"):
                club_names[g[f"{side}_club_id"]] = g[f"{side}_club_name"]
                league_seasons[g[f"{side}_club_id"]].add(game_season[g["game_id"]])
    latest_season = max(s for seasons in league_seasons.values() for s in seasons)

    # Karriere: alle Vereinsspiele; pro Verein und Saison getrennt für Vereins- und Saisonwerte
    career: dict[str, dict] = defaultdict(empty_totals)
    highs: dict[str, dict[str, int]] = defaultdict(lambda: {"goals": 0, "assists": 0, "points": 0})
    per_season: dict[tuple[str, str, int], dict] = defaultdict(empty_totals)
    player_last_season: dict[str, int] = {}
    appearance_names: dict[str, str] = {}

    for i, a in enumerate(read_table("appearances"), start=1):
        if i % 500_000 == 0:
            print(f"  {i:,} Einsätze gelesen".replace(",", "'"))
        if a["competition_id"] in national:
            continue
        season = game_season.get(a["game_id"]) or season_of(a["date"])
        pid, goals, assists, yellow = a["player_id"], num(a["goals"]), num(a["assists"]), num(a["yellow_cards"])
        add_appearance(career[pid], goals, assists, yellow)
        add_appearance(per_season[(pid, a["player_club_id"], season)], goals, assists, yellow)
        best = highs[pid]
        best["goals"] = max(best["goals"], goals)
        best["assists"] = max(best["assists"], assists)
        best["points"] = max(best["points"], goals + assists)
        player_last_season[pid] = max(player_last_season.get(pid, season), season)
        appearance_names.setdefault(pid, a["player_name"])

    profiles = {p["player_id"]: p for p in read_table("players")}
    aliases = load_aliases()

    # Saisonwerte pro Spieler und Verein zusammenfassen
    stints: dict[tuple[str, str], list[tuple[int, dict]]] = defaultdict(list)
    for (pid, club_id, season), totals in per_season.items():
        if club_id in club_names:
            stints[(pid, club_id)].append((season, totals))

    rosters: dict[str, list[dict]] = defaultdict(list)
    for (pid, club_id), seasons in stints.items():
        totals = career[pid]
        if totals["games"] < args.min_games:
            continue
        profile = profiles.get(pid, {})
        name = profile.get("name") or appearance_names[pid]
        starts = [s for s, _ in seasons]
        career_values = {
            "career_goals": totals["goals"],
            "career_assists": totals["assists"],
            "career_games": totals["games"],
            "career_high_goals": highs[pid]["goals"],
            "career_high_assists": highs[pid]["assists"],
            "career_high_points": highs[pid]["points"],
        }
        for key in ("international_caps", "international_goals"):
            if profile.get(key):
                career_values[key] = num(profile[key])
        team_values = {
            "team_goals": sum(t["goals"] for _, t in seasons),
            "team_assists": sum(t["assists"] for _, t in seasons),
            "team_games": sum(t["games"] for _, t in seasons),
            "team_seasons": len(set(starts)),
            "team_yellow_cards": sum(t["yellow"] for _, t in seasons),
            "team_best_season_goals": max(t["goals"] for _, t in seasons),
            "team_best_season_assists": max(t["assists"] for _, t in seasons),
        }
        player_aliases = list(aliases.get(player_key(pid), []))
        if (spelled := umlaut_alias(name)) and spelled not in player_aliases:
            player_aliases.append(spelled)
        rosters[club_id].append(
            {
                "id": player_key(pid),
                "name": name,
                "search": search_name(name),
                "aliases": player_aliases,
                "active": player_last_season[pid] >= latest_season,
                "first": min(starts),
                "last": max(starts),
                "values": {**career_values, **team_values},
            }
        )

    # Alte Ausgabe ersetzen, damit keine verwaisten Vereinsdateien liegen bleiben
    shutil.rmtree(args.out / "teams", ignore_errors=True)
    meta_teams = []
    for club_id, roster in rosters.items():
        roster.sort(key=lambda p: p["search"])
        write_json(args.out / "teams" / f"{team_key(club_id)}.json", roster)
        name = CLUB_NAMES.get(club_id, club_names[club_id])
        meta_teams.append(
            {
                "id": team_key(club_id),
                "name": name,
                "short_name": short_name(club_id, name),
                "logo_url": LOGO_URL.format(club_id=club_id),
                # Runden nur mit Vereinen, die in der aktuellen Saison in einer Top-5-Liga spielen
                "active": latest_season in league_seasons[club_id],
                "player_count": len(roster),
            }
        )
    meta_teams.sort(key=lambda t: (not t["active"], t["name"]))

    write_json(
        args.out / "meta.json",
        {
            "sport": SPORT,
            # Datenstand = letztes Spiel im Datensatz, nicht der Zeitpunkt des Imports
            "updated_at": datetime.fromisoformat(latest_date).replace(tzinfo=timezone.utc).isoformat(timespec="seconds"),
            "roster_note": f"nur Spieler ab {args.min_games} erfassten Einsätzen seit 2012/13" if args.min_games else None,
            "categories": CATEGORIES,
            "teams": meta_teams,
        },
    )
    active = sum(t["active"] for t in meta_teams)
    print(f"Fertig: {len(meta_teams)} Vereine ({active} aktiv), {sum(len(r) for r in rosters.values())} Einträge in {args.out}")


if __name__ == "__main__":
    main()
