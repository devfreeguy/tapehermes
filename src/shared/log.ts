export const step = (msg: string): void => console.log(`\n== ${msg}`)
export const ok = (msg: string): void => console.log(`PASS  ${msg}`)
export const info = (msg: string): void => console.log(`      ${msg}`)

/** Throws when a proof expectation fails, so the script exits non-zero. */
export function expect(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL  ${msg}`)
  ok(msg)
}
