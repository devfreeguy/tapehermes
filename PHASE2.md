# Phase 2: payments, delegation, manifest, helper

Status: built and committed locally (not pushed). 168 tests pass in 12 files (`pnpm test`). PRD v0.5 is the source of truth. Not run against the real OKX facilitator yet: you trigger that (section "Real testnet run").

## What was built

| Part | Where | Notes |
|---|---|---|
| A. Payment gate (x402, OKX, sync settle, replay protection, outage handling) | `src/calls/x402-payment-gate.ts`, `facilitator-watch.ts`, `payment-gate.ts`, `calls.service.ts`, `calls.module.ts` | Our own gate on the seller kit core. It passed every test inside the one-day limit, so the middleware fallback was not needed. Settle-count tests are in `test/payments.spec.ts`, replay and outage tests in `test/replay.spec.ts`. |
| A. CORS for the payment flow | `src/calls/cors.ts` | Allows `payment-signature` and `x-payment`; exposes `payment-required`, `payment-response`, `x-payment-response`; preflight answered for every site. |
| A. Log of paid calls | `CallLog.priceUsd` (migration `call_log_price_usd`), `paid`, `paymentTx` | The transaction comes from the settle response, never from a balance read. |
| B. Delegation | `src/sites/delegation.ts`, `sites.service.ts`, `sites.controller.ts` | Typed-data message, signature check against the holder read from chain, expiry status. |
| C. Manifest | `src/manifest/` | Builder, preview, unsigned publish transaction. The provider now serves the same manifest we would publish. |
| D. Helper file | `helper/tapehermes.js`, `helper/lite.js`, build output `helper/dist/` | 50,802 bytes (20,260 gzip, 17,991 brotli), built on the audited `@noble/curves` and `@noble/hashes`. |
| Real run script | `proofs/11-phase2-testnet.ts` | `pnpm phase2:testnet` (real) or `pnpm phase2:testnet -- mock` (dry run, passes). |

Configuration added (all in `.env.example`): `X402_NETWORK` (`eip155:1952` now, `eip155:196` later, no code change), `OKX_API_KEY`, `OKX_SECRET_KEY`, `OKX_PASSPHRASE`, optional `OKX_FACILITATOR_URL`, `EXPIRING_DAYS` (7). Settle mode is fixed to sync. The default asset for each network comes from `@okxweb3/x402-evm`: USDT0 `0x779ded0c...3736` on 196 and `0x9e29b3aa...fb0c` on 1952 (read from the package source). Without OKX credentials the server starts and priced routes answer 503 `PAYMENTS_NOT_CONFIGURED`.

## A. Payments

### Order of verify, our handler and settle (read from the seller kit source)
`@okxweb3/x402-express` 0.1.1, `dist/esm/index.mjs`, lines 129 to 300, and `@tapeapi/server` `index.js:684`:
1. `processHTTPRequest`: no payment header gives a 402 and stops; a payment header is VERIFIED with the facilitator (no charge). Failure stops here.
2. Our handler runs, with its output buffered (not yet sent).
3. `if (res.statusCode >= 400)` the buffered error is released and `processSettlement` is never called.
4. Otherwise `processSettlement` runs; if it fails the buffered answer is thrown away and the visitor gets the facilitator error.
5. If it succeeds the `PAYMENT-RESPONSE` header is added and the answer is released.
The provider maps every failure to a status of 400 or more (`BAD_REQUEST` 400, `METHOD_NOT_FOUND` 404, `INTERNAL` 500, ...), only success is 200.

### How our gate guarantees it
Our gate calls the same two core functions in the same order, with rate limiting in front:
`rate limit, then verify (gate.authorize), then the site provider (worker and signature), then settle`. Settle runs only when the provider status is below 400 AND the envelope says `ok: true` (`calls.service.ts`). Everything else returns as is and nothing is charged.
Proof, with a counting facilitator (`test/payments.spec.ts`, 18 tests): settle count stays 0 when the upstream returns 500, 404 or non-JSON; when the worker policy refuses the host; when the request is bad; when the site is disabled; when the rate limit refuses; when verify fails or the facilitator is down. Settle count goes to 1 only for a successful answer. Also checked: price from the route (a change applies at once), receiver per site and from the payout address (changes apply at once), the free route never touches the facilitator, the 402 charges nothing and is not logged, CORS headers on the preflight, the 402, a paid 200, a free 200 and an error.
The same guarantee was run once more through the shipped helper in `test/helper-e2e.spec.ts` and in `proofs/11-phase2-testnet.ts` (step 2).

