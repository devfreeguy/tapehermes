/**
 * A value typed in a form box, read the way an owner expects: 60 is a number, true is a boolean, {"a":1} is an object,
 * "60" (with quotes) is the text 60, and anything that is not JSON is plain text.
 */
export function parseValue(text: string): unknown {
  const t = text.trim()
  if (t === '') return ''
  try { return JSON.parse(t) } catch { return text }
}

/** The inverse of parseValue: text that would be misread as another type gets quotes, so it survives a round trip. */
export function stringifyValue(v: unknown): string {
  if (typeof v === 'string') return parseValue(v) === v && v.trim() === v ? v : JSON.stringify(v)
  return JSON.stringify(v)
}
