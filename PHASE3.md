# Phase 3: owner dashboard and demo site

Status: built, not committed. PRD v0.5 is the source of truth (not edited in this phase: the decisions below are for you to approve into a v0.6).

Tests: backend 242 (17 files), dashboard 154 (12 files), demo site 38 (2 files). The dashboard production build and its smoke test pass. Not run: a real browser (the Chrome extension was not connected), a real OKX payment, a real NASA or AI call, a real wallet.

## Two placeholders in your message were still empty
- **Domains** (dashboard and API): both were `[FILL IN]`. I did not guess. Everything that depends on them is an environment value: `CORS_ORIGINS` (API), `AUTH_DOMAIN` and `PUBLIC_BASE_URL` (API), `NEXT_PUBLIC_API_URL` (dashboard). `AUTH_DOMAIN` must equal the dashboard host, because the wallet shows it in the sign-in message. Local defaults work today (`localhost`, port 3001 and 3000). I need the real names before deployment.
- **API key**: `[FILL IN]` was left, so I treated it as "none yet". The AI route is tested with a fake outside service only. Section "AI provider" lists what a key will let us confirm.

## What was built

| Part | Where | Tests |
|---|---|---|
| Log cap for refused payments (Phase 2 follow-up), committed as `87242ba` | `src/calls/calls.service.ts` | 1 new, suite 169 at that point |
| Locked route settings | `src/worker/locked-settings.ts`, route schema, route validation, manifest builder | 19 |
| CORS for `/api` (`CORS_ORIGINS`) | `src/shared/api-cors.ts`, `config`, `bootstrap` | 4 |
| Secret rename | `secrets.service.ts`, controller | 2 |
| Call log filter by route, and a summary | `logs.controller.ts` | 3 |
| Manifest on-chain status | `chain.service.ts`, `manifest.service.ts` | 4 |
| Helper: `proof` in every result and `verify()` | `helper/tapehermes.js` | 1 (21 helper tests) |
| Dashboard | `dashboard/` | 154, plus 8 contract tests and a smoke script |
| Demo site and local runner | `public-site/`, `proofs/lib/demo-server.ts`, `proofs/12-demo-dev.ts` | 17 + 36 |

## Locked route settings (half a day limit: it fit cleanly)
A route may now carry two optional members, handled in our own layer before the adapter runs. The adapter file is unmodified.
- `locked: { <param>: <value> }`: fixed by the owner and always sent. A caller who sends that parameter is refused with a signed 400 `BAD_REQUEST`, before any outside call. In a paid route the visitor is not charged and the used-payment record is released (same path as any failed call). Values may be text, numbers, true/false, or nested JSON in a body.
- `limits: { <param>: { maxLength } }`: a caller value for that parameter must be text of at most that length. **This is an addition you did not ask for by name**: you wanted "only a short visitor input allowed", and the adapter has no length limit, so the AI route needs it.
- Save-time checks in plain words (`LOCKED_SETTING_INVALID`): the locked value must actually be used by the route (query, body or path), must be plain text or number when it goes into the address, cannot also be a default or a limit, and `${SECRET}` is refused inside it (secrets stay header-only).
- The manifest does not advertise locked parameters, and never contains a locked value.
- Tests (`test/locked-settings.spec.ts`): a locked value is always sent (body, query, path, nested JSON); an override of any locked name, including falsy values, is refused with zero outside calls; `__proto__` tricks do not get past it; unlocked parameters and unlocked defaults still work; the text limit is enforced before the call; and through the whole pipeline a paid override is refused, nothing is settled, and the log shows no paid row.

## Backend additions the dashboard needed (all approved)
- `CORS_ORIGINS`: exact origins only (no `*`, no paths), https unless localhost outside production. Other origins get no CORS headers at all. No cookies are used. Checked at startup.
- `PATCH /api/sites/:site/secrets/:name {name}`: re-encrypts under the new name (the ciphertext is bound to the name) and rewrites `${OLD}` to `${NEW}` in route headers, in one transaction. The value is never returned.
- `GET .../logs?route=` and `GET .../logs/summary?days=`: counts per route and result, paid calls and paid dollars.
- `GET .../manifest/status`: reads the file hash stored at `/.well-known/tapeapi.json` on chain (SiteRegistry `fileInfo`, shape checked live: `[size, contentType, sha256, updatedAt, chunkCount]`) and answers `not-ready`, `not-published`, `current` or `out-of-date`.

