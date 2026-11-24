# Public site: design brief

The public site has a landing page in `index.html` and a standalone API playground in `playground.html`. Both share `styles.css`. Playground-specific styles live in `playground.css`, and its activity timeline is rendered by `trace.js`. The `design/` and `tests/` folders and `routes.json` are never published.

The site is stored on the X Layer chain as plain files at `26.2.2.tape`. Every file costs a wallet approval to upload, and every byte costs gas. That is why the rules below are strict.

## Decisions already made

- The landing page explains TapeHermes and links to the playground in a new tab.
- The playground provides wallet controls, an action picker, a chronological activity panel, and response verification. It uses the site's published manifest to discover actions and prices.
- Keep the mint accent, light and dark themes, system fonts, and shared pill buttons.

## The contract between the page and the code

The playground code (`app.js` and `trace.js`) finds these elements by id. Keep every one, exactly once, with the same kind of element:

| id | what it is |
|---|---|
| `connect` | button: connect wallet (the code turns it into "Disconnect wallet" after connecting) |
| `switch-wallet` | button, keeps the `hidden` attribute (shown after connecting) |
| `theme-toggle` | button with one `<span>` inside (the code writes the sun or moon symbol into it) |
| `activity`, `run-status` | ordered list of observed steps and current run status |
| `wallet-status` | any element: shows the wallet result |
| `free-form` | `<form>` with one submit button inside |
| `asteroid-id` | `<input>` inside `free-form` |
| `free-out` | any element: shows the free answer |
| `paid-form` | `<form>` with one submit button inside |
| `food-input` | `<input maxlength="60">` inside `paid-form` |
| `food-count` | any element: shows "12 of 60" |
| `food-price` | any element: shows the price from the manifest |
| `paid-out` | any element: shows the paid answer |
| `ai-section` | container, must keep the `hidden` attribute (the code shows it only if the site offers that action) |
| `ai-form`, `ai-input`, `ai-count`, `ai-price`, `ai-out` | same pattern as the food action; `ai-input` is a `<textarea maxlength="200">` |
| `checks` | `<ul>`: the code fills it with `<li data-status="pass|warn|fail|info">` holding `.mark`, `.what`, `.why` |
| `proof` | `<details>`, keeps the `hidden` attribute (the code shows it after a call) |
| `proof-fields` | `<dl>`: the code fills it with `<dt>` and `<dd>` |
| `tamper` | button, starts `disabled` |
| `direct` | button, starts `disabled` |
| `side-out` | any element: shows the result of those two buttons |
| `source-line` | any element: shows where the manifest was read from |
| `badge-note` | the sentence "Sites that use TapeHermes make outside calls, so they do not carry the &ldquo;100% on-chain&rdquo; badge." must stay, word for word |

Classes the code creates, which the CSS must style: `.answer` (the answer box), `.bad` (an error text), `.muted` (grey text), `li[data-status]` with `.mark`, `.what`, `.why`.

Style the `[hidden]` attribute so hidden things really are hidden (`[hidden] { display: none }`).

## Hard rules (a test fails if one is broken)

- Only these files: `index.html` and `styles.css`. No images, fonts or extra files.
- `index.html` has exactly one script: `<script type="module" src="./main.js"></script>`. No other script, no inline script, no event attributes.
- Every `src` and `href` is either `./file` or `#anchor`. No `http` or `https` address anywhere in the HTML or CSS: no Google Fonts, no CDN, no remote images, no `@import`, no `url(http...)`. The dashboard address is written as plain text, not a link.
- No hex colors (`#fff` style). Use `oklch(...)`, `rgb(...)` or `hsl(...)`, as variables on `:root`.
- No long dash character (the em dash) anywhere. Use a comma, a colon or a full stop.
- No invisible or right-to-left characters.
- Each file under 24,000 bytes. Smaller is better.
- Pictures are only inline SVG written in the HTML, or CSS shapes and gradients. Keep them small.
- Plain, non-technical English. Say "action" and "key", not "route" and "secret".

## Prompt to paste into ChatGPT

Copy everything between the lines, then paste the current `index.html` and `styles.css` under it.

