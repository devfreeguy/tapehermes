import chineseMessages from '@/copy/zh-CN.json'

export const locales = ['zh-CN', 'en'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'zh-CN'
export const localeCookie = 'tapehermes-locale'
export const localeNames: Record<Locale, string> = { 'zh-CN': '简体中文', en: 'English' }

export function parseLocale(value: string | undefined): Locale {
  return value === 'en' ? 'en' : defaultLocale
}

const chinese: Readonly<Record<string, string>> = chineseMessages

export function translator(locale: Locale) {
  return (message: string, ...values: (string | number)[]) => {
    const text = locale === 'zh-CN' && Object.hasOwn(chinese, message) ? chinese[message] : message
    return values.length ? text.replace(/\{(\d+)\}/g, (token, index) => String(values[Number(index)] ?? token)) : text
  }
}

export type Translate = ReturnType<typeof translator>
