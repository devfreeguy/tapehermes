import { execSync } from 'node:child_process'

/** Bring the test database (TEST_DATABASE_URL, never the dev one) to the current schema before any test runs. */
export default function setup() {
  try { process.loadEnvFile() } catch { /* no .env */ }
  const url = process.env.TEST_DATABASE_URL
  if (!url) throw new Error('TEST_DATABASE_URL is not set (see .env.example)')
  if (!/_test\b/.test(new URL(url).pathname)) throw new Error('TEST_DATABASE_URL must point at a database whose name ends in _test')
  execSync('npx prisma migrate deploy', { stdio: 'pipe', env: { ...process.env, DATABASE_URL: url } })
}
