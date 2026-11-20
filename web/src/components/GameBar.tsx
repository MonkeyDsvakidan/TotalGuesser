// GameMaster-Leiste unten (MusicBattle-Roadmap 8.4): dieselben Einträge, Icons und Farben wie in Music Battle; hier ist TotalGuesser aktiv.
// Wechseln verliert nichts: Der Spielstand liegt im localStorage und wird beim Zurückkommen wieder geladen.
const ITEMS = [
  {
    k: 'mb',
    href: '/MusicBattle/?mode=1v1',
    label: 'Music 1v1',
    icon: (
      <>
        <path d="M6 15.5V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-1.5" />
        <path d="M5.5 15.5H14a2 2 0 0 0 2-2V8A5 5 0 0 0 11 3H8.5A4.5 4.5 0 0 0 4 7.5V9" />
        <path d="M4 9a2 2 0 0 0-2 2v1a3.5 3.5 0 0 0 3.5 3.5" />
        <path d="M4 9.5c2 0 3.5 1 3.5 3" />
        <ellipse cx="19" cy="19" rx="2" ry="1.6" />
        <path d="M21 19v-8l1.5 1" />
      </>
    ),
  },
  {
    k: 'quiz',
    href: '/MusicBattle/?mode=quiz',
    label: 'Musik-Quiz',
    icon: (
      <>
        <path d="M3 15a5 5 0 0 1 10 0" />
        <rect x="1.5" y="15" width="13" height="4.5" rx="1.3" />
        <path d="M8 7.5V6M4.3 9.2l-.9-.9M11.7 9.2l.9-.9" />
        <ellipse cx="19" cy="18.5" rx="2" ry="1.6" />
        <path d="M21 18.5v-8l1.5 1" />
      </>
    ),
  },
  {
    k: 'tg',
    href: './',
    label: 'TotalGuesser',
    icon: (
      <>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </>
    ),
  },
  {
    k: 'tools',
    href: '/#tools',
    label: 'Tools',
    icon: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z" />,
  },
]

export default function GameBar() {
  return (
    <nav className="gmbar" aria-label="GameMaster">
      {ITEMS.map((it) => (
        <a key={it.k} href={it.href} data-k={it.k} aria-current={it.k === 'tg' ? 'page' : undefined}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {it.icon}
          </svg>
          {it.label}
        </a>
      ))}
    </nav>
  )
}
