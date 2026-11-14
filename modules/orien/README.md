# Beyond Earth — Orbital Application Portal

The candidate-application site for *Beyond Earth Orbital Systems*, S.A. The first screen is the
**candidate portal**: a two-tab sign-in / create-account form that issues a manifest reference
when an application is accepted.

**Live:** https://beyond-earth-orbital-dbjwvm4l1g5.qoder.website

Built with React 19 + TypeScript + Vite 8 + Tailwind 4 on the Qoder Sites starter. The front end is
static; the ORION assistant is backed by one Qoder Sites edge Function.

## Run it

```sh
npm ci      # Node ^22.13.0 or >=24.0.0
npm run dev # http://127.0.0.1:5173
npm run build && npm run preview
```

The production bundle lands in `dist/` (≈2.9 MB, mostly photography).

## The candidate portal (primary surface)

`components/LoginPortal.tsx` owns the first viewport. It holds the session state, so the portal
opens in the right place for every visitor: a signed-in candidate lands straight on their receipt,
a first-time visitor lands on the sign-in form.

| Tab | Component | Behaviour |
| --- | --- | --- |
| SIGN IN | `components/SignInCard.tsx` | Email + passphrase **or** reference code, show/hide toggle, restore on a new device |
| CREATE ACCOUNT | `components/SignupCard.tsx` | Full application form: identity, contact, country, programme preference, health screening, passphrase, consent |

- Passphrase rules: 8+ characters, uppercase, lowercase, digit; bonus tier at 12+ with a symbol.
- Submit performs a short uplink delay, then issues a base-36 reference (`BE-XXXXXX`), a queue
  position and the assigned flight record.
- **Sign-in accepts either credential** — the passphrase you chose, or the `BE-XXXXXX` reference code
  printed on the confirmation screen and in the downloaded summary. Both are checked in the browser.
- **The receipt stays up.** Submitting an application replaces the form with the receipt; it no
  longer bounces back to an empty sign-in tab. The reference code is shown in full with a copy
  button, because it is the credential you need on another machine.
- **The session survives a reload.** The record lives in `localStorage` under
  `beyond-earth.application.v1` and the signed-in state under `beyond-earth.session.v1`, so a
  returning visitor is already signed in. `Sign out` clears the session flag but keeps the file on
  the device, and the sign-in form then shows what is stored there.
- **New device:** enter the application email plus the reference code and the file is rebuilt from
  the pair — the manifest entry is derived from the two — and flagged as restored on the receipt.
- `components/ApplicationReceipt.tsx` renders the accepted record: reference, queue position,
  flight, seat class, window, pad, deposit, duration, and the three next steps. It also emits an
  `.ics` launch-window invite and a `.txt` summary, both generated client-side.

Applications are stored device-locally. To collect them server-side, add a database table and point
the submit path at a Function — the portal UI does not change.

## ORION — the resident agent

`components/Orion.tsx` is a live conversational panel anchored at `#orion`.

### The body — an Enderman

ORION is not a generic chat orb. Its on-screen body is the **Minecraft Enderman voxel rig**,
ported from the SUNDAY v2 character build: obsidian skin, the tall three-block silhouette,
glowing purple horizontal slit eyes and forty drifting ender-portal particles.

| Path | Role |
| --- | --- |
| `components/EndermanAvatar.tsx` | The 3D rig, the inline message glyph, the SVG fallback and the character-profile readout |
| `public/vendor/three.min.js` | Vendored three.js r128 UMD build (MIT) — loaded at runtime, no bundler dependency |
| `public/characters/enderman.sunday` | The character profile the panel reads to label the body |

- The rig is built from the same proportions as the SUNDAY build: obsidian `MeshStandardMaterial`
  body, unlit purple eye slits, a purple rim light and a dim blue fill.
- The head tracks the pointer; the rig breathes, blinks every ~4.4 s and sways its arms while
  ORION speaks. Particle drift, rim intensity and the arm sway follow the agent mood
  (`idle` / `thinking` / `speaking` / `offline`).
- The rig pauses when scrolled out of view, and `prefers-reduced-motion` renders one static frame.
- If WebGL is unavailable the panel falls back to a flat SVG Enderman.
- The agent's voice matches the body: the live agent answers in the Enderman persona — quiet,
  plain sentences, no theatrics.

### Transport
- Transport: `fetch` + `ReadableStream` reading `text/event-stream` from
  `/functions/v1/app/api/chat/stream` (`lib/sse.mjs`, `lib/conversation-stream.mjs`). Native
  `EventSource` cannot send the `x-orion-principal` header, so `fetch` is used.
- The client reconnects automatically (400 ms after a clean close, 1500 ms after an error) and
  reports `offline` only after three consecutive failures.
- If the Function instance was restarted and the stored conversation id no longer exists, the
  client creates a new conversation instead of failing.
- A 4-second reconciliation poll reads the conversation while a turn is in flight, so a dropped
  stream still converges on the server's state.

The Function side:

| Path | Role |
| --- | --- |
| `functions/index.ts` | Edge entry point. Routes `/api/chat/*`, `/health`; all other paths 404 |
| `functions/chat/handler.mjs` | SSE handler. First frame `event: ready`, later `event: snapshot`; 10 s keepalive; closes on terminal state or after the stream lifetime |
| `functions/chat/live-service.mjs` | ORION service adapter — session/agent/environment/model provisioning, turn lifecycle, upstream frame mapping |
| `functions/chat/managed-transport.mjs` | QCA transport — prompt POST, history read, event stream |
| `functions/cloud-agents.mjs` | Qoder Cloud Agents REST client (`https://api.qoder.com/api/v1/cloud/*`) |
| `functions/sse.mjs` | SSE frame parser (split UTF-8, CR/LF boundaries, multiline data, comments) |

