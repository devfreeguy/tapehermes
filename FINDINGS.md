# TapeHermes Phase 0 Findings

Status at 11 Nov 2026: all eight proofs and the final check have been run. Open: the wallet name for the browser run (not reported), the real delegation path (proofs 2, 3, 8: needs a site we hold), (the live two-receiver test and the gas question are now answered, see "Follow-ups"). The "Blocker" section below describes the earlier OKX connectivity problem; OKX was reachable for the live run.
No private key touched mainnet and no mainnet transaction was sent (mainnet use was read-only). Testnet payments were made with test keys; their transaction hashes are below. No secret from `.env` appears here (wallet and transaction addresses are public chain data).

## Final summary (12 Nov 2026)

- Worked: proofs 1, 2, 3, 4, 5, 6, 7, 8 and the final paid call, within the limits written in each section. The PRD (v0.3) now carries these results.
- Not verified: the real holder-signed delegation path, the signer-to-container authorisation, and a real manifest publish (all need a site we control on chain 196); mainnet fees and speed; seller billing by OKX; a real browser calling the server from the tapekit.org gateway; wallets other than the one used once (name not reported).
- Biggest surprises: dev mode proves less than it looks; X Layer has two RPC operators and one default node was unreachable here; the library prices in BEM on BNB, not USDT on X Layer; OKX hosts are blocked from the developer's location without a VPN; the visitor pays no gas.

### Questions for the owner (open)
1. Delegation path: we need a TapeOut site we control on chain 196 (or a testnet equivalent) to test holder-signed delegation, the signer-to-container check and a real manifest publish. How do we get one: mint or buy a site on 196, ask the TapeOut/TapeKit team for a test site, or accept this as an open risk and build the product against dev mode first?
2. Manifest pricing: how should a USD/x402-priced route appear in the manifest, given priceBEM and the escrow exist only on BNB?
3. OKX regions: do you want to ask OKX or the organizers whether builders in your region can use the facilitator, and where should the server run? Have you read OKX's terms on restricted regions?
4. Renewal: owner signs and publishes every time, or the owner authorises our server as a time-limited operator (setOperator) to republish?
5. Settle mode: async (faster, answers before the transaction is mined) or sync (waits for confirmation, about 0.9 s slower)?
6. Third X Layer RPC node: use a paid provider or our own node before launch?
7. Wallet used in the browser run: name and version, if you want it on record (optional).
8. The existing dashboard, name and demo-API decisions from PRD section 14 are still open.

Setup once: `pnpm install` (tarballs are in `vendor/tapeapi-3.0.0/`, SHA256 verified against the release `SHA256SUMS`).
Numbering below follows the proof list in your brief (the PRD file calls the same list section 11).

| # | Proof | Result |
|---|---|---|
| 1 | ES-module-only libraries inside NestJS | worked |
| 2 | Two signers, two sites, one process | worked (dev mode, see limits) |
| 3 | Hosted web2-adapter, signed answer, chain 196 | worked in dev mode; real delegation path could not verify |
| 4 | OKX seller kit, per-site receiver | worked: per-request `payTo` function accepted; two sites with two different receivers settled live and each address received exactly its own payment (chain reads) |
| 5 | Pay from script and browser wallet | script worked (real OKX testnet, async and sync). Browser wallet: worked in one run reported by the user (screenshot, 12 Nov); wallet name and version not reported |
| 6 | OKX fees and settlement time | observed on 2 real payments (see "Live OKX testnet run"); sample size is one per mode |
| final | One paid testnet call, signed answer verified by buyer | worked (signer is a dev-mode signer, see proof 3 limits) |
| 7 | CORS for the TapeKit gateway | worked at header level; real browser test could not verify |
| 8 | Publish-manifest transaction, simulated | worked; real publish could not verify until we own a site |

## Proof 1: ES modules inside NestJS. WORKED

Command: `pnpm proof:1`

