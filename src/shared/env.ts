try { process.loadEnvFile() } catch { /* no .env file: use the process environment */ }

export const env = (name: string, fallback = ''): string => process.env[name] || fallback
/** A required variable. The error names the variable, never its value. */
export const requireEnv = (name: string): string => {
  const v = process.env[name]
  if (!v) throw new Error(`missing environment variable ${name} (see .env.example)`)
  return v
}
export const envList = (name: string): string[] => env(name).split(',').map((s) => s.trim()).filter(Boolean)
