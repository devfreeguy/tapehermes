// The site as ONE file for the dashboard: { files: [{ path, contentType, content: base64 }] }, in the order of SITE_FILES.
// The dashboard sends it to the plan endpoint and the holder wallet signs the transactions. Nothing here talks to a network.
import { readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SITE_FILES, TYPES } from './dev-server.mjs'

const DIR = fileURLToPath(new URL('.', import.meta.url))

export function makeBundle(dir = DIR) {
  return {
    files: SITE_FILES.map((path) => ({
      path,
      contentType: TYPES[extname(path)],
      content: readFileSync(join(dir, path)).toString('base64'),
    })),
  }
}
