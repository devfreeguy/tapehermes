import { describe, expect, it } from 'vitest'
import { allGood, buildChecks, explainFailure, tamper } from '../checks.js'

const SIGNER = '0x' + 'ab'.repeat(20)
const trust = (over = {}) => ({ source: 'site-origin', gateway: { mode: 'client', verified: true }, delegation: 'signature-valid', holderCheck: 'verified', holder: '0x' + 'cd'.repeat(20), expiresAt: '2026-12-20T00:00:00.000Z', ...over })
const result = (over = {}) => ({ trust: trust(), paid: false, price: '0', transaction: null, ...over })
const good = { ok: true, signer: SIGNER, expected: SIGNER }
const row = (rows, id) => rows.find((r) => r.id === id)

describe('checks shown under an answer', () => {
  it('passes everything for a paid answer from the site itself', () => {
    const rows = buildChecks(result({ paid: true, price: '0.01', transaction: '0x' + '12'.repeat(32) }), good)
    expect(rows.map((r) => r.status)).toEqual(['pass', 'pass', 'pass', 'pass', 'pass', 'pass'])
    expect(allGood(rows)).toBe(true)
    expect(row(rows, 'price').detail).toContain('exactly the price in the manifest')
    expect(row(rows, 'payment').detail).toMatch(/^Settled in transaction 0x/)
  })
  it('says a free route is free and nothing was charged', () => {
    const rows = buildChecks(result(), good)
    expect(row(rows, 'price')).toMatchObject({ status: 'info', detail: 'This route is free.' })
    expect(row(rows, 'payment')).toMatchObject({ status: 'info', detail: 'Nothing was charged.' })
  })
  it('warns, but does not fail, when the manifest was read by the gateway server or the holder could not be checked', () => {
    expect(row(buildChecks(result({ trust: trust({ gateway: { mode: 'server' } }) }), good), 'source')).toMatchObject({ status: 'warn' })
    expect(row(buildChecks(result({ trust: trust({ holderCheck: 'unchecked' }) }), good), 'holder')).toMatchObject({ status: 'warn' })
    expect(allGood(buildChecks(result({ trust: trust({ holderCheck: 'unchecked' }) }), good))).toBe(true)
  })
  it('marks a development source, and a development manifest, as warnings', () => {
    const rows = buildChecks(result({ trust: trust({ source: 'endpoint (DEVELOPMENT ONLY)', delegation: 'dev-manifest (not enforced)', holderCheck: 'not-needed' }) }), good)
    expect(['source', 'delegation', 'holder'].map((id) => row(rows, id).status)).toEqual(['warn', 'warn', 'warn'])
  })
  it('FAILS when the signature does not match, and names both signers', () => {
    const rows = buildChecks(result(), { ok: false, signer: '0x' + 'ee'.repeat(20), expected: SIGNER })
    expect(row(rows, 'signature').status).toBe('fail')
    expect(row(rows, 'signature').detail).toContain('Do not trust this answer')
    expect(allGood(rows)).toBe(false)
  })
  it('FAILS with no signer at all when the signature is unreadable', () => {
    expect(row(buildChecks(result(), { ok: false, signer: null, expected: SIGNER }), 'signature').detail).toContain('no valid signer')
  })
})

describe('tamper', () => {
  const proof = { envelope: { result: { name: '(2010 PK9)', hazardous: true, n: 5 }, sig: '0x1' }, method: 'asteroid', params: { id: '1' }, id: 'x' }
  it('changes exactly one character of the first text field, and leaves the original alone', () => {
    const before = JSON.stringify(proof)
    const t = tamper(proof)
    expect(JSON.stringify(proof)).toBe(before)
    expect(t.changed).toBe('name')
    expect(t.proof.envelope.result.name).toBe('X2010 PK9)'.replace('X2010', 'X2010'))
    expect(t.proof.envelope.result.name.length).toBe(proof.envelope.result.name.length)
    let diff = 0; for (let i = 0; i < 10; i++) if (t.proof.envelope.result.name[i] !== proof.envelope.result.name[i]) diff++
    expect(diff).toBe(1)
  })
  it('always changes the value, even when it already starts with X, and flips a boolean when there is no text', () => {
    expect(tamper({ envelope: { result: { a: 'Xyz' } } }).proof.envelope.result.a).toBe('Yyz')
    expect(tamper({ envelope: { result: { ok: true } } }).proof.envelope.result.ok).toBe(false)
  })
})

describe('plain words for failures', () => {
  it.each(['NO_WALLET', 'WRONG_CHAIN', 'PRICE_MISMATCH', 'PAYMENT_REJECTED', 'PAYMENT_SERVICE_UNAVAILABLE', 'BAD_SIGNATURE', 'MANIFEST_UNAVAILABLE', 'DEV_MANIFEST', 'DELEGATION_EXPIRED', 'DELEGATION_NOT_FROM_HOLDER', 'RATE_LIMITED', 'BAD_REQUEST'])('%s', (code) => {
    const w = explainFailure({ code, message: 'raw' })
    expect(w.length).toBeGreaterThan(15)
    expect(w).not.toBe('raw')
    expect(w).not.toContain('—')
  })
  it('says an outage means nothing was charged, and a bad signature means the answer was not used', () => {
    expect(explainFailure({ code: 'PAYMENT_SERVICE_UNAVAILABLE' })).toContain('Nothing was charged')
    expect(explainFailure({ code: 'BAD_SIGNATURE' })).toContain('not used')
  })
  it('falls back to the error text, then to a calm sentence', () => {
    expect(explainFailure({ code: 'NEW', message: 'something specific' })).toBe('something specific')
    expect(explainFailure(null)).toBe('Something went wrong. Try again.')
  })
})
