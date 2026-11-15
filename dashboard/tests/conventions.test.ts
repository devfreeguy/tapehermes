import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/** The frontend conventions, enforced by a test so a slip fails the build instead of waiting for a review. */
const ROOT = join(__dirname, '..')
const SKIP = new Set(['node_modules', '.next', 'tests', 'coverage', 'playwright-report', 'test-results'])
const TEXT = /\.(ts|tsx|css|json|md|mjs)$/

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    if (SKIP.has(n) || n.startsWith('.')) return []
    const p = join(dir, n)
    return statSync(p).isDirectory() ? files(p) : TEXT.test(n) && n !== 'package.json' && n !== 'next-env.d.ts' ? [p] : []
  })
}
const all = files(ROOT)
const rel = (p: string) => relative(ROOT, p).replace(/\\/g, '/')
const read = (p: string) => readFileSync(p, 'utf8')

describe('frontend conventions', () => {
  it('has source files to check', () => { expect(all.length).toBeGreaterThan(40) })

  it('uses no em dashes anywhere in the dashboard', () => {
    const bad = all.filter((p) => read(p).includes('—')).map(rel)
    expect(bad).toEqual([])
  })

  it('hardcodes no hex colors', () => {
    const bad = all.filter((p) => /#[0-9a-fA-F]{3,8}\b/.test(read(p).replace(/\/\*[\s\S]*?\*\//g, ''))).map(rel)
    expect(bad).toEqual([])
  })

  it('keeps color values in the token file only', () => {
    const bad = all.filter((p) => rel(p) !== 'app/tokens.css' && /\b(oklch|rgba?|hsla?)\(/.test(read(p))).map(rel)
    expect(bad).toEqual([])
  })

  it('uses no inline style attributes with colors, and no third-party script or stylesheet URLs', () => {
    for (const p of all.filter((f) => /\.tsx$/.test(f))) {
      const src = read(p)
      expect(src, rel(p)).not.toMatch(/style=\{\{[^}]*(color|background)/i)
      expect(src, rel(p)).not.toMatch(/<script[^>]*src=|<link[^>]*href=["']https?:/i)
    }
  })

  it('keeps shadcn primitives in components/ui only, with every other component in its level folder', () => {
    const comps = all.filter((p) => rel(p).startsWith('components/') && p.endsWith('.tsx')).map(rel)
    for (const c of comps) expect(c, c).toMatch(/^components\/(ui|atoms|molecules|sections)\/[a-z0-9-]+\.tsx$/)
  })

  it('does not import atoms from molecules\' siblings upward: atoms import no molecules or sections, molecules no sections', () => {
    for (const p of all.filter((f) => rel(f).startsWith('components/atoms/'))) expect(read(p), rel(p)).not.toMatch(/components\/(molecules|sections)\//)
    for (const p of all.filter((f) => rel(f).startsWith('components/molecules/'))) expect(read(p), rel(p)).not.toMatch(/components\/sections\//)
  })
})
