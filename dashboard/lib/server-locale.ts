import { cache } from 'react'
import { cookies } from 'next/headers'
import { localeCookie, parseLocale, translator } from './locale'

export const getLocale = cache(async () => parseLocale((await cookies()).get(localeCookie)?.value))

export async function getTranslator() {
  return translator(await getLocale())
}