Approach chosen (evidence: `package.json` of each package, `@nestjs/core@12.4.2` metadata, the official `nest new` scaffold):
- `@tapeapi/sdk` and `@tapeapi/server` are `"type": "module"` with an `exports` map and bundled `.d.ts`.
- NestJS 12.4.2 is itself `"type": "module"`, and the official CLI scaffold (`@nestjs/cli@12.0.12 new`) generates an ESM project: `module/moduleResolution: nodenext`, relative imports ending in `.js`, top-level `await`. So no dynamic `import()` or bundler workaround is needed. We copied that tsconfig shape and build (`nest build`, which runs `tsc`).
- Nest's default body parser would consume the request stream, which the provider reads itself. We start Nest with `bodyParser: false` (`src/bootstrap.ts`).
- Each site gets a Nest controller route `/sites/:site/*` that strips the prefix and calls the library's Node handler (`src/providers/sites.controller.ts`).

Differences from the docs:
- Both packages are not on npm. The server depends on `@tapeapi/sdk@^3.0.0`, which npm/pnpm cannot find, so `pnpm install` fails unless the SDK is overridden to the tarball. We use `overrides` in `pnpm-workspace.yaml` (pnpm 11 location). One SDK copy results (checked in `node_modules/.pnpm`).
- The server README banner says "2.5.0" while `package.json` and `VERSION` say 3.0.0. Code is right, README is stale.
- The scaffold pins `typescript ^6.0.2`; npm `latest` is 7.0.2. We use 6.0.3 to match the Nest scaffold.

## Proof 2: two signers in one process. WORKED (dev mode)

Command: `pnpm proof:2`

- Two `createProvider` instances (two random signer keys, two fake containers) run in one Nest process on `/sites/site1/...` and `/sites/site2/...`. Each answer verifies against its own manifest signer.
- The response signature covers the container (digest `TAPI-1/resp/v2` includes `container`). Site1's signature, tried under site2's container, does not recover to site2's signer.
- `createProvider` throws `BAD_KEY` when the key does not derive `manifest.signer`.
- Limit: in dev mode the container/signer link is not checked against any delegation, so this proves isolation of keys and paths, not that a signer is authorised for a container. That check needs a real delegation (proof 3 limits).
- Not tested: load, many sites, memory per provider. Each provider keeps its own in-memory rate-limit table and voucher store.

## Proof 3: hosted web2-adapter, TAP-13 answer for a site on chain 196. WORKED in dev mode

Command: `pnpm proof:3` (needs internet; takes 10 to 40 s)

What ran:
- `1.2.396.tape` resolved on chain 196 read-only: circuits `0x6329...f771`, container `0x97ab...c1e3`, holder `0x551f...A6AF`, opened and live.
- The adapter (`src/web2-adapter/adapter.mjs`) is copied unmodified from `examples/web2-adapter` at tag v3.0.0 with its MIT `LICENSE` and a `NOTICE.md`. Our wrapper `hostedMethods` runs it with `HOSTED_POLICY` and a DNS check that refuses private addresses.
- The answer for `fxRate` (frankfurter.dev, live) was signed with the container of the real X Layer site, and the SDK verified it.
- Hosted rules refused: `http://`, `localhost`, an IP address, a non-443 port.

What dev mode skips (read from SDK `index.js` and server `index.js`):
- The manifest is fetched from the given URL, not from the chain: no TAP-10 identity step, no site status, no `isCPU`/`accountOf` derivation, no registry or binding implementation pins, no manifest content signature.
- With `delegation: null` the SDK returns `{delegation:false, holder:null, dev:true}`: no holder is ever compared with anyone. Our signer is a random key and nothing links it to the holder of `1.2.396.tape`. "verified: true" therefore means only "the signature matches `manifest.signer`".
- If a delegation is present and no RPC is configured, the holder is taken from the delegation signature itself and not compared with the chain (`checked:false`).
- Plain `http://` endpoints are accepted, contribution is treated as 0, delegation floor is skipped.
- Server side: priced methods are allowed on a zero escrow, the escrow-token mismatch only warns.
- Not exercised: a real holder-signed delegation. Could not verify until we own a site (or you give a test holder key for a throwaway site).

