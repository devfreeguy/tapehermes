# TapeHermes PRD v0.4

Date: 13 Nov 2026
Status: Draft, Phase 0 run (results in section 11 and FINDINGS.md), Phase 1 starting
Submission: target 5 Dec 2026. Official deadline 7 Dec 2026 23:59 UTC (buffer 6 to 7 Dec)

## 1. Summary

TapeHermes is a hosted backend for TapeOut websites on X Layer. A site owner connects their site, stores secret API keys with us, defines routes (calls to outside services) and sets a price per call. We run the calls. Visitors pay per use in USDT. Every answer is signed so it is provably from that site.

## 2. Problem

TapeOut sites are fully on-chain and static. They cannot hold secret API keys, call paid outside services, or charge visitors, and owners who want this must run their own server. TapeHermes removes the server.

## 3. Users

| User | Description | Need |
|---|---|---|
| Site owner | Holds a TapeOut site (e.g. `5.2.400.tape`), does not want to run a server | Use outside APIs safely, earn from paid calls |
| Visitor | Uses an owner's site | Pay small amounts per paid call, trust the answer |

## 4. Goals and non-goals

### Goals (v1)
- Owner goes from wallet connect to a live service without running any server.
- Visitors pay per call in USDT on X Layer, settled directly to the owner's wallet.
- Every answer is signed and verifiable by the helper file.
- One working demo site on DeWEB.

### Non-goals (v1)
- Owners uploading their own code
- Our own billing of owners (free during the hackathon)
- Payouts (OKX settles straight to the owner)
- Multi-chain
- Teams or multi-user accounts

## 5. Scope

In v1: wallet sign-in, site ownership proof, key safe, settings-only routes, pay per use (USDT on X Layer), signed answers, call logs, dashboard, helper file, one demo site on DeWEB.

## 6. User flows

### A. Owner setup
1. Connect wallet, sign a one-time message.
2. Enter site name. Server reads the chain and confirms this wallet holds that site.
3. Server creates a signing key for the site (holds no funds).
4. Owner signs a delegation: "this key may answer for my site until `<date>`". Library default 30 days, allowed 1 to 366.
5. Owner adds secrets and routes: outside URL, which secret goes in which header, allowed inputs, fields to return, price in USD.
6. Owner publishes the service manifest to their site (one on-chain transaction from their wallet). Site is live.

### B. Visitor call
1. Site calls our endpoint through the helper file.
2. Paid route: we answer "payment required". Wallet signs. Helper retries.
3. OKX verifies and settles USDT straight to the owner's wallet. The visitor pays no gas: OKX's relayer sends the transaction (proven, section 11).
4. Worker calls the outside service with the secret, under strict rules (https only, max 3 hosts, no redirects, 256 KB cap).
5. We sign the answer and return it. Helper checks the signature.

### C. Renewal
We warn before the delegation expires. Owner re-signs and republishes.

## 7. Functional requirements

| ID | Requirement |
|---|---|
| FR1 | Wallet sign-in using a one-time message stored in Redis |
| FR2 | Site ownership verified by reading the chain (holder equals signed-in wallet) |
| FR3 | One signing key per site, generated server side, holds no funds |
| FR4 | Delegation signed by owner, 1 to 366 days, default 30 |
| FR5 | Secrets stored AES-256-GCM encrypted, never shown again after saving, never logged |
| FR6 | Routes defined by settings only: method, URL, secret to header mapping, allowed inputs, returned fields, price, enabled, limits |
| FR7 | Worker enforces https only, max 3 hosts, no redirects, 256 KB cap, blocks private addresses |
| FR8 | Paid routes return payment required, then settle USDT to the owner's wallet via OKX x402 |
| FR9 | Free routes protected by rate limits and caps |
| FR10 | Every answer signed with the site's key and verifiable by the helper file |
| FR11 | Call log per route: time, result, paid, payment tx, duration. No visitor personal data |
| FR12 | Dashboard to manage sites, secrets, routes, logs, and publish the manifest |
| FR13 | Expiry warning before delegation ends |
| FR14 | Helper file for TapeOut sites handling payment retry and signature check |
| FR15 | Demo site live on DeWEB |

## 8. Data model

- Owner: wallet
- Site: name, container, holder, signer address, encrypted signer key, delegation, expiry, status
- Secret: name, encrypted value
- Route: method, outside-call settings, price, enabled, limits
- CallLog: route, time, result, paid, payment tx, duration

