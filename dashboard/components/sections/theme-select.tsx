'use client'

import { useEffect, useState } from 'react'
import { systemThemeQuery, themes, themeStorageKey, type Theme } from '@/lib/theme'

export const themeLabels: Record<Theme, string> = { dark: 'Dark', light: 'Light', system: 'System' }

function applyTheme(theme: Theme, media = window.matchMedia(systemThemeQuery)) {
  const root = document.documentElement
  root.dataset.theme = theme
  root.classList.toggle('dark', theme === 'dark' || (theme === 'system' && media.matches))
}

export function useThemePreference() {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia(systemThemeQuery)

    function syncTheme() {
      const preference = themes.find((value) => value === root.dataset.theme) ?? 'dark'
      applyTheme(preference, media)
      setTheme(preference)
    }

    function syncStorage(event: StorageEvent) {
      if (event.key !== themeStorageKey && event.key !== null) return
      root.dataset.theme = themes.find((value) => value === event.newValue) ?? 'dark'
      syncTheme()
    }

    syncTheme()
    media.addEventListener('change', syncTheme)
    window.addEventListener('storage', syncStorage)
    return () => {
      media.removeEventListener('change', syncTheme)
      window.removeEventListener('storage', syncStorage)
    }
  }, [])

  function changeTheme(value: string) {
    const preference = themes.find((option) => option === value)
    if (!preference) return
    applyTheme(preference)
    setTheme(preference)
    try {
      localStorage.setItem(themeStorageKey, preference)
    } catch {
      // The selection still works in this tab when storage is unavailable.
    }
  }

  return { theme, changeTheme }
}

export function ThemeSelect() {
  const { theme, changeTheme } = useThemePreference()
  return (
    <select
      aria-label="Color theme"
      value={theme}
      onChange={(event) => changeTheme(event.target.value)}
      className="h-8 rounded-md border border-input bg-card px-2 text-card-foreground hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-ring"
    >
      {themes.map((value) => <option key={value} value={value}>{themeLabels[value]}</option>)}
    </select>
  )
}