RPC operators on X Layer (this machine, 11 Nov 2026):
- Only two independent operators exist (OKX, dRPC), as the SDK source states. Quorum 2 has no spare; the SDK prints that warning.
- `xlayerrpc.okx.com` timed out on connect from this machine on every try (3 of 3 probes, plus `curl`: connection timed out after 10 s; DNS resolves). It is the second OKX domain. `rpc.xlayer.tech` took 0.6 to 1.3 s per call, `xlayer.drpc.org` 0.17 to 0.25 s.
- Measured effect: one `siteStatus` read took 35 s with the SDK's default node list (traced with a wrapped `fetch`: 24 requests, 8 of them to the dead node, each waiting an 8 s timeout, in sequential rounds) and 5.7 s with `RPC_URLS_196=https://rpc.xlayer.tech,https://xlayer.drpc.org`.
- Bug found and fixed in our code: `chainReader` first ignored `RPC_URLS_196` because it did not pass `chainId` to `createTapeAPI`.
- No HTTP 429 was seen, but the call volume was small (tens of calls). Rate limits under load: could not verify.

Other observations:
- The adapter prices in `priceBEM` (BEM token, escrow on BNB Smart Chain). The SDK marks X Layer `payments: false` (`sdk/src/chains.js`: "payments (the escrow and BEM are on BNB Smart Chain only)"). Our USDT/x402 pricing is therefore outside the library; see questions.
- `examples/web2-adapter/index.mjs` calls `buildMethods` without `policy`, although its README says a platform running other people's configs should pass `HOSTED_POLICY`. We pass it.
- From reading the code (not tested): the private-address check resolves the host, then `fetch` resolves it again, so DNS rebinding between the two is possible. Needs a pinned-IP agent if we want to close it.
- The `HOSTED_POLICY` header allow-list includes `authorization`, `x-api-key`, `api-key`, `x-api-token`, `x-auth-token`. An API that wants another header name cannot be configured. Secrets can only be sent in headers: `${NAME}` is expanded in header values only, and the `query` map takes caller parameters. An outside API that wants its key in the URL is not supported by the adapter as shipped.

## Proof 7: CORS for the TapeKit gateway. WORKED at header level

Command: `pnpm proof:7`

Origin format (read from TapeKit, repo `TapeOutProtocol/TapeKit`, commit `37c617e`):
- `kernel/src/name.js` `formatHostLabel`: `<tokenId>-<area>-<processor>` on an L2, `<tokenId>-<processor>` on BNB. For `1.2.396.tape` the Origin is `https://1-2-396.tapekit.org`.
- There is a second origin per site, `https://1-2-396-open.tapekit.org`, for the server-side compatibility tier used by in-app browsers (`sw-gateway/serve.js` `OPEN_SUFFIX`, `sw-gateway/README.md`).
- Anyone can run another gateway on another domain (README: `https://4246-0.<your gateway>/`), and the desktop app and extension use `tape://`. The Origin for those: could not verify (not found in source).
- The page's CSP (`sw-gateway/serve.js` `SITE_CSP`) allows `connect-src 'self' blob: data: https: wss:`. So pages can call our server over https only; http is blocked. Off-chain calls are recorded on the gateway status page, so such sites lose the "100% on-chain" badge, as the PRD accepts.

Result:
- The library's CORS is fixed: `access-control-allow-origin: *`, methods `GET,POST,OPTIONS`, headers `content-type,accept` (server `index.js` line 697). Both gateway origins pass the preflight and the POST. Because the allowed origin is `*`, no per-site allow-list is possible or needed (and credentials are not used).
- Gap for payments: a retry carrying a payment header (the PRD calls it `PAYMENT-SIGNATURE`) is NOT allowed by that preflight, and no `access-control-expose-headers` is sent, so a page cannot read a `PAYMENT-REQUIRED` response header. Our payments layer must answer preflights itself and add the expose and allow headers. The exact header names depend on proof 4 and 5.
- Not tested: a real browser on `tapekit.org` calling our server (needs our server on a public https URL).

