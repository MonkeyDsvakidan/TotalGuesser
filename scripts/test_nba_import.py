"""Selbsttest der Playoff-Berechnung ohne Internet: python test_nba_import.py"""

from nba_import import compute_player, compute_playoff_highs, merge_seasons, playoff_diff


def row(season, team, abbr, gp, pts, reb=0, ast=0):
    return {"SEASON_ID": season, "TEAM_ID": team, "TEAM_ABBREVIATION": abbr, "GP": gp, "PTS": pts, "REB": reb, "AST": ast}


regular = [row("2003-04", 1, "CLE", 80, 1600), row("2004-05", 1, "CLE", 80, 2000)]
playoffs = [row("2004-05", 1, "CLE", 10, 300)]

career, teams = compute_player(regular)
combined_career, combined_teams = compute_player(merge_seasons(regular, playoffs))
assert combined_career["career_total_pts"] == 3900
assert combined_career["career_games"] == 170
assert combined_teams[1]["values"]["team_seasons"] == 2, "Playoff-Lauf ist keine eigene Saison"
# 2004-05: (2000 + 300) / 90 = 25.6
assert combined_teams[1]["values"]["team_best_season_ppg"] == 25.6

diff = playoff_diff({**career, **teams[1]["values"]}, {**combined_career, **combined_teams[1]["values"]})
assert "team_seasons" not in diff and diff["team_total_pts"] == 3900

assert compute_playoff_highs([{"PTS": 45, "REB": 8}, {"PTS": 30, "REB": None}]) == {"career_high_pts": 45, "career_high_reb": 8}
print("ok")
