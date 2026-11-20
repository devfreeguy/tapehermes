export const themeStorageKey = 'tapehermes-theme'
export const systemThemeQuery = '(prefers-color-scheme: dark)'
export const themes = ['dark', 'light', 'system'] as const
export type Theme = (typeof themes)[number]

// Run in the document head so the first paint already reflects the saved choice.
export const themeInitializer = `(() => {
  let theme = 'dark';
  try {
    const saved = localStorage.getItem('${themeStorageKey}');
    if (['dark', 'light', 'system'].includes(saved)) theme = saved;
  } catch {}
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle('dark', theme === 'dark' ||
    (theme === 'system' && matchMedia('${systemThemeQuery}').matches));
})();`
