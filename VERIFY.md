# VERIFY: real-world checks still outstanding

Everything below has passed only in tests, mock mode, or server-side fetches. Nothing here has been run by a human in a browser, with a real wallet, a real key, or real money. Work through the checks in order; each one says what to run, what you should see, and what to send back. Send back screenshots or pasted text, **never a key, a private key, a token, or a `.env` file**.

Status words: **READY** (can be run now), **NEEDS** (needs something first, named), **BLOCKED** (cannot be run until something is built).

## 0. Setup (once)

| Item | Detail |
|---|---|
| Node and pnpm | Node 22.12 or newer, `pnpm install` at the repo root (installs dashboard and public-site too). |
| Postgres 17 and Redis 8 | `pnpm services:up`. The Postgres image pull failed on the build machine (Docker Hub), so this may fail for you too. If it does, send the error. Any Postgres 17 and Redis on the ports in `.env` also work. |
| Database | `pnpm db:migrate` (uses `DATABASE_URL`), and `TEST_DATABASE_URL` pointing at the test database. |
| `.env` | Names are listed at the end of this file. Never paste values into chat. |
| Network | OKX endpoints must be reachable from your machine (some regions need a VPN). Check 4 shows this clearly. |

Send back for 0: the output of `pnpm services:up` and `pnpm db:migrate` if either fails, otherwise just "setup ok".

## 1. Whole test suite on your machine (READY)

1. `pnpm test` (expect 17 files, 242 tests passed)
2. `pnpm --dir dashboard test` (expect 12 files, 154 passed; the em-dash rule can fail on `dashboard/AGENTS.md`, a file `next dev` writes, see check 9) and `pnpm --dir dashboard exec tsc --noEmit` (no output)
3. `pnpm --dir public-site test` (expect 2 files, 38 passed)
4. `pnpm --dir dashboard smoke` (builds the dashboard, serves it, checks the strict CSP nonce; expect it to end with a pass line)

Send back: any failing test name and its message, or "all green".

## 2. Dashboard in a real browser, local backend (READY, needs a wallet extension)

This is the first time a human will see the dashboard.

1. Terminal A, backend: set in `.env` `AUTH_DOMAIN=localhost:3001`, `CORS_ORIGINS=http://localhost:3001`, `PUBLIC_BASE_URL=http://127.0.0.1:3000`, `UNSAFE_DEV_SKIP_DELEGATION=1` (dev only, this is what lets a local run skip chain 196). Then `pnpm start`.
2. Terminal B: `pnpm --dir dashboard dev` and open `http://localhost:3001`.
3. Open the browser console (F12) before you start.

What you should see:
- The page loads in the dark "Tape" look with the green signal color, no red errors in the console, and no "Refused to execute inline script" CSP message.
- Without a wallet extension installed, the connect button explains that no wallet was found (no crash).
- Layout: resize the window to phone width; nothing overflows sideways.

Send back: a screenshot of the first page, and any console errors (text).

## 3. Wallet sign-in (NEEDS: wallet extension such as MetaMask or OKX Wallet)

