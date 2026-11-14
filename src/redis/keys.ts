/** The only place Redis keys are built. Every key starts with the app prefix (REDIS_PREFIX). */
export const makeKeys = (prefix: string) => ({
  nonce: (nonce: string) => `${prefix}nonce:${nonce}`,
  session: (tokenHash: string) => `${prefix}session:${tokenHash}`,
  rate: (scope: string, subjectHash: string, window: number) => `${prefix}rate:${scope}:${subjectHash}:${window}`,
  all: () => `${prefix}*`,
  cache: (name: string) => `${prefix}cache:${name}`,
})
export type Keys = ReturnType<typeof makeKeys>
