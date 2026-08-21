export const THEMES = [
  {
    id: 'default',
    label: 'Graphite',
    description: 'Warm neutral',
    className: 'theme-graphite',
  },
  {
    id: 'gruvbox',
    label: 'Sandstone',
    description: 'Quiet and warm',
    className: 'theme-sandstone',
  },
  {
    id: 'catppuccin',
    label: 'Catppuccin',
    description: 'Mocha mauve',
    className: 'theme-catppuccin',
  },
  {
    id: 'everforest',
    label: 'Everforest',
    description: 'Natural green',
    className: 'theme-everforest',
  },
  {
    id: 'shadcn',
    label: 'Slate',
    description: 'Calm blue-gray',
    className: 'theme-slate',
  },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

export const THEME_IDS = new Set<ThemeId>(THEMES.map((theme) => theme.id))

export function themeClassFor(themeId: ThemeId): string {
  return THEMES.find((theme) => theme.id === themeId)?.className ?? ''
}
