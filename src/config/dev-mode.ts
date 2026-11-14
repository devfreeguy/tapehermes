import type { AppConfig } from './app-config.js'

/**
 * THE one dev-mode switch (env UNSAFE_DEV_SKIP_DELEGATION).
 * On: delegation fields are stored but NOT enforced, and manifests are built dev-style (no delegation, zero escrow).
 * Off: a real delegation is required; Phase 1 cannot enforce it yet (needs our own chain-196 site), so calls are refused.
 */
export const isDevMode = (config: AppConfig): boolean => config.devSkipDelegation
