import { BadRequestException } from '@nestjs/common'
import type { ZodType } from 'zod'

/** Parse a request body with zod. The error lists field names and rules, never the submitted values. */
export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body)
  if (r.success) return r.data
  throw new BadRequestException({
    code: 'BAD_REQUEST', message: 'invalid request',
    fields: r.error.issues.map((i) => ({ field: i.path.join('.'), problem: i.message })),
  })
}