### The risk that remains: verify-then-settle (documented, not removable)
The facilitator verify does not reserve funds. If a payer empties the wallet, or spends the same authorization elsewhere, between verify and settle, then: the outside call has already been made, the settle fails, the visitor is not charged and does not get the answer, and the SITE OWNER has paid for one outside call. Mitigations in place: rate limit before verify (a limit per route and per visitor hash, a cap per site), small prices, the answer is withheld until settle succeeds so nothing is given away free. Not mitigated: a determined payer can cost the owner one outside call per rate-limit slot. If an outside call is expensive, set the route rate limit low. Test: `settle fails after a good answer` (answer withheld, upstream hit count 1, nothing logged as paid).

### Things observed while building (they change behaviour you might assume)
- **The x402 flow makes two requests** (the 402 challenge, then the paid retry). Counting both against the route limit halved the real capacity, so a bare challenge now has its own bucket (the larger of 300 and five times the route limit per minute) and only real payment attempts count against the route limit, before verify.
- **A facilitator outage** used to reach the visitor as a 402 (the seller kit turns every facilitator exception into "payment invalid"). It is now a 503 with the code `PAYMENT_SERVICE_UNAVAILABLE`, see the next section.
- **A failed settle** carries a `PAYMENT-RESPONSE` header with `success: false`. The helper reports the failure from the body and the status.
- **Replay** is now refused by our own Redis record, see the next section. What OKX itself does with a used authorization is still unknown; the real run has a diagnostic step for it.
- **`PUBLIC_BASE_URL` must be https** when the dev switch is off (a real manifest needs an https endpoint). The server now refuses to start otherwise.

### Facilitator outage: 503, never 402
The OKX client throws on a network failure and on any non-2xx answer (`OKX verify failed: 500`, source of `OKXFacilitatorClient`), and the seller kit core then converts every such exception into a 402 "payment invalid" (`processHTTPRequest`, `chunk-NYKB44OI.mjs` around line 1343). A 402 invites a client to sign again, so an outage must not look like one. `src/calls/facilitator-watch.ts` wraps the facilitator client: a throw from verify or settle marks the running request (AsyncLocalStorage) as an outage. The gate then answers **503 `PAYMENT_SERVICE_UNAVAILABLE` with `retry-after`** and no `payment-required` header; a normal "isValid: false" stays a 402 `PAYMENT_INVALID`. The same code is used when the payment checks (Redis) are down, when the facilitator cannot be initialised, and when a settle outcome is unknown (the message then says to check the wallet before paying again). Logged as REFUSED with that code; nothing is charged, the outside call never runs.
Helper side: an unsigned error answer (503, 429, 404 ...) is reported as its own error (`HermesError` with the server code, `details: { signed: false, status, retryable, paid: false }`), never as a bad signature, and the wallet is never prompted again inside that call: one signature at most per `call()`. A later `call()` is the visitor trying again on purpose and asks once more. An unsigned SUCCESS is still refused as `BAD_SIGNATURE`.
Tests: `test/payments.spec.ts` (503 and code, no payment-required header, outside call 0, settle 0, logged; an invalid payment is still 402) and `test/helper-e2e.spec.ts` (outage gives `PAYMENT_SERVICE_UNAVAILABLE` with the wallet log showing exactly one signature, then a deliberate retry works; a 429 before payment touches the wallet zero times; an unsigned success is refused).

### Replay protection (a payment buys one answer)
Before the facilitator is asked, the gate claims the payment in Redis (`SET NX`). A second use is refused with **402 `PAYMENT_ALREADY_USED`** before verify and before the outside call.
- **Key:** `<prefix>payment:<sha256>`, where the hash is over `(network, asset, payer, nonce)` of the EIP-3009 authorization, lowercased. It is a hash and never the header text or any address. It is deliberately NOT a hash of the header: the same authorization can be re-encoded (whitespace, field order, an extra member) into a different header text, which would walk past a header hash. A test re-encodes a used header and it is still refused. The stored value is the string `1`.
- **Lifetime:** taken from the authorization own `validBefore`: time left plus 30 s, at least 5 s, at most 24 h (so a hostile far-future `validBefore` cannot pin a key). A header that does not carry a readable identity is refused with 402 `PAYMENT_INVALID` before the facilitator is asked, because without an identity there is no replay protection.
- **Released** (the same payment can be retried) when the call ends without a settle: the payment did not verify, the facilitator was down, the outside call failed or was refused, the provider threw, or the facilitator itself answered that the settle failed. **Kept** after a successful settle, and also after a settle whose outcome is unknown (exception or timeout): the transfer may have happened, so the payment must not buy a second answer.
- **Two requests at once** with the same payment: one is served, one is refused, one outside call, one settle (test).
- Tests in `test/replay.spec.ts` (11): replay after success is refused with zero outside calls and no facilitator call; re-encoded header refused; a retry after a failed call is allowed and settles once; invalid payment, outage and explicit settle failure each release; unknown settle outcome keeps the record; concurrency; the key is a 64-hex hash with no header, address, nonce or signature in it and a lifetime within the authorization window; unreadable headers are refused without a record; plus unit tests of the identity and lifetime rules.
Cost to know: the claim is made before verify, so each payment attempt is one Redis write. If Redis is down the gate fails closed (503), because a claim cannot be made.

