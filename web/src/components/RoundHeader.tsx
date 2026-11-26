import { teamLabel } from '../lib/data'
import type { Category, Team } from '../lib/types'

interface Props {
  team: Team
  category: Category
  label: string // z. B. «Runde 2 von 5»
  playoffs?: boolean
}

function scopeHint(category: Category, team: Team): string {
  if (category.hint) return category.hint
  switch (category.scope) {
    case 'career':
      return category.group === 'single_game'
        ? 'Bestes Einzelspiel der Karriere – zählt über alle Teams'
        : 'Karrierewert – zählt über alle Teams'
    case 'team':
      return `Zählt nur die Zeit bei ${teamLabel(team)}`
    case 'team_best_season':
      return `Beste Einzelsaison bei ${teamLabel(team)}`
  }
}

export default function RoundHeader({ team, category, label, playoffs }: Props) {
  return (
    <div className="round-header board">
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
        <div className="board-label">{label}</div>
        <div className="team-name">{team.name}</div>
        <div className="category">{category.label}</div>
        <div className="board-hint">{scopeHint(category, team)}
          {playoffs && ' · inkl. Playoffs'}
        </div>
      </div>
    </div>
  )
}