No visitor personal data is stored.

## 9. Architecture

### Stack (versions checked 11 Nov 2026)
- Backend: NestJS 12.4 (ES modules, built with nest build), Node 22+, TypeScript 6.x (matches the Nest scaffold; npm latest is 7), pnpm
- Database: PostgreSQL, Prisma 7.10.1 stable (the CLI "latest" tag is an 8.0 release candidate; use 7 stable, never 6)
- Redis: rate limits, one-time sign-in messages, short caches
- Identity and signing: @tapeapi/sdk and @tapeapi/server 3.0.0 (GitHub release files, checksums verified, ES modules only, MIT). Not on npm, so pnpm needs an override mapping @tapeapi/sdk to the tarball
- Worker: the library's web2-adapter in hosted mode (MIT, keep credit)
- Payments: @okxweb3/x402-express 0.1.1, x402-core 0.1.0, x402-evm 0.2.1; buyer side @okxweb3/x402-fetch 0.1.0. Facilitator host in code: https://web3.okx.com (the README says www.okx.com). Testnet token: USD₮0 0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c, 6 decimals, EIP-3009. Buyer signer must be built as { address, signTypedData } (the x402-fetch README example fails)
- Chain: viem 2.x. X Layer mainnet 196, testnet 1952
- Key safe: AES-256-GCM (Node built-in), master key in server .env
- Dashboard: Next.js 16, shadcn, wagmi
- Deploy: Oracle VM in Ashburn, /opt/apps/tapehermes, shared Postgres and Redis. RPC and OKX reachability are handled at deployment

### Modules (one job each, reused everywhere)
chain (read site, holder) / auth (wallet sign-in) / vault (encrypt, decrypt) / sites / secrets / routes / worker (outside calls) / signing (one signer per site) / payments (price and receiver per route) / calls (the pipeline in 6B) / logs / health.

## 10. Risks and mitigations