## Dashboard (`dashboard/`, Next.js 16.4.6, React 19.3.1, wagmi 3.7.11, Tailwind 4, shadcn)
Direction "Tape": dark first, one signal green, monospace headings, no outside fonts. A light theme exists in the same tokens.

**Pages**: sign in; my sites (list, add); site tabs: overview (status, holder, payout, delegation), secrets, routes (list, create, edit), delegation, manifest, call log; guided setup.
**Your conventions, enforced by `tests/conventions.test.ts`** so a slip fails the build: no em dashes anywhere; no hex colors; color values only in `app/tokens.css` (oklch); no color inline styles and no outside script or stylesheet URLs; every component in `ui`, `atoms`, `molecules` or `sections` and nothing else; atoms import no molecules or sections, molecules import no sections. Primitives in `components/ui` are CLI-generated and untouched.
**Sign-in**: injected wallets only (EIP-6963 and `window.ethereum`), no WalletConnect. The bearer token lives in `sessionStorage` with a 401 sign-out. Storage failures are handled.
**Strict CSP** (`proxy.ts`, `lib/csp.ts`): scripts only from this origin with a per-request nonce, no `unsafe-inline`, no `unsafe-eval` in production, `connect-src` is the page and the API only, no frames, no embedding. Style attributes are allowed (the component library sets some).
**Every on-chain step is explained before the wallet opens** (`WalletStepNotice`: what happens, cost, what it cannot do): sign-in, switch to X Layer, sign the delegation, publish. A test checks the notice comes before the button in the page.
**Delegation**: choose 1 to 366 days (quick choices 7, 30, 90, 366), the holder wallet must be the connected one (a wrong wallet is named and blocked), sign, save, renew with the same screen, warnings at 7 days and when expired.
**Secrets**: add, replace, rename, delete (with a confirm). The value is typed into a password box, sent once, and cleared. There is no way to view it. A test checks it never appears on the page.
**Routes**: a form of settings only (address, method, query, body, headers with `${SECRET}`, defaults, locked settings, limits, answer fields, price, rate limit, on/off). Simple mistakes are caught in plain words before sending. Server refusals (the hosted rules, secrets, locked settings) are translated into plain words by `copy/errors.ts` with the raw text kept inside a "Details" fold. 14 adapter refusal patterns are mapped, and 7 real refusals are checked against the live backend.
**Manifest**: preview, state badge and a sentence for each state, reasons it cannot be published in words, and publish through the owner's wallet using the unsigned transactions from the API (wallet switched to X Layer, each transaction confirmed, state re-checked). "Out of date" is red and says why.
**Call log**: summary (calls, paid calls, dollars earned) and rows; filters for period and route. No visitor data exists to show.
**Guided path**: eight steps (sign in, add site, switch on, secret, route, delegation, publish, live). It follows the real state of the site, so it advances by itself, and the optional secret step can be skipped.

**Contract test** (`test/dashboard-contract.spec.ts`, in the backend suite): the dashboard's own API client, zod schemas, error mapping and wallet converters run against the real backend. It signs in, registers, saves a secret, creates a locked AI-style route, **signs the delegation with a real wallet signature built from the dashboard's converted typed data and the backend accepts it**, reads the publish transactions, walks `not-published` to `current` to `out-of-date`, and checks the plain words for 7 real refusals.

**A defect found by the smoke script and fixed**: the production build served `/` as a static page, so Next could not put the CSP nonce on any script. With `strict-dynamic` a browser blocks every script without it, so the dashboard would have been blank in a real browser. The root layout now renders on demand, and `pnpm smoke` (`dashboard/scripts/smoke.mjs`) fails the build if any script lacks the nonce, if a script comes from another origin, or if `unsafe-inline` returns.

## Public site (`public-site/`)
Static files: `index.html`, `styles.css`, `app.js`, `main.js`, `checks.js`, and `tapehermes.min.js` (the helper, 51,034 bytes, copied by `pnpm site:build`). About 70 KB in all; at about 200 gas per byte that is roughly 14 million gas to publish, a small fraction of one OKB at today's gas price. `routes.json` and the tests are not part of the site.

