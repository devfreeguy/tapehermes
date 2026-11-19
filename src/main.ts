import 'reflect-metadata'
import { loadConfig } from './config/app-config.js'
import { startServer } from './bootstrap.js'
import './shared/env.js' // loads .env

const config = loadConfig() // fails fast, naming the variable, never a value
const { base } = await startServer(config, process.env.HOST || '127.0.0.1')
console.log(`TapeHermes backend listening on ${base} (dev mode delegation skip: ${config.devSkipDelegation ? 'ON' : 'off'})`)
