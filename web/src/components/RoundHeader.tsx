import type { Category, Team } from '../lib/types'

interface Props {
  team: Team
  category: Category
}

function scopeHint(category: Category, team: Team): string {
  if (category.hint) return category.hint
  switch (category.scope) {
    case 'career':
      return category.group === 'single_game'
        ? 'Bestes Einzelspiel der Karriere – zählt über alle Teams'
        : 'Karrierewert – zählt über alle Teams'
    case 'team':
      return `Zählt nur die Zeit bei ${team.short_name ?? team.name}`
    case 'team_best_season':
      return `Beste Einzelsaison bei ${team.short_name ?? team.name}`
  }
}

export default function RoundHeader({ team, category }: Props) {
  return (
    <div className="round-header">
      {team.logo_url && (
        <img
          key={team.id}
          src={team.logo_url}
          alt=""
          width={48}
          height={48}
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
      )}
      <div>
        <div className="team-name">{team.name}</div>
        <div className="category">{category.label}</div>
        <div className="muted small">{scopeHint(category, team)}</div>
      </div>
    </div>
  )
}
