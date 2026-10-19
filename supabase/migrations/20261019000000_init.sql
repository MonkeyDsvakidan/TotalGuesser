-- TotalGuesser: Grundschema (siehe PLAN.md, Abschnitt 2)

create extension if not exists pg_trgm;

create table sports (
  id text primary key                      -- 'nba', 'football'
);

create table teams (
  id text primary key,                     -- 'nba_1610612738', 'fb_bayern'; 'all' = Pseudo-Team für Karrierewerte
  sport_id text references sports(id),     -- NULL nur beim Pseudo-Team 'all'
  name text not null,
  short_name text,
  logo_url text,
  active boolean not null default true     -- nur aktive Teams für Runden vorschlagen
);

create table players (
  id text primary key,                     -- ID aus der Quelle, z. B. 'nba_1628369'
  sport_id text not null references sports(id),
  full_name text not null,
  search_name text not null,               -- klein, ohne Akzente: 'luka doncic'
  aliases text[] not null default '{}',    -- 'SGA', 'KD', 'Manu' usw.
  is_active boolean
);

-- Welche Spieler haben für welches Team gespielt
create table player_teams (
  player_id text not null references players(id) on delete cascade,
  team_id text not null references teams(id) on delete cascade,
  first_season int,                        -- Startjahr der Saison, 2003 = 2003-04
  last_season int,
  primary key (player_id, team_id)
);

create table categories (
  key text primary key,                    -- 'career_high_pts', 'team_total_pts', ...
  sport_id text not null references sports(id),
  label text not null,
  scope text not null check (scope in ('career', 'team', 'team_best_season')),
  unit text,
  enabled boolean not null default true
);

create table stat_values (
  player_id text not null references players(id) on delete cascade,
  category_key text not null references categories(key) on delete cascade,
  team_id text not null references teams(id) on delete cascade,  -- 'all' bei scope 'career'
  value numeric not null,
  updated_at timestamptz not null default now(),
  primary key (player_id, category_key, team_id)
);

create index stat_values_category_team_idx on stat_values (category_key, team_id);
create index player_teams_team_idx on player_teams (team_id);
create index players_search_name_trgm_idx on players using gin (search_name gin_trgm_ops);
create index players_sport_idx on players (sport_id);

-- Pseudo-Team für Karrierewerte (ein Eintrag für alle Sportarten)
insert into teams (id, sport_id, name, short_name, active)
values ('all', null, 'Karriere (alle Teams)', 'ALL', false);

-- Lesen ist öffentlich, Schreiben nur mit Service-Role-Key (Import-Skripte)
alter table sports enable row level security;
alter table teams enable row level security;
alter table players enable row level security;
alter table player_teams enable row level security;
alter table categories enable row level security;
alter table stat_values enable row level security;

create policy "public read" on sports for select using (true);
create policy "public read" on teams for select using (true);
create policy "public read" on players for select using (true);
create policy "public read" on player_teams for select using (true);
create policy "public read" on categories for select using (true);
create policy "public read" on stat_values for select using (true);
