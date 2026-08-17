export const THEMES = [
  { id: 'default', label: 'Default', accent: '#c5a46a', bg: '#121315', className: '' },
  { id: 'gruvbox', label: 'Gruvbox', accent: '#d79921', bg: '#282828', className: 'theme-gruvbox' },
  { id: 'catppuccin', label: 'Catppuccin', accent: '#cba6f7', bg: '#1e1e2e', className: 'theme-catppuccin' },
  { id: 'everforest', label: 'Everforest', accent: '#a7c080', bg: '#2b3339', className: 'theme-everforest' },
  { id: 'shadcn', label: 'Shadcn', accent: '#e4e4e7', bg: '#09090b', className: 'theme-shadcn' },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

export const THEME_IDS = new Set<ThemeId>(THEMES.map((theme) => theme.id))

export function themeClassFor(themeId: ThemeId): string {
  return THEMES.find((theme) => theme.id === themeId)?.className ?? ''
}