## Proof 8: publish-manifest transaction, simulated. WORKED; real publish could not verify

Command: `pnpm proof:8`

- `api.tx.publishManifest({ container, manifest })` returns one `putFile(container, ".well-known/tapeapi.json", "application/json", sha256, data)` call to the SiteRegistry `0xd6EF...ADB6` (a 684-byte manifest fits one transaction; the contract limit is 24,000 bytes per chunk, then `appendChunk`).
- Read-only `eth_call` with `from` = the current holder `0x551f...A6AF` succeeded on both operators (`0x`, no revert). `eth_estimateGas`: 447,088 gas on both. Gas price: about 0.02 gwei (20,000,001 wei on OKX, 21,000,000 on dRPC), so about 0.0000089 OKB. Gas was measured for one manifest size only; larger manifests cost more.
- Control: `eth_call` from a random address reverts ("3 execution reverted"). The node returns no reason text, so I cannot confirm the revert is the `onlyEditor` check specifically; the SDK comment and TapeKit SPEC B.5 say it is.
- Preconditions (SPEC B.5, SDK `abi.js`, on-chain reads): the sender must be the circuit holder or an operator set with `setOperator(container, operator, ttl)`; the container must be an opened TapeOut container (this one is: `opened`, `isLive`); the key is `.well-known/tapeapi.json`; at most 64 KiB (TAPI-20), 24,000 bytes per transaction. This site has no manifest file yet (`fileInfo` is empty).
- The manifest in the simulation used a placeholder delegation signed by a throwaway key (not the holder). The contract does not read the content, so the simulation is valid for gas and permissions only.
- `validateManifest` accepted a non-dev manifest with a zero escrow and only free methods. Whether it accepts paid methods without a BNB escrow: not tested.

## Blocker for proofs 4 (settlement), 5, 6 and the final check

Environment variables: all six names in `.env` are present and non-empty (checked without printing values). New name needed: `PAY_TO_ADDRESS` (receiver address, not a key) is NOT in `.env`.

This machine's default DNS server (`10.255.255.3`, the local network) answers `0.0.0.0` / `::` for `web3.okx.com`, `www.okx.com`, `okx.com` and `xlayertestrpc.okx.com`. `1.1.1.1` and `8.8.8.8` answer real Cloudflare addresses. There is no hosts-file entry. Evidence: `nslookup` and `curl: (6) Could not resolve host`. The OKX facilitator (every verify and settle call), the OKX docs page, and the testnet RPC are all on those names, so no real payment can be made from here. The docs page `service-seller-sdk` therefore could not be read (4 attempts: `ECONNRESET` twice, then `ENOTFOUND`; the Chrome extension was not connected). I did not change DNS or route around it: that is a network decision for you.

Everything below the blocker was therefore taken from installed package source and READMEs (`node_modules/@okxweb3/*`, versions: x402-express 0.1.1, x402-core 0.1.0, x402-evm 0.2.1, x402-fetch 0.1.0), not from the docs page.

## Proof 4: OKX seller kit and a per-site receiver. HALF WORKED

Command: `pnpm proof:4` (offline, stub facilitator, no OKX contact)

From source (types in `x402HTTPResourceServer-*.d.mts`, `PaymentOption`):
- `payTo: string | DynamicPayTo` where `DynamicPayTo = (context: HTTPRequestContext) => string | Promise<string>` and the context has `path`, `method`, `adapter` (headers, query, body), `paymentHeader`, `routePattern`. The README only shows a fixed string; the types allow a function. `price` can also be a function.
- Route keys accept `:param`, `[param]` and `*` (regex built in `chunk-NYKB44OI.mjs`).

What I ran (stub facilitator that only answers "supported kinds"): route `POST /sites/:site/tapeapi/v1/paid` at `$0.001` on `eip155:1952` with a `payTo` function that picks the receiver from the site in the path. Result: site1 and site2 each got a 402 whose `PAYMENT-REQUIRED` carried their own receiver; amount `1000` (6 decimals), asset `0x9e29...fb0c`. An unknown site makes the function throw and the request fails closed (HTTP 500 today; should become a clean 404 in the product).