| Risk | Answer |
|---|---|
| Sites using us lose the "100% on-chain" badge | Accepted, stated openly |
| Anyone can call our endpoint pretending to be the site | Paid routes protect themselves; free routes get rate limits and caps |
| We hold owners' secrets | Encrypted, never shown again after saving, never logged |
| A leaked signing key cannot be revoked | Short delegations (30 days default) |
| Owner must do one on-chain transaction | Dashboard walks them through |
| We run other people's settings | Hosted rules block private addresses. Note: the library checks the resolved address, then fetch resolves again, so DNS rebinding is not fully closed (read from code, not tested) |
| OKX restricts some regions (the developer's location cannot reach OKX hosts without a VPN; cause not confirmed, OKX terms not read) | Open. Owners or visitors in restricted regions may be unable to pay or receive. Read OKX's terms before choosing where the server runs; consider asking OKX or the organizers |
| X Layer has only two independent RPC operators, so quorum 2 has no spare | Add a third node of our own before launch. Set RPC URLs explicitly: with the SDK default list, one dead node made a read take 35 s instead of 5 s |
| The library's CORS is fixed (any origin, headers content-type and accept) and blocks the payment header on the retry | The payments layer answers preflights itself and exposes the PAYMENT headers. Real browser test from the gateway not done |
| Async settlement answers before the transaction is mined | Choose settle mode deliberately: async about 0.9 s faster, sync waits for chain confirmation (observed, one sample each) |
| Secrets can only go in headers in the hosted adapter, not in the URL or query | Owners whose outside API wants the key in the URL are not supported in v1 |
| Paid methods are priced in BEM against an escrow that exists only on BNB, not on X Layer | Open decision: how our USD/x402 price appears in the manifest (section 14) |

## 11. Phase 0 proofs (not assumed)

Each must pass or the plan changes. Results as of 12 Nov 2026 (evidence and commands in FINDINGS.md):

1. ES-module-only library works inside NestJS. WORKED.
2. One server can run one signer per site for many sites. WORKED in dev mode (keys and paths isolated; signer-to-container authorisation needs a real delegation, not yet tested).
3. Signing and checking work for a site on chain 196 (2 RPC operators). WORKED in dev mode against the real container of 1.2.396.tape; the real holder delegation path is NOT verified.
4. Receiver wallet can be set per site at runtime (docs show fixed). WORKED: the payTo option accepts a function; two sites with two receivers settled live and each address received exactly its payment.
5. A browser wallet can pay through @okxweb3/x402-fetch. WORKED once (one wallet, wallet name not reported); also from a script and from a brand-new wallet holding zero OKB.
6. OKX fees and settlement time (not documented). OBSERVED on testnet: no fee taken from the amount; async responded in about 0.9 s, mined about 1.2 s after the request; sync responded in about 1.7 s, mined about 2.1 s. One sample per mode. Mainnet and separate seller billing not verified.
7. Calls from a site on the public gateway pass CORS. WORKED at header level for both gateway origins (https://1-2-396.tapekit.org and the -open variant); payment headers need our own CORS handling; no real browser test from the gateway.
8. Publishing the manifest on X Layer from our dashboard. WORKED as a read-only simulation (about 447,000 gas for a 684-byte manifest, sender = holder); a real publish is NOT verified and needs a site we control.

## 12. Success criteria (confirmed)

- Demo: an owner goes from sign-in to a live paid route in one sitting, with no server.
- A visitor pays in USDT and receives a signed answer that the helper verifies.
- Payment lands in the owner's wallet, not ours.
- No secret value ever appears in logs or API responses after saving.
- All 8 Phase 0 proofs documented as pass or fail (done, with the gaps listed in section 11).

## 13. Engineering rules (every coding session)

- Never assume. Verify in docs or source, or stop and ask.
- Extract every reusable function, class and module into its own file.
- Before writing new code, look for an existing function. Extend it only if it serves both uses cleanly without breaking the first. Otherwise write a new one.
- No big files. Shortest clear code. No duplication.
- No em dashes. Surgical edits only.

## 14. Open decisions

- Dashboard on a normal web host: decided.
- Final name: TapeHermes pending domain and GitHub check.
- Which outside API the demo site uses.
- Real delegation path: decided. We create our own site on chain 196 around 19 to 20 Nov to test holder-signed delegation, the signer-to-container check and a real manifest publish. Until then the backend is built against dev mode behind one clearly named switch.
- Manifest pricing: proposed, not final. Routes are listed as free in priceBEM plus our own separately named field for the USD price. To be confirmed with the owner in Phase 2.
- Renewal: decided. The owner signs and republishes every time. No setOperator.
- Server region: decided. Oracle VM in Ashburn. RPC and OKX reachability are handled at deployment.
- Settle mode: decided. Sync.
- Third RPC node for X Layer: open.

## 15. Timeline

| Dates | Milestone |
|---|---|
| 11 to 13 Nov | Phase 0 proofs |
| 14 to 19 Nov | Sites, key safe, routes, worker |
| 20 to 24 Nov | Payments, signed answers, helper file |
| 25 to 30 Nov | Dashboard, demo site on DeWEB |
| 1 to 5 Dec | Polish, video, submit on 5 Dec |
| 6 to 7 Dec | Buffer |

## Changes from v0.1

- Fixed timeline typo "1 to 5 Nov-Dec" to "1 to 5 Dec".
- Added Problem, Goals/non-goals, numbered functional requirements and proposed success criteria (section 12 is new and unconfirmed).
- Content otherwise unchanged.

## Changes in v0.3 (12 Nov 2026, approved by the owner)

- Deadline wording: target 5 Dec, official deadline 7 Dec 23:59 UTC.
- Stack: verified versions and facts from Phase 0 (TypeScript 6.x, pnpm override for the tarballs, x402-evm 0.2.1, facilitator host, testnet token, buyer signer note).
- Flow B step 3: visitor pays no gas (proven).
- Risks: added OKX regional restrictions, RPC operators, CORS and payment headers, async settlement, header-only secrets, BEM pricing, DNS rebinding note.
- Section 11: Phase 0 results added to each proof. No proof text was removed.
- Section 14: added open decisions from Phase 0.
- Not changed: scope, goals, functional requirements, data model, modules, engineering rules, timeline.

## Changes in v0.4 (13 Nov 2026, approved by the owner)

- Decided: dashboard on a normal web host; settle mode sync; renewal by the owner every time (no setOperator); own site on chain 196 around 19 to 20 Nov with dev mode behind one named switch until then; server on Oracle VM in Ashburn.
- Proposed, not final: manifest pricing (free in priceBEM plus our own USD price field), to be confirmed in Phase 2.
- Section 12 success criteria confirmed.
- Nothing else changed.
