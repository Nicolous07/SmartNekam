export const THEME_STORAGE_KEY = 'theme'

export type ThemePreference = 'dark' | 'light' | 'system' | 'amoled'

export function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'dark' || value === 'light' || value === 'system' || value === 'amoled'
}

export function applyThemePreference(preference: ThemePreference, systemPrefersDark?: boolean) {
  const prefersDark = systemPrefersDark ?? window.matchMedia('(prefers-color-scheme: dark)').matches
  const effectiveDark = preference === 'dark' || preference === 'amoled' || (preference === 'system' && prefersDark)
  const root = document.documentElement
  root.classList.toggle('dark', effectiveDark)
  root.classList.toggle('amoled', preference === 'amoled')
  root.dataset.theme = preference
  const themeColor = preference === 'light' ? '#F6F8FC' : preference === 'amoled' ? '#000000' : '#0B0F1A'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor)
}
