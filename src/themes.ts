export const THEMES = [
  {
    id: 'default',
    label: 'Graphite',
    description: 'Warm neutral',
    accent: '#c7a66a',
    bg: '#171816',
    surface: '#252622',
    className: '',
  },
  {
    id: 'gruvbox',
    label: 'Sandstone',
    description: 'Quiet and warm',
    accent: '#c19265',
    bg: '#211d19',
    surface: '#302a24',
    className: 'theme-sandstone',
  },
  {
    id: 'catppuccin',
    label: 'Catppuccin',
    description: 'Mocha mauve',
    accent: '#cba6f7',
    bg: '#1e1e2e',
    surface: '#313244',
    className: 'theme-catppuccin',
  },
  {
    id: 'everforest',
    label: 'Everforest',
    description: 'Natural green',
    accent: '#a7c080',
    bg: '#2b3339',
    surface: '#374247',
    className: 'theme-everforest',
  },
  {
    id: 'shadcn',
    label: 'Slate',
    description: 'Calm blue-gray',
    accent: '#82a8c8',
    bg: '#171d24',
    surface: '#242c36',
    className: 'theme-slate',
  },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

export const THEME_IDS = new Set<ThemeId>(THEMES.map((theme) => theme.id))

export function themeClassFor(themeId: ThemeId): string {
  return THEMES.find((theme) => theme.id === themeId)?.className ?? ''
}