Could not verify: that the OKX facilitator accepts a verify/settle with a `payTo` that differs between calls, and that funds land at that address. That needs a real payment (blocked).

Differences between README and code:
- `express` README: `new OKXFacilitatorClient()` with no arguments. The constructor needs `{ apiKey, secretKey, passphrase }` (`OKXConfig`) and reads no environment variables.
- `x402-core` README says the default `baseUrl` is `https://www.okx.com`; the code uses `https://web3.okx.com` (`chunk-O3IYMTNT.mjs`; the default facilitator path also `https://web3.okx.com/facilitator` in `chunk-NYKB44OI.mjs`). Observed: the failed start tried `web3.okx.com`.
- The testnet default asset in `x402-evm` source is `USD₮0` at `0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c`, 6 decimals, EIP-3009 (gasless for the payer). Please confirm your funded "test USDT" is this token; I could not read balances (testnet RPC also blocked).
- Headers are `PAYMENT-SIGNATURE`, `PAYMENT-REQUIRED`, `PAYMENT-RESPONSE` (core README), matching the PRD. The paywall HTML for browsers appears when the request has `Accept: text/html` and a `Mozilla` user agent; our browser page uses fetch with JSON so it gets the JSON 402.
- Settlement modes: `OKXConfig.syncSettle` (wait for on-chain confirmation) and a response `status` of `pending | success | timeout` (source types). Behaviour not observed.

## Proof 5: pay the route. BUILT, NOT RUN

Script (private key signer, `@okxweb3/x402-fetch`): `pnpm proof:5 -- async` or `pnpm proof:5 -- sync` (needs `PAY_TO_ADDRESS` in `.env` and OKX reachable). It also prints the payment response, mined block and time (proof 6) and checks the signed answer (final check).
Browser page: `pnpm proof:5:serve`, then open `http://127.0.0.1:8787/pay/pay.html` (steps in the chat reply). Plain HTML plus a bundled script, generic EIP-1193 wallet (`window.ethereum`), no specific wallet. Wallet tested: none. Do not mark it worked until you report back.
Browser bundle note: `@okxweb3/x402-fetch` imports the server-side OKX client, which imports Node's `crypto`. The bundle aliases `crypto` to an empty stub (`proofs/browser/no-crypto.ts`); the buyer path never calls it. The bundle is about 960 KB.
The browser also needs to reach the testnet RPC if the wallet does not know chain 1952 yet (the page asks the wallet to add it using viem's `https://xlayertestrpc.okx.com`). If your browser uses the same DNS, adding the chain may fail too.

## Proof 6: OKX fees and settlement time. COULD NOT VERIFY

No payment has been made, so no fee or timing was observed. Not documented anywhere I could read. `pnpm proof:5` records, per run: time to the HTTP response, the transaction hash, the block it was mined in and how long after the request that took, and the payer and receiver token balance change (a difference from the price would show a fee).

## Questions for you

1. Paid methods and the manifest. The library prices methods in `priceBEM` against a BEM escrow that exists only on BNB (`payments:false` for chain 196). How should a USDT/x402-priced route appear in the manifest and to the SDK buyer on X Layer? I need your decision before the final check.
2. `xlayerrpc.okx.com` is unreachable from this machine. Is that your network? With only two operators and no spare, should we plan for a third paid node (own RPC) before launch? Your server on the Oracle VM may see different results; I can run the same probes there.
3. Renewal. `setOperator(container, operator, ttl)` would let our server publish the manifest for an owner (limited time) instead of the owner sending a transaction each renewal. Do you want me to look into that for the PRD, or keep the owner-signs-every-time design?
4. To test the real delegation path (proof 3 and 8 limits) I need a site we control on chain 196 or a testnet equivalent. Is there a TapeOut testnet site, or do you want to mint one later?
5. Dates: confirmed as target 5 Dec, official deadline 7 Dec 23:59 UTC. Your PRD file still shows "Submission deadline: 5 Dec"; I did not edit it.
6. DNS block: how do you want to unblock `*.okx.com`? Options: you switch this machine's DNS to a public resolver or use a VPN (your decision, I will not change system settings); run proofs 4 to 6 on the Oracle VM (needs the repo and `.env` copied there); or I add an app-level resolver for OKX hosts only inside our scripts (works around your network's filter, so only with your say-so).
7. Add `PAY_TO_ADDRESS` to `.env`: a second testnet address (not the payer) to receive the payment.
8. Your browser wallet: the message said `<write your wallet here>` (unfilled). Which wallet do you use? The page works with any wallet that injects `window.ethereum`.
9. Confirm the funded token is `USD₮0` `0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c` on testnet 1952.