**What a visitor sees**: a free route (NASA asteroid lookup), a paid route (USDA FoodData Central food lookup, $0.002 from the manifest, page size locked to 1, search text limited to 60 characters). The AI route `ask` is built but **off**: it is created disabled and the page shows its section only if the manifest lists it; it turns on only when `DEMO_ENABLE_AI` is set, and under every answer the list of checks the browser made: where the manifest came from and the gateway tier, the holder delegation, holder on chain, the answer signature, price against manifest, payment transaction. A button changes one character of the answer and runs the check again, which fails. A second button calls NASA directly without a key and shows its `403 API_KEY_MISSING` (NASA allows browser reads of that answer). The page says in plain words that sites using TapeHermes make outside calls, so they do not carry the "100% on-chain" badge.
**Safe by construction**: every answer is placed on the page as text, never as HTML (a test feeds markup and checks it stays text); `?dev=` is honoured only when the page is served from this computer, so a link cannot point the real site at someone else's manifest; the page never pays more than $0.05.

### TapeKit rules that apply (sources: TapeKit README handbook sections 2 to 8, `sw-gateway/serve.js`, `kernel/src/path.js`)
Enforced by tests in `test/public-site.spec.ts` unless marked "doc":
1. Plain static folder, `index.html` at the root, no server code.
2. Relative paths only (`./x.js`), never an absolute address to our own files.
3. No outside reference in HTML or CSS: `src`, `href`, `action`, `poster`, `srcset`, `url()`, `@import`, meta refresh. Fonts, icons and scripts are self-hosted (system fonts here).
4. Scripts only from the chain: the site CSP is `script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:`. The page loads one module script, no inline script, no `eval`.
5. ASCII, NFC file names; no `.` or `..` segments (`.well-known/` is allowed: `normalizePath` rejects only those two).
6. Each file needs its real content type or the browser will not run it (HTML, CSS, JavaScript); the local server and the publish plan use the same table.
7. Limits: 24,000 bytes per chunk, 8.4 MB per file (doc). All files here are below 200 KB each.
8. Outside requests (our API) are allowed by the gateway and recorded on its status page (gateway 0.3.0 code; the handbook text still says blocked). `connect-src` allows `https:`. **They cost the site the "100% on-chain" badge**, stated on the page.
9. No hard-coded origin: the page uses relative paths and reads its manifest from `/.well-known/tapeapi.json` on its own origin (doc).
10. The wallet extension may be used by a site (`window.ethereum`) (doc).
11. Name activation: `monthlyFee()` reads 0 on X Layer today, so the on-chain name needs no payment now; the container opening fee is the 0.08 OKB found in Phase 2 research.

### Run it locally against the Phase 2 backend
```
pnpm services:up && pnpm db:migrate        # Postgres and Redis, as in PHASE1.md
pnpm demo:dev                               # MOCK: fake outside services, mock payments, no keys, no money
pnpm demo:dev -- live                       # LIVE: DEMO_NASA_API_KEY, DEMO_USDA_API_KEY, OKX_* in .env, X Layer TESTNET (AI route only with DEMO_ENABLE_AI + DEMO_OPENAI_API_KEY)
```
It prints one address to open. The backend, the routes from `routes.json` (through the same save-time rules as the dashboard) and the static site all run on this computer; the only stub is who holds the site (no chain site exists yet). In mock mode a real wallet signs the payment but nothing settles. Your wallet needs the X Layer testnet (chain 1952) added in both modes.

Dashboard: `pnpm --dir dashboard dev` (port 3001, API at `NEXT_PUBLIC_API_URL`, default `http://127.0.0.1:3000`), and run the backend with `CORS_ORIGINS=http://localhost:3001`. Production check: `pnpm --dir dashboard smoke`.

## The demo API: what the adapter supports, and the choice
**Adapter request shapes** (read from the code, unchanged since the plan): any method; https 443 only; static prefix then `{param}` path segments; query only as `name: param`; body only for non-GET, always JSON, from `{jsonKey: param}` or `"*"` (nested values allowed); headers from config only, from this list: accept, accept-language, authorization, x-api-key, api-key, x-api-token, x-auth-token, with `${SECRET}` inside any value; JSON answers only, 256 KiB cap, no redirects, 8 s default timeout (up to 15 s here); `pick` by dotted path including array positions. Callers could override any default: that is what locked settings now fix.

**Free route: NASA NeoWs** (verified live with the public demo key, read only): `X-Api-Key` header accepted; without a key `403 API_KEY_MISSING`; one asteroid answer is 121 KB (half the cap, so the asteroid number is limited to 10 characters and the route should use a well-known asteroid); NASA guidance: factual use needs no permission and NASA should be credited (the page should add the credit line before launch); APOD avoided because its images can be copyrighted. 1,000 requests per hour per key (api.data.gov manual).

