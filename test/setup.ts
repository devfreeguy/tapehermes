import 'reflect-metadata'

// Tests run against the TEST database and their own Redis prefix, whatever .env says for development.
try { process.loadEnvFile() } catch { /* no .env */ }
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
process.env.REDIS_PREFIX = 'tapehermes-test:'
process.env.UNSAFE_DEV_SKIP_DELEGATION = '1'
process.env.NODE_ENV = 'test'
process.env.AUTH_DOMAIN = 'tapehermes.test'