### Real testnet run (you trigger it)
```
pnpm phase2:testnet            # real: needs OKX credentials in .env, a funded buyer (.fresh-wallet.json or TESTNET_PRIVATE_KEY)
pnpm phase2:testnet -- mock    # dry run, no network, no money (this passes today)
```
It starts the real backend on the TEST database, registers a throwaway site with a fresh receiver wallet, and uses the shipped helper to: (1) pay `$0.001` for a route backed by a real public API, with the real OKX verify and sync settle; (2) call a route whose outside call fails and check that nothing moves; (3) replay the first payment header and check that OUR guard refuses it; (3b) a diagnostic: delete our record and replay once more, to see what OKX itself does with a used authorization (it costs one outside call to the public API, and the script then checks that exactly one price moved in total); (4) check the call log; and it reads the Transfer event from the settlement transaction instead of relying on a balance read. Send me the output (it prints no secret). Only one stub: the site holder is read from a local table instead of chain 196. If your local run fails on OKX reachability I will prepare the Oracle VM route.

## B. Delegation
- `GET /api/sites/:name/delegation/message?days=30` returns the exact EIP-712 payload (`Delegation(container, signer, expires)`, domain `TapeAPI` v1, chain 196, verifying contract = the hub from the SDK chain table) for 1 to 366 days (default 30), plus `expires` in unix seconds. Nothing is stored. It is typed data, not plain text: the wallet shows container, signer and expiry.
- `PUT /api/sites/:name/delegation {signature, expires}` re-reads the holder from chain, recovers the signer from the signature and stores it only if it equals that holder (EOA holders only; a contract holder is refused). It also checks the expiry is in the future and at most 366 days away. Wrong wallet, wrong expiry, wrong site, wrong container or signer, malformed signature, holder changed, chain down: all refused and nothing stored (21 tests).
- Expiry status on every site view: `delegation: { stored, status: none | valid | expiring | expired, expiresAt, daysLeft }`; expiring at 7 days or less (`EXPIRING_DAYS`).
- With the dev switch OFF the site now serves for real: no delegation gives 503 `DELEGATION_REQUIRED`, an expired one 503 `DELEGATION_EXPIRED`, a valid one serves a manifest that includes the delegation. This was proven offline (the provider enforces expiry itself). What is NOT proven: a live client resolving our manifest from chain, which needs our own site (19 to 20 Nov).

## C. Manifest
- Built from the enabled routes and the stored delegation (`src/manifest/manifest-builder.ts`). Every route is `priceBEM: "0"`. The USD price is in one namespaced member, approved name `tapehermes`:
```json
"tapehermes": { "v": 1, "currency": "USD", "x402": { "network": "eip155:1952" }, "price": { "fxRate": "0.002", "free": "0" } }
```
No `payTo` is published (the 402 carries the receiver per call). The built manifest passes the SDK validator in live mode (`validateManifest(m, { requireDelegation: true })`), has no `escrow` (allowed when every method is free), and is flagged `dev: true` only when the dev switch is on. The names `usdPricing` and `agent` are avoided because the SDK already uses them.
- `GET /api/sites/:name/manifest` shows the manifest that would be published, its size and SHA-256, and `problems` (no route, no delegation, expired delegation, too large) with `publishable`.
- `POST /api/sites/:name/manifest/publish-tx` returns the UNSIGNED transactions from the SDK (`tx.publishManifest`: SiteRegistry `putFile` and `appendChunk`), with `from` (the holder), size and hash. It first re-reads the holder from chain, re-checks that the stored delegation really recovers to that holder, and runs the live validator. Nothing is sent and the server never holds the holder key. Gas: about 447,000 for a 684-byte manifest (Phase 0 simulation); a manifest with many routes is bigger and costs more (limit 60,000 bytes here; clients read at most 64 KiB).
- The content signature (TAP-11 section 5) is not used, as decided; verified optional (see the verification section).