**Paid route now: USDA FoodData Central** (CC0 data, `X-Api-Key` header accepted, 1,000 requests per hour per IP, verified live). `pageSize` is locked to 1 and the search text to 60 characters. **The AI route is kept but disabled** until you provide a key and confirm the terms; the notes below are why OpenAI was proposed. **AI route (disabled): OpenAI, Responses API.** Checked against the official `openai/openai-openapi` spec (version 2.3.0):
- Shape fits: `POST https://api.openai.com/v1/responses`; auth is HTTP bearer, so `Authorization: Bearer ${KEY}` is an allowed header; top-level keys `model`, `input` (text), `instructions` (text), `max_output_tokens` (integer, **minimum 16**) and `store` (boolean) are exactly what the body map takes; the answer is JSON and tiny.
- The text is at `output[n].content[m].text`. `output_text` is an SDK-only convenience, not in the raw answer, and the spec itself warns that the order of `output` depends on the model. So the pick path `output.0.content.0.text` only holds if the first item is the message. We lock a non-reasoning model (`gpt-4.1-nano` is in the spec's model list) and `store: false` (the default keeps responses at least 30 days).
- Terms: read from OpenAI's own **Services Agreement, ONLINE v.010126** (`cdn.openai.com/osa/openai-services-agreement.pdf`). Section 2.2 grants the right to integrate the API into Customer Applications and make them available to End Users. Section 3.1: the customer "may not resell or lease access to its Account or any End User Account". Section 3.3: no key selling, no circumventing usage limits, no using output to train competing models. My reading: a fixed-purpose feature (locked model, instructions and cap, 200 characters in, one sentence out) is a Customer Application, not resold access. That is a reading, not legal advice. Section 3.2 makes the owner responsible for what End Users do through the application, and the OpenAI usage policies (not readable from here, the page blocked automated reads) also apply. Please read both before a paid launch.
- **Not verified, needs your key:** the real response time (the route allows 12 s; a short answer should be far below that, but I have not measured it), that the first output item is the message for the chosen model, the price per call against $0.01, and that `store: false` is accepted on your account.
- Alternatives checked and rejected: Anthropic's API needs an `anthropic-version` header that is not on the allowed list; most chat APIs put the question inside a nested messages list, which the body map cannot build; Tavily's terms restrict reselling the Service. USDA FoodData Central (CC0 data, `X-Api-Key` accepted, 1,000 requests per hour) is a verified, free backup for the paid route if the AI route is not wanted. GoldRush (X Layer wallet balances, `Authorization: Bearer` per its docs) is the most relevant to our chain, but its terms could not be read here.

## Limits and honest gaps
- **No real browser run.** The Chrome extension was not connected. What did run: jsdom tests of the real components and the real page, a production build served and fetched over HTTP, and the contract test with real signatures. Hydration, the real wallet popups, layout and the look are not yet seen by a human or a browser tool.
- **No real payment, NASA call or AI call** in this phase (no keys, and payments were out of scope). Mock mode proves our code paths only.
- The dashboard's publish step sends transactions through the wallet, which no test can complete without a chain; it is covered up to the conversion of the transactions and by the contract test that checks their targets.
- Guided path actions link to the real pages rather than repeating them inline.
- Dashboard text is English only. There is no dark/light switch yet (dark is fixed; the light tokens exist).
- `public-site/tapehermes.min.js` is a committed copy of the helper build; a test fails if it drifts.

## Open questions
1. The two domains (dashboard, API) and the API key you hold (or "none yet").
2. Approve the locked-settings model into the PRD (v0.6), including the extra `limits.maxLength`?
3. AI provider: decided for now, USDA is the paid route and the AI route stays off. Turning it on needs your key and your read of the OpenAI terms.
4. The visitor input of the AI route can say anything (200 characters). Do you want a short refusal list or moderation, given section 3.2 makes us responsible for End Users?
5. Credit line for NASA data on the demo page: wording?
6. A real browser pass: connect the Chrome extension, or run `pnpm demo:dev` and the dashboard yourself and tell me what you see.
7. A dark/light switch for the dashboard, or dark only?
8. Commit: done locally in four commits (not pushed). Real-world checks are in `VERIFY.md`.
