/** JSON.stringify that survives bigint. */
export const toJson = (v: unknown, space = 2): string =>
  JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x), space)