## D. Helper file for site builders
`helper/dist/tapehermes.min.js` (ES module) and `tapehermes.iife.min.js` (sets `window.TapeHermes`). One file, no imports, no network except the calls themselves.

Size: **50,802 bytes (20,260 gzip, 17,991 brotli)** against 963 KB in Phase 0. How: not bundling viem or the OKX libraries (the helper builds the EIP-3009 typed data itself and lets the wallet sign) took it to 57.8 KB with the SDK signature code tree-shaken. An earlier build replaced the secp256k1 library with a hand-written routine to reach 17 KB; **that was removed on your instruction**. The helper now uses only the audited `@noble/curves` (secp256k1 recover) and `@noble/hashes` (keccak), tree-shaken, pinned to the SDK versions (1.9.7 and 1.8.0). `helper/lite.js` is now only glue: address checksum, the TAP-13 answer digest, the TAP-11 delegation digest, and the recover rules (v of 0 and 1, high s refused, r and s ranges). `test/helper-lite.spec.ts` (7 tests) still compares it with the SDK on 120 random signatures, on v of 0 and 1, on what both must refuse (high s, bad v, zero or oversized r and s, wrong length, a point not on the curve), and that the answer-envelope and delegation digests and the hub constant equal the SDK ones. The 20 helper end-to-end tests and the real-run script use the shipped bundle.

Use (in a file of the TapeOut site, uploaded with content type `text/javascript`):
```html
<script type="module">
  import { createHermes } from './tapehermes.min.js'
  const hermes = createHermes()                          // on a TapeOut site: manifest read from this site's own origin
  const r = await hermes.call('fxRate', { from: 'USD' })   // handles 402, wallet signing, retry, verification
  console.log(r.result, r.paid, r.transaction, r.trust)
</script>
```
Options: `expectedSigner`, `rpcUrl` (X Layer RPC for the holder check), `requireHolderCheck`, `maxPriceUsd`, `ethereum` (default `window.ethereum`), `dev: { siteUrl }`.

