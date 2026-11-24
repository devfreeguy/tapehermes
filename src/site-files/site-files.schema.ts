import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'

/** What a site may hold. Only these types, so the gateway always serves a file with a type the browser will run. */
export const SITE_CONTENT_TYPES = [
  'text/html; charset=utf-8', 'text/css; charset=utf-8', 'text/javascript; charset=utf-8', 'application/json', 'image/svg+xml', 'text/plain; charset=utf-8',
] as const

export const MAX_SITE_FILES = 30
export const MAX_SITE_FILE_BYTES = 200_000
export const MAX_SITE_TOTAL_BYTES = 400_000

const SEGMENT = /^[A-Za-z0-9._-]+$/

/** A relative path of ASCII segments: no empty segment, no "." or "..", and nothing under .well-known (the manifest has its own publish). */
export function validSitePath(path: string): boolean {
  if (!path || path.length > 200) return false
  const parts = path.split('/')
  return parts.every((p) => SEGMENT.test(p) && p !== '.' && p !== '..') && parts[0] !== '.well-known'
}

const bundleSchema = z.object({
  files: z.array(z.object({
    path: z.string().refine(validSitePath, 'path must be plain ASCII segments (letters, digits, dot, dash, underscore), with no ".." and not under .well-known'),
    contentType: z.enum(SITE_CONTENT_TYPES),
    content: z.string().min(1),
  }).strict()).min(1).max(MAX_SITE_FILES),
}).strict()

export interface SiteFileInput { path: string; contentType: (typeof SITE_CONTENT_TYPES)[number]; bytes: Buffer }

/** Validate an uploaded site bundle ({ files: [{ path, contentType, content: base64 }] }) and decode it. Names the problem, never echoes content. */
export function parseSiteBundle(input: unknown): SiteFileInput[] {
  const parsed = bundleSchema.safeParse(input)
  if (!parsed.success) {
    const where = [...new Set(parsed.error.issues.map((i) => i.path.join('.') || 'body'))].join(', ')
    throw new BadRequestException({ code: 'INVALID_SITE_FILES', message: `the site files are not valid (${where})` })
  }
  const seen = new Set<string>()
  let total = 0
  const files = parsed.data.files.map((f) => {
    if (seen.has(f.path)) throw new BadRequestException({ code: 'INVALID_SITE_FILES', message: `the path ${f.path} appears twice` })
    seen.add(f.path)
    const bytes = Buffer.from(f.content, 'base64')
    if (!bytes.length || bytes.toString('base64') !== f.content) throw new BadRequestException({ code: 'INVALID_SITE_FILES', message: `${f.path} is not valid base64` })
    if (bytes.length > MAX_SITE_FILE_BYTES) throw new BadRequestException({ code: 'SITE_FILE_TOO_LARGE', message: `${f.path} is ${bytes.length} bytes (limit ${MAX_SITE_FILE_BYTES})` })
    total += bytes.length
    return { path: f.path, contentType: f.contentType, bytes }
  })
  if (total > MAX_SITE_TOTAL_BYTES) throw new BadRequestException({ code: 'SITE_FILES_TOO_LARGE', message: `the files total ${total} bytes (limit ${MAX_SITE_TOTAL_BYTES})` })
  return files
}