## Live OKX testnet run (11 Nov 2026, eip155:1952, price $0.001 = 1000 units of USD₮0)

Commands: `PAY_TO_ADDRESS=<address> pnpm proof:5 -- async` and `... -- sync`. The receiver was the burn address `0x...dEaD` passed inline (not stored); the payer is the testnet key from `.env`. OKX was reachable from the developer's machine for this run (`web3.okx.com` and the testnet RPC answered HTTP 200; the earlier timeouts and DNS block are described above, cause not established by us).

| | async (default) | sync (`syncSettle: true`) |
|---|---|---|
| HTTP status of the paid call | 200 | 200 |
| Time to the paid response | 857 ms | 1746 ms |
| `PAYMENT-RESPONSE` status | `pending`, `success: true` | `success`, `success: true` |
| Mined (block, time after request start) | 45978935, 1212 ms | 45978990, 2104 ms |
| Gas used by the settlement tx | 81,311 | 81,311 |
| Payer balance change | -1000 | -1000 |
| Receiver balance change | +1000 | +1000 |

Findings:
- Fees: the receiver got the full 1000 units. No deduction from the transferred amount was observed on either payment. Whether OKX bills sellers separately, or charges on mainnet or at other volumes: could not verify (not documented in anything we could read).
- Gas: the settlement transaction was not sent by the payer; see "Follow-ups" for the sender address, hashes and the payer's OKB balance.
- Async mode returns `pending` before the transaction is mined (here the response came about 350 ms before the block); a seller trusts the facilitator in that window. Sync mode waits for chain confirmation and costs about 0.9 s more in this sample. Response fields also include a `paymentId`.
- The payer's balance read inside the script came back unchanged on the first (async) run and showed -1000 on a re-read a few seconds later: reading right after settlement can lag. The sync run showed -1000 immediately. A real implementation should not rely on an immediate balance read.
- One sample per mode, one network location, testnet only. Mainnet fees and speed: not measured.
- Final check: the paid call returned a TAP-13 signed answer that verified on the buyer side against the site signer. That signer is a dev-mode signer (proof 3 limits apply).
- Browser wallet: see "Follow-ups" section 3.

## Follow-ups (12 Nov 2026, live X Layer testnet, real OKX facilitator)

Command for 1 and 2: `pnpm proof:9`. It uses `syncSettle: true`, two sites (`alpha`, `beta`) and two fresh receiver addresses whose keys were discarded (testnet funds sent there are not recoverable, 0.001 each).

### 1. Two receivers, two sites: WORKED
- The `payTo` function returned `0xAf73a2aa40A96A220Dd7c3DE079567B5F38A79b6` for `alpha` and `0xF373F90902d3377faDf477Cfed48ea365434e6D5` for `beta`. Each unpaid call's 402 asked for that site's own address.
- Chain reads (token `USD₮0` balanceOf, polled until stable): alpha 0 -> 1000, beta 0 -> 1000; the payer went down by exactly 2000 (9,998,000 -> 9,996,000). Each address received exactly its own payment, and neither received the other's.
- Settlement transactions: alpha `0x93614bd67ffa674ff3460a47f71ce3215554d6fff82864a2549a0c2046455ec9` (block 45979735), beta `0xbd6d72575a2c2d1994742f070d43815f0c55e2dac3670a0e65ebd99787e9ac3e` (block 45979737). Both status success, both responses `success` in sync mode.
- Sample: one payment per site.