Trust model (as decided):
- On a site it reads `/.well-known/tapeapi.json` from its own origin, which the TapeKit gateway serves from chain (verified above in the source; a positive read is still unproven). `r.trust.source` says `site-origin`, and `r.trust.gateway.mode` repeats the gateway `x-tape-mode` (`client` = checked in the browser, `server` = the gateway's server read it, so the gateway must be trusted).
- Our endpoint is a fallback for local development only (`dev.siteUrl`) and is reported as `endpoint (DEVELOPMENT ONLY)`. It never silently falls back: no manifest on the origin gives `MANIFEST_UNAVAILABLE`. A manifest flagged dev from the site origin is refused (`DEV_MANIFEST`).
- It checks the delegation signature recovers to an address, that this address is the current holder (`ownerOf` through `rpcUrl`, or through the wallet when the wallet is on 196; otherwise `holderCheck: "unchecked"` is reported and `requireHolderCheck` turns that into a refusal), that it has not expired, and that the answer is signed by the manifest signer, for this container, this request id, this method and these params (changed bodies fail). Optional `expectedSigner` pins the signer.
- Before signing a payment it refuses if the price asked differs from the manifest price (`PRICE_MISMATCH`) or exceeds `maxPriceUsd`; the wallet is never asked. 20 end-to-end tests run the built file against the real app with a fake EIP-1193 wallet, including a wallet that starts on mainnet and is switched to the payment network.
- Limits: window.ethereum only (no WalletConnect); not run in a real browser or on the real gateway; holder check needs `rpcUrl` or a wallet on X Layer; the site's CSP must allow `connect-src` to our server (Phase 0 saw https allowed).


## E. How to create your own site on X Layer (chain 196). Research only, nothing spent.

Costs were read on-chain on 14 Nov 2026 (read-only `eth_call` through `rpc.xlayer.tech`, block about 75,896,000). Everything else is quoted from the sources named. Amounts are in OKB.

### Do the official tools support X Layer?
- **Official TapeOut app (tapeout.net): yes, by its own code.** I read its published bundle (`https://tapeout.net/app/assets/index-B42CEsqR.js`). It has an X Layer configuration (id 196, symbol OKB, area 2, factory `0x1f09...0761`, opener `0x536a...0106`). Its processor-create form reads `deployFee` for the chosen chain and has a per-chain default transistor price (`196: "0.00066"`). It has an X Layer processor page ("Anyone can mint. You pay in OKB on X Layer", tagged "Test phase"). Its text says: "You can now tape out to X Layer from the canvas ... pick X Layer under 'Tape out on which chain'. Circuits already taped out cannot be loaded back into the canvas yet, and designs that reference a sub-circuit cannot go to this chain yet." It also has a container "Opening fee, one-off per container". Not click-tested (no wallet, nothing spent).
- **HashPort console: not verified.** The TapeKit README calls HashPort "the hosted console, domain binding and fees run by the HashPort team" and says the console uploads a folder, hashes it and signs transactions. I found no console URL and no statement about X Layer in the TapeKit README, SPEC or the TapeOut app. `hashport.io` is an unrelated Japanese company site. A Binance Square post (promotional) says DeWEB supports BNB Chain, X Layer and Base. So: do not plan on the console until the TapeOut team confirms it.
- **Publishing without the console works on any chain:** the SiteRegistry on X Layer is `0xd6EFb7adCc9c83dC4924Ad56f6a8E4e969b9ADB6`, and TapeKit SPEC Appendix B.5 defines `putFile` and `appendChunk` for the holder (or an operator). The SDK's `tx.publishManifest` builds exactly these calls. TapeKit's handbook says an open-source publishing CLI is only "on the roadmap".

### Steps and costs (cheapest path: your own processor)
Method follows the TapeAPI repo note `docs/CHEAPEST-CIRCUIT.md` (written for BNB Chain; the steps are the same, the amounts below are the X Layer values I read).

| # | Step | Where | Cost on X Layer | Evidence |
|---|---|---|---|---|
| 1 | Create your own processor (name, supply, transistor price; price and name cannot be changed later) | tapeout.net, "create" | `deployFee()` = 10,000,000 wei = 0.00000001 OKB, plus gas | read from the factory contract |
| 2 | Mint a few NAND transistors on your processor (set the price to 0 when creating it; the app has a "Free" label for L2 processors) | tapeout.net, your processor page | price 0 + `protocolFee()` = 1,000,000 wei per mint transaction, plus gas. If you leave the form default the price is 0.00066 OKB each | `protocolFee()` read on chain; default from the app bundle |
| 3 | Tape out the smallest circuit (one NAND) on X Layer; the transistors are burned and you get circuit NFT #1 | tapeout.net canvas, "Tape out on which chain: X Layer" | `TAPEOUT_FEE()` = 0.0013 OKB, plus gas | read from processor 396's circuit contract. I assume a new processor uses the same value; confirm in the wallet before signing |
| 4 | Open the container (one-off per container) | circuit page, "Container" | **`FEE()` = 0.08 OKB** | read from the opener contract |
| 5 | Name activation | not needed on X Layer today | `DomainBinding.monthlyFee()` = 0 on chain now (the TapeKit README text says 0.08 per 30 days; the chain value is what clients use and it can change) | read on chain |
| 6 | Publish files: first the manifest (`/.well-known/tapeapi.json`), then the demo page and helper | our dashboard or a script, signed by the holder | gas only. Gas price now 20,000,001 wei; the 684-byte manifest simulation was 447,088 gas = about 0.0000089 OKB. File bytes cost about 200 gas per byte, so a 30 KB helper is roughly 6 million gas, about 0.00012 OKB | gas price read on chain; 447,088 from Phase 0 |

**Total, minimum: about 0.0813 OKB plus gas for about 8 transactions (well under 0.001 OKB at today's gas price).** Nearly all of it is the 0.08 OKB container opening. Multiply by the current OKB price for dollars; I did not fetch a price.

### Cheapest and simplest route
1. Create your own processor in the official TapeOut app on X Layer with the transistor price at 0, mint 2 NAND, tape out a one-NAND circuit, open the container. About 0.0813 OKB in fees, all steps in the app's UI, one wallet.
2. Publish the manifest and the demo files with our own tooling (the SDK builds the transactions; we add file upload). No dependence on the HashPort console.
3. Alternative I did not price: buy an existing circuit NFT on `tapeout.market` (it lists X Layer). The BNB note says market transistors cost more than the whole self-build path; I did not check X Layer prices or open-container status, so treat it as unknown.

### Risks and unknowns for E
- Click path in the app not tested; amounts come from contract reads and the app code, not from a wallet prompt.
- `deployFee` of 10,000,000 wei looks like a placeholder; it may change.
- The app marks X Layer pages "Test phase"; the BNB pages are not so marked.
- The TapeKit docs say nothing is audited.
- Selling or listing the circuit blocks edits while it is listed on the market (handbook section 11).

## Verifications requested before the build

### TAP-11: the manifest-content signature is optional, and a live client accepts a manifest without it
- TAP-11 section 5 is titled "Manifest content signature (optional)". Section 5.1: a client may ignore the section. Section 5.3: a client may verify `contentSig` when present, and may offer a setting that requires one; only under that setting is a manifest without it `manifest-invalid`. The Rationale states it is optional.
- TAP-11 section 3.1: clients must ignore members they do not know, at every level. That covers the `tapehermes` member.
- SDK 3.0.0: `requireContentSig` defaults to false (`index.js:432`); live (non-dev) resolution checks `contentSig` only when present or required (`index.js:1809`); the TAP-10 conformance path does the same (`index.js:2478`).
- Limits: a client that turns on `requireContentSig` rejects our manifests. Read from code and spec; not run against a real chain (needs our own site).

### TapeKit gateway serves `/.well-known/tapeapi.json`
- `kernel/src/path.js` `normalizePath` rejects only `.` and `..` segments, so the dot directory passes. The gateway reserves only `/sw.js` and `/.tape/*`; every other path is read from the chain and checked against its on-chain hash. The SDK publishes the manifest under the key `.well-known/tapeapi.json`.
- Live check: `https://1-2-396-open.tapekit.org/.well-known/tapeapi.json` answered the gateway's own not-found page with `x-tape-status: ok`, so the path is routed to the chain lookup (that site simply has no manifest).
- Not proven: a positive read of a real published manifest (needs our own site).

## How to run
```
pnpm services:up                     # Postgres and Redis (see PHASE1.md for the image-tag note)
pnpm db:migrate                      # includes the new call_log_price_usd migration
pnpm helper:build && pnpm helper:size
pnpm test                            # 168 tests, mock facilitator only, never touches OKX
pnpm phase2:testnet -- mock          # dry run of the real-run script
pnpm phase2:testnet                  # the real testnet run (you trigger it)
```
New API: `GET /api/sites/:name/delegation/message`, `PUT /api/sites/:name/delegation`, `GET /api/sites/:name/manifest`, `POST /api/sites/:name/manifest/publish-tx`. Changed: `PUT .../delegation` takes `{signature, expires}` (unix seconds) and now verifies the signature; `GET /api/sites/:name` shows the delegation status.

## Open questions
1. **Price of an outside call to the owner** (verify-then-settle risk above): should the dashboard show a warning when a route price is far below the likely outside cost, or enforce a per-site daily cap on unpaid-settle failures?
2. **Contract-wallet holders** (EIP-1271) are refused for delegation and sign-in. Does any site you care about have a contract holder? (If the owner site is a Safe, this blocks us.)
3. **Helper hosting of the holder check:** `rpcUrl` should point at an X Layer RPC that allows browser calls (CORS). We have no such public endpoint confirmed (xlayerrpc.okx.com was unreachable from the dev machine; `rpc.xlayer.tech` answers from the server side, CORS not tested). Do you want us to proxy a read-only `ownerOf` through our server instead (a visitor then trusts us for that one check)?
4. **E. Your own site:** go with "own processor, 2 NAND at price 0, one-NAND circuit, open container" (about 0.0813 OKB plus gas)? And who holds the wallet for it (a throwaway the team controls, or yours)? The site must exist by 19 to 20 Nov for the real delegation test.
5. **The gateway tier:** the helper reports `x-tape-mode` but does not forbid the `server` tier. Should it refuse paid calls when the manifest was read in `server` mode (gateway trusted)?
6. **Mainnet switch:** `X402_NETWORK=eip155:196` changes the asset to USDT0 `0x779ded...` from the package source. We have not tested mainnet fees or whether OKX seller billing differs. Same open item as Phase 0.
7. **A refused payment still costs a Redis write and a log row** (REFUSED rows are written for every attempt except a bare 402 challenge). If a flood of bad payments worries you, say so and I will cap those log rows per window the way rate-limited rows already are.
