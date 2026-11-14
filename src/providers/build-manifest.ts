const ZERO = '0x0000000000000000000000000000000000000000'

export interface ManifestInput {
  name: string
  circuits: string
  tokenId: string
  container: string
  signer: string
  endpoint: string
  methods: { name: string; priceBEM: string; params: object; returns: object }[]
}

/** A TAPI-20 manifest. Dev: no delegation, zero escrow (the library accepts that only with dev: true). */
export const buildDevManifest = (i: ManifestInput) => ({
  tapeapi: '0.1',
  name: i.name,
  circuits: i.circuits,
  tokenId: i.tokenId,
  container: i.container,
  signer: i.signer,
  delegation: null,
  endpoints: { live: [i.endpoint], async: false },
  methods: i.methods,
  payment: { escrow: ZERO, unit: 'BEM', decimals: 8 },
  dev: true,
})
