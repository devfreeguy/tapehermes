import { createHash } from 'node:crypto'
import { encodeCall, toHex } from '@tapeapi/sdk/abi'
import { chainById } from '@tapeapi/sdk/chains'

/** The most bytes one putFile or appendChunk transaction carries. The SDK uses the same split for the manifest. */
export const FILE_CHUNK_BYTES = 24_000

export interface UnsignedTx { to: string; data: string; value: string }
export interface FileTxs { size: number; sha256: string; txs: UnsignedTx[] }

/**
 * The UNSIGNED transactions that write one file into a container's site store (SiteRegistry): one putFile with the first
 * chunk, then one appendChunk per further chunk, in the order they must be sent. This is the same encoding the SDK uses for
 * the manifest (publishManifest), for any other path. Only encodes: nothing is sent and no key is involved.
 */
export function buildFileTxs(chainId: number, container: string, path: string, contentType: string, bytes: Uint8Array): FileTxs {
  const registry = chainById(chainId)?.siteRegistry
  if (!registry) throw new Error(`no site registry known for chain ${chainId}`)
  if (!bytes.length) throw new Error('a site file cannot be empty')
  const sha256 = toHex(createHash('sha256').update(bytes).digest())
  const txs: UnsignedTx[] = []
  for (let i = 0, index = 0; i < bytes.length; i += FILE_CHUNK_BYTES, index++) {
    const chunk = toHex(bytes.subarray(i, i + FILE_CHUNK_BYTES))
    txs.push({
      to: registry,
      data: index === 0 ? encodeCall('putFile', [container, path, contentType, sha256, chunk]) : encodeCall('appendChunk', [container, path, BigInt(index), chunk]),
      value: '0x0',
    })
  }
  return { size: bytes.length, sha256, txs }
}