---

You are a senior product designer and front-end developer. Redesign the single-page public site of TapeHermes. Return two complete files, `index.html` and `styles.css`, and nothing else except a short list of what you changed.

WHAT TAPEHERMES IS
TapeHermes lets the owner of a TapeOut site (a website stored on the X Layer blockchain) add paid API actions without running a server. The owner saves an API key, picks an action, sets a price per call, and visitors pay in USDT on X Layer. The key never goes on the chain. Every answer is signed, and the page checks the signature in the browser. This page is the public face of TapeHermes and also a live demo: it has two real actions, one free (NASA asteroid lookup) and one paid at a fraction of a cent (US food database lookup).

WHO READS IT
Hackathon judges and first-time visitors, who give it under a minute, mostly on a laptop and sometimes on a phone. They should understand the product in 5 seconds and make a real paid call in 30.

THE PAGE
One page, these sections in this order, each with the anchor id shown: header with brand and links (#try, #how, #owners); hero (one clear sentence, two buttons to #try and #how, and the badge note); #how (three steps: Add your key, Set a price, Get paid per call); #try (the playground); #check (Check the answer yourself); #where (Where the key is); #owners (Make one for your own site); footer. Keep the copy plain and non-technical. You may improve the wording, but keep the meaning and the honesty: never claim the site is "100% on-chain".

LOOK
Dark, calm and trustworthy, like a finance tool built for developers. Near-black background, one bright green accent, generous spacing, rounded cards, pill-shaped primary buttons, a monospace feel for headings. System fonts only. Make the playground the visual center of the page, with clear states: ready, working, success, error, and the price shown before paying. Make it fully responsive from 320px wide, with good contrast, visible focus outlines, large tap targets, and `prefers-reduced-motion` respected.

THE CONTRACT WITH THE CODE (do not break it)
The JavaScript finds elements by id. Keep every one of these ids exactly once, on the same kind of element, and keep the same structure inside the forms:
connect (button); wallet-status; free-form (form with a submit button) containing asteroid-id (input); free-out; paid-form (form with a submit button) containing food-input (input, maxlength 60); food-count; food-price; paid-out; ai-section (container that must keep the hidden attribute) containing ai-form, ai-input (textarea, maxlength 200), ai-count, ai-price, ai-out; checks (an empty ul); proof (a details element that must keep the hidden attribute) containing proof-fields (a dl); tamper (button, starts disabled); direct (button, starts disabled); side-out; source-line; badge-note (keep the sentence "Sites that use TapeHermes make outside calls, so they do not carry the &ldquo;100% on-chain&rdquo; badge." word for word).
The script creates these, so style them: .answer (answer box), .bad (error text), .muted (grey text), and li[data-status="pass|warn|fail|info"] with children .mark, .what, .why inside the checks list. Add `[hidden] { display: none }`.

HARD RULES
- Output only index.html and styles.css. No other files, no images, no web fonts.
- index.html has exactly one script: `<script type="module" src="./main.js"></script>`. No other script, no inline script, no onclick attributes.
- Every src and href is `./something` or `#anchor`. No http or https address anywhere in the HTML or CSS (no CDN, no Google Fonts, no remote images, no @import, no url(http...)). Write the dashboard address `dashboard.tapehermes.xyz` as plain text, not a link.
- No hex colors. Use oklch(), rgb() or hsl(), defined as variables on :root.
- Do not use the long dash character (em dash) anywhere. Use commas, colons or full stops.
- No invisible characters or right-to-left characters.
- Each file under 24,000 bytes. Smaller is better, because every byte is stored on a blockchain.
- Pictures must be inline SVG in the HTML or pure CSS shapes and gradients, and small.
- Plain, non-technical English: say "action" and "key", not "route" and "secret".

Return the two files in two separate code blocks, then a short list of what you changed and anything you were unsure about.

---

## What happens next

1. Paste ChatGPT's two files back to the developer.
2. The tests check every rule above, and the page code is run against the new HTML.
3. The page is opened locally and checked at desktop and phone widths.
4. Then it is uploaded to chain, a few files at a time, each signed from the holder wallet.
