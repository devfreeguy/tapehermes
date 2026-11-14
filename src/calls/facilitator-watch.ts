import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * The OKX client throws on a network failure and on ANY non-2xx answer (`OKX verify failed: 500`), and the seller kit
 * core then turns every such exception into a plain "402 payment invalid". To tell "the facilitator cannot be reached"
 * from "this payment is bad", the facilitator client is wrapped: a throw from verify or settle marks the request that
 * is running (AsyncLocalStorage) as an outage. A normal "isValid: false" answer is NOT an outage.
 */
export interface OutageScope { down: boolean }
export const outageScope = new AsyncLocalStorage<OutageScope>()

export function watchFacilitator<T extends object>(client: T): T {
  return new Proxy(client, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver)
      if (typeof value !== 'function') return value
      if (key !== 'verify' && key !== 'settle') return value.bind(target)
      return async (...args: unknown[]) => {
        try { return await value.apply(target, args) } catch (e) {
          const scope = outageScope.getStore()
          if (scope) scope.down = true
          throw e
        }
      }
    },
  })
}