1. On the dashboard, click Connect and choose your wallet. Approve the connection.
2. The dashboard asks you to sign a message (sign-in). Read it: it must name `localhost:3001`, "Chain ID: 196", and a nonce. Sign it.
3. Reload the page. You should still be signed in (the session lives in the tab's session storage). Open a second tab: you should be signed out there (expected).
4. Click sign out. You should be signed out and the token gone.

What you should see: the signed-in view shows your wallet address shortened, no error banner. If the wallet is on another chain the dashboard may ask to switch to X Layer (196); approve it.

Send back: screenshot of the signed-in view, the exact text of the message you were asked to sign (it has no secret in it), and any error text shown.

## 4. OKX testnet payment through the helper (NEEDS: OKX keys, testnet funds, OKX reachable)

Uses X Layer testnet (chain 1952). Mainnet is never touched.

1. `.env` needs the `OKX_*` values, `PAY_TO_ADDRESS`, `TEST_DATABASE_URL`, `RPC_URLS_1952`, and either a `.fresh-wallet.json` (from `pnpm proof:10`) or `TESTNET_PRIVATE_KEY` for a testnet buyer wallet holding testnet USDT0 and a little OKB for gas.
2. Dry run first: `pnpm phase2:testnet -- mock` (no network). It should finish with all checks passing.
3. Real run: `pnpm phase2:testnet`.

What you should see (the script prints each step as pass or fail):
- first call answers 402, the helper signs, the retry returns a signed answer with a settlement transaction hash;
- the settlement transaction exists on the X Layer testnet explorer, with a Transfer of the price to `PAY_TO_ADDRESS`;
- the "broken" route (upstream 404) is verified but **not** settled;
- replaying the first payment header does **not** settle a second time;
- the call log shows paid rows with the price and transaction.

Send back: the whole script output (it prints no secrets), plus the settlement transaction hash it prints. If OKX is unreachable or answers an error, send the printed error text.

## 5. Real NASA and USDA calls with your keys (NEEDS: DEMO_NASA_API_KEY, DEMO_USDA_API_KEY)

Free routes first, no payment involved.

1. Put `DEMO_NASA_API_KEY` and `DEMO_USDA_API_KEY` in `.env` (get them from api.nasa.gov and fdc.nal.usda.gov; I do not create accounts for you).
2. `pnpm demo:dev -- live` (also needs the `OKX_*` values for the paid route; for this check you may leave them out and only try the free route).
3. It prints a page URL (`http://127.0.0.1:3200/?dev=...`). Open it in the wallet browser.
4. Free route: enter asteroid `3542519` and submit.
5. Paid route "Look up a food": connect the wallet, enter `cheddar cheese`, submit, approve the signature in the wallet. (Needs testnet USDT0 in the wallet, see check 4.)

What you should see:
- asteroid: name `(2010 PK9)`, hazardous yes/no, a size in metres, a first approach date; checks list below it is all Pass;
- food: one description, a data type, maybe a brand, and a "matches in the database" count; payment row shows Pass and a transaction hash;
- "Change one character" button: the signature check turns to Fail;
- "Ask the service directly" button: the page reports a 403 (NASA without a key), which is the expected result.

Send back: screenshot of each answer with the checks list, the console log, and the call log: `curl -H "authorization: Bearer <token>"` is not needed, just open the dashboard Logs page for the demo site and screenshot it. Also say how long each call took (rough seconds).

Note: the mock demo (`pnpm demo:dev` without `-- live`) needs no keys or money and shows the same page, useful to check the look first.

## 6. The disabled AI route (READY to check "off", NEEDS: OpenAI key and your decision on terms for "on")

The AI route `ask` is built but **off**. It stays off until you set `DEMO_ENABLE_AI` and provide `DEMO_OPENAI_API_KEY`, and only after you have read OpenAI's Services Agreement (sections 2 and 3) and usage policies.

1. Check "off": in the check 5 page, there is no AI section, and the dashboard routes list shows no `ask` route enabled. Calling `ask` fails.
2. Only when you have decided to turn it on: add `DEMO_ENABLE_AI=1` and `DEMO_OPENAI_API_KEY`, restart `pnpm demo:dev -- live`, reload. An "Ask a short question" section should appear with its price, and a question of at most 200 characters returns one short sentence.

Send back: for "off", "no AI section visible". For "on" (later): the answer, its time in seconds, and the OpenAI usage cost shown in your OpenAI dashboard for that call (this tells us whether $0.01 covers it).

## 7. Own site on chain 196: delegation and manifest publish (NEEDS: a real TapeOut site you hold, OKB for gas, public HTTPS API address)

This is the first real run of the product's trust chain. It spends real OKB on X Layer mainnet (about 450,000 gas for the manifest, roughly a fraction of a cent at the current gas price; the delegation itself is a signature, not a transaction).

Prerequisites:
- The site name in `XLAYER_SITE` (format `1.2.396.tape`) is one **you** hold in the wallet you will connect.
- The backend must be reachable on a public **https** address (a hosted server or a tunnel). Set `PUBLIC_BASE_URL=https://...` and `AUTH_DOMAIN` to that dashboard host, and **remove** `UNSAFE_DEV_SKIP_DELEGATION`. Set `CORS_ORIGINS` to the dashboard origin. `RPC_URLS_196` must list working X Layer RPC endpoints.
- Dashboard: set `NEXT_PUBLIC_API_URL` to the public API address, then `pnpm --dir dashboard build` and `pnpm --dir dashboard start` (or run `dev` locally with the API address changed).

Steps:
1. Sign in with the holder wallet (check 3).
1b. A site that was just created reads "Not switched on". On the site page, press **Switch on my site** and confirm in the wallet. It costs the network fee only while the chain price is 0. The card should turn to "Switched on" with an end date (press Check again if the node is a few seconds behind). Publishing before this is refused with "Your site is not switched on yet".
2. Register the site (name from `XLAYER_SITE`). The backend reads the holder from chain 196; if you are not the holder it refuses.
3. Add one route (a free one is enough, for example `asteroid` from `public-site/routes.json`) and its secret.
4. Follow the guided path to **delegate**: sign the delegation (a typed-data signature in the wallet, valid 30 days). Check the typed data shown names the TapeAPI domain and your site.
5. **Publish the manifest**: the dashboard sends one transaction to the SiteRegistry contract. Approve it in the wallet.
6. After it confirms, the manifest status in the dashboard should change from "not published" to "published" and "delegation valid".

What you should see:
- the holder check passes with your wallet;
- the transaction on the X Layer explorer, to `0xd6EFb7adCc9c83dC4924Ad56f6a8E4e969b9ADB6` (the SiteRegistry) from your wallet, status success;
- `GET <your API>/sites/<site>/.well-known/tapeapi.json` answers with JSON whose `signer` is the delegated signer and whose `endpoints.live` is your public address.

Send back: screenshots of the steps (especially the wallet prompts), the transaction hash, the manifest JSON (public data, safe to paste), and the manifest status text from the dashboard. If any step errors, the exact error text.

## 8. The helper reads the manifest from the site's own origin, through the gateway (BLOCKED for the demo site, see below)

What this proves: on a real TapeOut site, `createHermes()` with no options fetches `/.well-known/tapeapi.json` from the same origin through the TapeKit gateway, finds the delegation, checks the holder on chain, and verifies a signed answer.

**Blocked:** publishing the site's own files (`public-site/*`) to chain 196 is **not built**. Only the manifest publish transaction exists. The SDK has no generic site-file publisher, and the HashPort console for X Layer is unverified. So I cannot give you an exact publish command for the demo files, and I will not guess.

Two ways to unblock, your choice:
- (a) You publish the public-site files (list: `index.html`, `playground.html`, `styles.css`, `playground.css`, `app.js`, `main.js`, `checks.js`, `trace.js`, `locale.js`, `tapehermes.min.js`) with whatever TapeKit or HashPort tool you normally use for your site, after `pnpm site:build`. Tell me which tool and I will check the file rules against it.
- (b) I build a file publisher in a later phase.

Once the files are on your site (check 7 already done for the same site), open the site's gateway address in the browser and check:
- the page loads and shows the free and paid sections (no `?dev=` anywhere in the address);
- the "Manifest source" line under an answer says `site-origin` and shows a gateway tier (`client`, or `server` for the `-open` address);
- the checks list shows the delegation and holder rows as Pass, not "development";
- the browser network tab shows `/.well-known/tapeapi.json` loaded from the site's own address (not from the API address) and the response header `x-tape-sha256`.

Expected side effect: because the page calls outside services, the gateway records outside requests and the site does not carry the "100% on-chain" badge. The page says so in plain words.

Send back: screenshot of the page and checks list, the network panel entry for the manifest (headers), and the "Manifest source" line.

## 9. Things I could not test and you may notice

- Real wallet popups for typed-data signing in `eth_signTypedData_v4` across wallets (each wallet formats it differently). Tell me which wallet you used.
- `dashboard/AGENTS.md` is written by `next dev` and contains an em dash, so the dashboard rule "no em dashes" fails while that file exists. Delete it before running the dashboard tests, or tell me to exclude it.
- Hydration, layout and the look on a real device.
- Real gas price and fee on X Layer at the time you publish (values were read on chain earlier: deploy fee 1e7 wei, protocol fee 1e6 wei, gas about 0.02 gwei).
- OKX facilitator behaviour under real outages (the 503 path is tested with a mock only).

---

## `.env` names to add or check (names only, no values here)

Backend, always:
`DATABASE_URL`, `TEST_DATABASE_URL`, `REDIS_URL`, `REDIS_PREFIX`, `VAULT_MASTER_KEY`, `RATE_LIMIT_SALT`, `AUTH_DOMAIN`, `PUBLIC_BASE_URL`, `CORS_ORIGINS`, `PORT`, `RPC_URLS_196`, `RPC_URLS_1952`, `X402_NETWORK`.

For the payment checks (4, 5 paid route, 7 with payments):
`OKX_API_KEY`, `OKX_SECRET_KEY`, `OKX_PASSPHRASE`, `PAY_TO_ADDRESS`, `TESTNET_PRIVATE_KEY` (or a `.fresh-wallet.json`, which stays out of git).

For the real outside calls (5, 6):
`DEMO_NASA_API_KEY`, `DEMO_USDA_API_KEY`, and only if you decide to turn the AI route on: `DEMO_OPENAI_API_KEY`, `DEMO_ENABLE_AI`.

For the real chain site (7, 8):
`XLAYER_SITE`; remove `UNSAFE_DEV_SKIP_DELEGATION` (it is for local dev only).

Dashboard (`dashboard/.env.local`, not the root `.env`):
`NEXT_PUBLIC_API_URL`.

Local dashboard run (check 2 and 3) uses `AUTH_DOMAIN=localhost:3001` and `CORS_ORIGINS=http://localhost:3001`.