### 2. Who paid the gas: NOT THE PAYER
| Settlement tx | Block | Sent by (`from`) | To | Gas used | Fee |
|---|---|---|---|---|---|
| `0x58fd862f...badb40a` (earlier, async) | 45978935 | `0x40817a0d9043732d48823c05ab2ffb643ef8d90a` | token `0x9e29...fb0c` | 81,311 | 3,455,717,581,311 wei |
| `0x7855c640...a8519f8e` (earlier, sync) | 45978990 | same | same | 81,311 | 3,455,717,581,311 wei |
| `0x93614bd6...46455ec9` (alpha) | 45979735 | same | same | 98,595 | 4,190,287,598,595 wei |
| `0xbd6d7257...e9ac3e` (beta) | 45979737 | same | same | 98,627 | 4,191,647,598,627 wei |

- All four transactions were sent by one address, `0x40817a0d...d90a`, which is neither the payer nor a receiver. The transaction goes straight to the token contract (`transferWithAuthorization`), so that sender is the party that submitted the buyer's signed authorization. I did not verify that this address belongs to OKX; it is presumably the facilitator's relayer.
- The payer's OKB balance did not change: 0.2 OKB (200000000000000000 wei) at the block before and the block of each earlier settlement, and 0.2 OKB before and after the two new payments (change 0 wei). The payer paid only the token amount. Fee per payment is about 0.0000035 to 0.0000042 OKB, paid by the sender.
- The new payments used more gas (about 98.6k vs 81.3k). The earlier receiver already held a balance and these receivers held none. That fits an extra storage write for a first-time balance, but I did not verify the cause.

### 2c. Brand-new wallet with zero OKB pays: WORKED
Command: `pnpm proof:10` (key in the git-ignored `.fresh-wallet.json`, generated by us; funded by the user with 0.01 test USD₮0 and nothing else).
- Wallet `0xA4b80b5094a715A4f52c5740283055D0D4d80B13`: before: 10,000 token units, 0 OKB. After a real OKX sync-settled payment of 1000 units (HTTP 200, status `success`): 9,000 token units, 0 OKB.
- Transaction `0xe51a2f8f6398e18ef1dd68f6f44625e285f7f10335e866262dbbe4ec3d238672`, block 45982599, status success, 98,591 gas, sent by the same relayer `0x40817a0d...d90a`, not by the payer.
- So a visitor with only the token and no OKB can pay. One run, testnet, sync mode.

### 3. Browser payment page: WORKED (one run, reported by the user)
Files: `proofs/browser/dist/pay.html`, `proofs/browser/pay.ts` (bundled to `pay.js`). Before the user's run the server was checked without a browser: `pay.html` and `pay.js` (963 KB) served with HTTP 200, unpaid paid-route call returned 402.

User's result (screenshot of the page log, 12 Nov 2026): the first "Connect wallet" click showed `Connect failed: User rejected the request.` (the user dismissed or rejected that wallet prompt); the second click connected on chain 1952; "Pay and call" returned `HTTP 200`, a `PAYMENT-RESPONSE` with `success: true`, `status: pending` (the serve script uses the default async settle mode), and a signed answer body.

Verified from chain reads by us (not from the screenshot): the transaction `0x249fa8d618648ed2578b1703842d789e3fcd5ea431d64e49a6183dc8b518d0cc` (hash assembled from a line-wrapped screenshot, and it exists, so the reading is right) is in block 45981075, status success, 98,607 gas, sent by the same relayer address `0x40817a0d...d90a` as before. Its token log is a Transfer of 1000 units from the paying account `0x3D16...8266` to the receiver set as `PAY_TO_ADDRESS`, whose balance is exactly 1000. The payer's OKB stayed at 0.2 OKB (no gas paid by the wallet).