The agent is provisioned on first use: a model, an environment and an agent are looked up or
created under the `beyond-earth-orion-v1` scope, then a session is opened per conversation. The
platform secret `QODER_PAT` is read only inside the Function and never reaches the browser.

`GET /functions/v1/app/health` returns the service mode and persistence; `/functions/v1/app/api/chat/config`
returns `{ "mode": "live" }` when the live transport is in use.

Local Function development:

```sh
npx tsx dev/function-local.ts   # serves the real chat handler on 127.0.0.1:8000
```

## Palette

One accent, one base, and colours that mean something. The tokens live in `src/globals.css`.

| Role | Token | Value | Where it is allowed |
| --- | --- | --- | --- |
| Base | `--background` | `#05080f` | Page |
| Surface | `--card` / `.panel` | `#0a1018` | Cards, the portal shell |
| Brand | `--primary` | `#f0b64a` | Buttons, eyebrows, focus rings, the countdown chip, seat bars |
| Ink | `--foreground` / `--muted-foreground` | `#e9edf5` / `#8d9ab8` | Body and secondary copy |
| Hairline | `--hairline` | `#93a3c41f` | Every 1px rule, grid and corner mark |
| Status | `--go` / `--signal` / `--destructive` | `#3fd69b` / `#e8933f` / `#ff6b6e` | Seats, warnings, errors only |
| ORION | `--violet` | `#8b7cff` | The agent panel and the Enderman rig only |

Gold is the mission-patch accent: it reads as instrumentation, not as decoration, and it stays
legible over the night-side Earth photography. Violet is deliberately confined to ORION, so the
agent reads as a separate system rather than as another button on the page.

## Motion

`src/globals.css` holds the keyframes and the reduced-motion rules; `components/OrbitalScene.tsx`
draws the HUD planet, `components/CountUp.tsx` animates the program counters, and
`components/Reveal.tsx` fades sections in on scroll. `prefers-reduced-motion` disables the canvas
animation and the reveal transitions.

## Layout

| Path | What lives there |
| --- | --- |
| `index.html` | Title, description, Open Graph tags, favicon, Google Fonts |
| `src/App.tsx` | Page composition and skip link |
| `src/main.tsx` | React root |
| `src/globals.css` | Design tokens (deep-space palette), panel/field/button classes, keyframes |
| `components/Nav.tsx` | Top navigation and mobile drawer |
| `components/Hero.tsx` | Background photography, headline, countdown, program stats, CTAs, ticker |
| `components/LoginPortal.tsx` | Sign-in / create-account shell |
| `components/SignInCard.tsx` | Sign-in form |
| `components/SignupCard.tsx` | Application form and validation |
| `components/ApplicationReceipt.tsx` | Accepted application record, reference code + copy, ICS + summary export, sign-out |
| `components/Orion.tsx` | ORION conversation panel |
| `components/EndermanAvatar.tsx` | Enderman 3D rig, message glyph, SVG fallback, character readout |
| `components/OrbitalScene.tsx` | Animated HUD / planet scene |
| `components/Telemetry.tsx` | Flight-profile readouts |
| `components/Manifest.tsx` | Flight table with windows, seats, deposits, status |
| `components/Training.tsx` | Four-phase twelve-week syllabus |
| `components/Gallery.tsx` | NASA photo grid with original captions and credits |
| `components/Voices.tsx` | Returned-crew accounts |
| `components/Consent.tsx` | FAQ accordion + informed-consent panel |
| `components/Footer.tsx` | Contact, legal columns, imagery credits |
| `components/Starfield.tsx` | Canvas star field, honours `prefers-reduced-motion` |
| `components/CountUp.tsx`, `components/Reveal.tsx` | Animated counters and scroll reveal |
| `data/site.ts` | All content: manifest, telemetry, phases, voices, frames, FAQ, classes, regions |
| `lib/application.ts` | Field types, password rules, validation, reference-code generator |
| `lib/application-store.ts` | Local persistence for accepted applications, the signed-in session flag, and reference-code restore |
| `lib/sse.mjs`, `lib/conversation-stream.mjs` | Browser SSE reader helpers |
| `public/images/` | Photography served at `/images/*` |
| `public/vendor/three.min.js` | Vendored three.js r128 UMD build (MIT) used by the Enderman rig |
| `public/characters/enderman.sunday` | SUNDAY character profile for the Enderman body |
| `scripts/fetch-assets.mjs` | Re-downloads the NASA originals (see below) |

## Editing content

Everything visible is data-driven from `data/site.ts` — change the manifest, quotes, FAQ or imagery
captions there without touching components.

Launch windows are fixed ISO timestamps; `nextWindow()` picks the first one still in the future and
rolls forward annually once they all pass, so the countdown never goes negative.

## Imagery

All orbital and deep-space photography is genuine NASA material fetched from the public
`images-api.nasa.gov` search API and stored locally in `public/images/` — nothing is hotlinked, so the
site works offline and after deployment. Run `node scripts/fetch-assets.mjs` to re-download the
originals. Individual IDs, captions and licence notes are in `ASSET-CREDITS.md`.

The crew portraits are synthetic images generated for this project; they do not depict real people,
and the site says so in the returned-crews footnote. Real NASA astronaut portraits are deliberately
not used beside invented quotes.

## Disclaimer

`Beyond Earth` is a concept brand. Manifest dates, licence numbers, deposits and crew accounts are
illustrative, and the footer states that the site is not affiliated with any space agency. Swap in real
operational data before pointing a production domain at it.
