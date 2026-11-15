import { z } from 'zod'

export const ROUTE_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/

const str = (max: number) => z.string().max(max)
const strMap = (maxKeys = 20, maxLen = 512) => z.record(str(64), str(maxLen)).refine((o) => Object.keys(o).length <= maxKeys, 'too many entries')

/**
 * The outside-call SETTINGS of one route (the adapter method shape). Data only: no code, no scripts.
 * Strict: unknown keys are refused so a typo cannot silently drop a rule.
 */
export const routeConfigSchema = z.strictObject({
  url: str(2048),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
  params: strMap().optional(),
  defaults: z.record(str(64), z.union([z.string().max(512), z.number(), z.boolean()])).optional(),
  required: z.array(str(64)).max(20).optional(),
  query: strMap().optional(),
  body: z.union([z.literal('*'), strMap()]).optional(),
  headers: strMap(10, 1024).optional(),
  pick: strMap(30, 256).optional(),
  returns: strMap(30, 64).optional(),
  timeoutMs: z.number().int().min(100).max(15000).optional(),
  /** Owner-fixed values, always sent. A caller who sets one is refused (see worker/locked-settings.ts). */
  locked: z.record(str(64), z.json()).refine((o) => Object.keys(o).length <= 20 && JSON.stringify(o).length <= 8000, 'too many or too large').optional(),
  /** Limits on caller-supplied text, e.g. { input: { maxLength: 200 } }. */
  limits: z.record(str(64), z.strictObject({ maxLength: z.number().int().min(1).max(4096).optional() })).optional(),
})
export type RouteConfig = z.infer<typeof routeConfigSchema>

export const createRouteSchema = z.strictObject({
  name: z.string().regex(ROUTE_NAME_RE),
  config: routeConfigSchema,
  priceUsd: z.string().regex(/^\d{1,12}(\.\d{1,6})?$/).default('0'),
  enabled: z.boolean().default(true),
  rateLimitPerMin: z.number().int().min(1).max(6000).default(60),
})

export const updateRouteSchema = z.strictObject({
  config: routeConfigSchema.optional(),
  priceUsd: z.string().regex(/^\d{1,12}(\.\d{1,6})?$/).optional(),
  enabled: z.boolean().optional(),
  rateLimitPerMin: z.number().int().min(1).max(6000).optional(),
})

/** True when `${` appears anywhere outside the headers: secrets may only be used in headers. */
export function secretOutsideHeaders(config: RouteConfig): boolean {
  const { headers: _h, ...rest } = config
  return JSON.stringify(rest).includes('${')
}