Caveats:
- The paying account is the same account as the `TESTNET_PRIVATE_KEY` in `.env` (addresses match), so the wallet had that testnet account, not an independent one. The wallet name, version and browser were not reported (step 8 of the steps), so which wallet was tested is unknown. One wallet.
- Second run (12 Nov, user screenshot, said to use a new account): HTTP 200, `success: true`, `status: pending`, transaction `0x8140637fe586704c312c81440d2f2f6bc314807fd0219292009875d21f8bc225` (hash assembled from a wrapped line), block 45982086, status success, 81,515 gas, same relayer. The chain shows the payer was again `0x3D16...8266`, the `.env` key account, so the page connected to the same account and a new account was NOT tested (a wallet usually keeps the account it first granted to a site; switch account and reconnect the site to test another). Same receiver as the first browser run. This counts as a repeat of the first run (two runs, same account).
- "HTTP 200 after 4515 ms" includes the time the user took to approve in the wallet; it is not a latency measurement.
- The page prints the viem version line as part of an error message (`Version: viem@2.57.17`). Cosmetic.
- The page shows the signed answer but does not verify its TAP-13 signature in the browser (the demo signer is an ephemeral dev key). Browser-side verification belongs to the helper file, not to this proof.

Steps given to the user:
1. In `.env` add `PAY_TO_ADDRESS=0x...` (an address, not a key; different from the paying wallet).
2. In a terminal in the project: `pnpm proof:5:serve`. Wait for the line "Open in the browser that has your wallet", and leave it running.
3. Open `http://127.0.0.1:8787/pay/pay.html` in the browser that has the wallet extension.
4. The wallet account you will use needs at least 0.001 test USD₮0 (1000 units) at `0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c` on X Layer testnet. It needs no OKB: the payer pays no gas (follow-up 2).
5. Click "1. Connect wallet" and approve. The page asks the wallet to switch to or add chain 1952 (OKB, RPC `https://xlayertestrpc.okx.com`). Expected log: `Connected 0x... on chain 1952`.
6. Click "2. Pay and call". The wallet should ask for a typed-data signature (a TransferWithAuthorization for 1000 units), not a transaction. Approve.
7. Expected log: `HTTP 200`, a `PAYMENT-RESPONSE` with `success: true`, and a body containing a signed answer.
8. Report the full log box, the wallet name and version, the browser, and any error or popup text.
9. Stop the server with Ctrl+C.

## Workaround run with a LOCAL MOCK facilitator (not OKX)

OKX is not reachable from the developer's location. The user reports `web3.okx.com` only loads with a VPN and believes OKX does not support the user's region (not verified by us; we could not read OKX's terms). We do not route around the restriction. To exercise the rest of the pipeline, `proofs/fixtures/mock-facilitator.ts` stands in for the facilitator: `verify` really checks the EIP-3009 signature (domain from the requirements, signer, recipient, amount); `settle` moves nothing and returns a fake hash.

Command: `pnpm proof:5 -- mock`. Result (11 Nov 2026): the paid route answers 402; `@okxweb3/x402-fetch` with the testnet key signs and retries; HTTP 200 in 66 ms; the TAP-13 signed answer verifies on the buyer side against the site signer. This passes for OUR pipeline (402 build, per-site receiver, buyer signing, signed answer). It says nothing about OKX: fees, settlement time, whether OKX accepts the per-site receiver, and wallet behaviour are still unverified.

Bug found: the x402-fetch README passes a viem wallet client to `toClientEvmSigner`; that fails (`Address "undefined" is invalid`) because a wallet client has no top-level `address`. The source type `ClientEvmSigner` is `{ address, signTypedData }`; `src/payments/buyer-fetch.ts` builds that explicitly.

Reproduced independently by the user on their own machine (same result, HTTP 200 in 210 ms).

Browser page with the mock: `pnpm proof:5:serve -- mock`. Not run in a browser yet. The wallet must already know chain 1952 (adding it needs `xlayertestrpc.okx.com`, which is blocked without a VPN), because wallets check the signing domain chain against the active chain.

