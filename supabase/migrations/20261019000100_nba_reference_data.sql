-- Sportarten und NBA-Kategorien (Werte kommen aus scripts/nba_import.py)

insert into sports (id) values ('nba'), ('football');

insert into categories (key, sport_id, label, scope, unit, enabled) values
  -- Karriere (alle Teams, nur Regular Season)
  ('career_total_pts',   'nba', 'Karriere-Punkte total',    'career', 'Punkte',   true),
  ('career_total_reb',   'nba', 'Karriere-Rebounds total',  'career', 'Rebounds', true),
  ('career_total_ast',   'nba', 'Karriere-Assists total',   'career', 'Assists',  true),
  ('career_games',       'nba', 'Karriere-Spiele',          'career', 'Spiele',   true),
  -- Career Highs: werden später vom langsamen Skript geladen (PLAN.md, Schritt 4)
  ('career_high_pts',    'nba', 'Career High Punkte',       'career', 'Punkte',   false),
  ('career_high_reb',    'nba', 'Career High Rebounds',     'career', 'Rebounds', false),
  ('career_high_ast',    'nba', 'Career High Assists',      'career', 'Assists',  false),
  -- Nur beim Rundenteam
  ('team_total_pts',     'nba', 'Punkte für das Team',      'team', 'Punkte',   true),
  ('team_total_reb',     'nba', 'Rebounds für das Team',    'team', 'Rebounds', true),
  ('team_total_ast',     'nba', 'Assists für das Team',     'team', 'Assists',  true),
  ('team_games',         'nba', 'Spiele für das Team',      'team', 'Spiele',   true),
  ('team_seasons',       'nba', 'Saisons beim Team',        'team', 'Saisons',  true),
  -- Beste Einzelsaison beim Rundenteam
  ('team_best_season_ppg', 'nba', 'Bester Punkteschnitt einer Saison',   'team_best_season', 'Punkte/Spiel',   true),
  ('team_best_season_rpg', 'nba', 'Bester Reboundschnitt einer Saison',  'team_best_season', 'Rebounds/Spiel', true),
  ('team_best_season_apg', 'nba', 'Bester Assistschnitt einer Saison',   'team_best_season', 'Assists/Spiel',  true);
