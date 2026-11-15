import { z } from 'zod'

/** What the API sends back. Parsed at the edge so the rest of the app can trust the shapes. */
const iso = z.string()
const hex = z.string().regex(/^0x[0-9a-fA-F]*$/)

export const delegationState = z.enum(['none', 'valid', 'expiring', 'expired'])
export type DelegationState = z.infer<typeof delegationState>

export const delegationStatus = z.object({
  stored: z.boolean(), status: delegationState, expiresAt: iso.nullable(), daysLeft: z.number().nullable(),
})

export const site = z.object({
  name: z.string(), chainId: z.number(), tokenId: z.string(), holder: z.string(), payoutAddress: z.string(), signer: z.string(),
  status: z.enum(['ACTIVE', 'DISABLED']), delegation: delegationStatus, createdAt: iso,
})
export type Site = z.infer<typeof site>

export const registered = z.object({ site, created: z.boolean(), takeover: z.boolean() })

export const authMessage = z.object({ message: z.string(), expiresInSeconds: z.number() })
export const authSession = z.object({ token: z.string(), expiresInSeconds: z.number(), wallet: z.string() })
export const me = z.object({ wallet: z.string() })

export const typedData = z.object({
  domain: z.record(z.string(), z.unknown()),
  types: z.record(z.string(), z.array(z.object({ name: z.string(), type: z.string() }))),
  primaryType: z.string(),
  message: z.record(z.string(), z.unknown()),
})
export const delegationMessage = z.object({
  typedData, expires: z.number(), expiresAt: iso, days: z.number(), signer: z.string(), container: z.string(), holder: z.string(),
})
export type DelegationMessage = z.infer<typeof delegationMessage>

export const secret = z.object({ name: z.string(), createdAt: iso, updatedAt: iso })
export type Secret = z.infer<typeof secret>

/** The settings of one route as stored (the adapter method shape plus our locked and limits members). */
export const routeConfig = z.object({
  url: z.string(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
  params: z.record(z.string(), z.string()).optional(),
  defaults: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  required: z.array(z.string()).optional(),
  query: z.record(z.string(), z.string()).optional(),
  body: z.union([z.literal('*'), z.record(z.string(), z.string())]).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  pick: z.record(z.string(), z.string()).optional(),
  returns: z.record(z.string(), z.string()).optional(),
  timeoutMs: z.number().optional(),
  locked: z.record(z.string(), z.unknown()).optional(),
  limits: z.record(z.string(), z.object({ maxLength: z.number().optional() })).optional(),
})
export type RouteConfig = z.infer<typeof routeConfig>

export const route = z.object({
  name: z.string(), config: routeConfig, priceUsd: z.string(), enabled: z.boolean(), rateLimitPerMin: z.number(), updatedAt: iso,
})
export type Route = z.infer<typeof route>

export const callResult = z.enum(['OK', 'ERROR', 'RATE_LIMITED', 'REFUSED'])
export const logRow = z.object({
  routeName: z.string(), at: iso, result: callResult, errorCode: z.string().nullable(), paid: z.boolean(),
  paymentTx: z.string().nullable(), priceUsd: z.string(), durationMs: z.number(),
})
export type LogRow = z.infer<typeof logRow>

export const routeSummary = z.object({
  calls: z.number(), OK: z.number(), ERROR: z.number(), RATE_LIMITED: z.number(), REFUSED: z.number(), paidCalls: z.number(), paidUsd: z.string(),
})
export const logSummary = z.object({
  days: z.number(), since: iso, routes: z.record(z.string(), routeSummary),
  totals: z.object({ calls: z.number(), paidCalls: z.number(), paidUsd: z.string() }),
})
export type LogSummary = z.infer<typeof logSummary>

export const manifestPreview = z.object({
  manifest: z.record(z.string(), z.unknown()), size: z.number(), sha256: z.string(), delegation: delegationStatus,
  publishable: z.boolean(), problems: z.array(z.string()),
})
export type ManifestPreview = z.infer<typeof manifestPreview>

export const manifestState = z.enum(['not-ready', 'not-published', 'current', 'out-of-date'])
export type ManifestState = z.infer<typeof manifestState>
export const manifestStatus = z.object({
  state: manifestState,
  expected: z.object({ sha256: z.string(), size: z.number() }).nullable(),
  problems: z.array(z.string()),
  onChain: z.object({ sha256: z.string(), size: z.number(), updatedAt: iso }).nullable(),
})
export type ManifestStatus = z.infer<typeof manifestStatus>

export const publishTx = z.object({
  from: z.string(), chainId: z.number(), size: z.number(), key: z.string(), sha256Hash: z.string(),
  txs: z.array(z.object({ to: hex, data: hex, value: z.string().optional() })), note: z.string(),
})
export type PublishTx = z.infer<typeof publishTx>
