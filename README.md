# Marino Barbero — The Barber Shop (website)

Bilingual (EN primary, EL) marketing site for a men's barbershop in Kato Paphos.
Zero-dependency Node static generator → deploys to Netlify. Dark charcoal + gold,
one self-hosted display face (Playfair Display, Latin subset), system sans body.

Design direction: **"Hexagon light"** — the resolved Claude Design mockups
(`Marino Barbero UI Mockups`, directions 1c / 1d / 2a / 2b), against the brief in
`../REDESIGN-PROMPT.md`.

## Build & preview
```bash
node build.js        # renders dist/
npm run serve        # build + local server on :4120
```
Preview config: `.claude/launch.json` (name `marino-barbero`, serves `dist/`).

## Structure
- `content/content.js` — single source of truth (business facts + EN/EL copy). **Edit here.**
- `build.js` — generator: pages, `HairSalon`+`LocalBusiness` JSON-LD, sitemap, robots,
  `llms.txt`, `_headers` (CSP), favicon, and the content-hashing of every asset.
- `src/css/styles.css` — the whole design. Mobile first; the desktop layout starts at 60em.
- `src/js/main.js` — service picker, sticky bar, booking sheet, consent, conversion events.
  No libraries, and nothing here decides whether content is visible.
- `src/fonts/` — the Playfair Display woff2 subsets (31.4 KB for both).
- `src/img/` — real photos (`interior.webp` hero, `interior-bg.webp`, `haircut-fade.webp`)
  and the six product cut-outs.
- `dist/` — build output; `/` = EN, `/el/` = EL.

## Language layout
English is the root and Greek lives at `/el/`, flipped in August 2026 because the
demand is: 1820 of 1852 Search Console impressions and 92 of 106 GA4 sessions were
English. `netlify.toml` 301s the old `/en/*` URLs onto the new root. The old Greek
URLs (`/` and `/privacy/`) are now the English pages and cannot be redirected —
Google finds `/el/` through hreflang and the sitemap. See `SITE.langs`.

Greek is not a lesser build: same components, same schema. The one difference is
display type — Playfair Display has no Greek coverage, so `/el/` falls through to
Georgia with matched metrics.

## Things that are deliberate, not oversights
- **No GSAP, no CDN script.** The motion layer is CSS: reveals use
  `animation-timeline: view()` behind `@supports`, with fully-visible static content
  as the fallback. Nothing is hidden waiting for JavaScript.
- **Service rows ship as `<a>` into the Fresha menu.** `main.js` swaps each one for a
  real `<button aria-pressed>` on init, so the page is bookable with JS off.
- **`?service=…` on the hand-off.** Fresha ignores query keys it does not know, so
  today it carries the choice into GA4 (`book_click`), not into Fresha's menu.
- **The Work section renders one cell per `GALLERY` entry.** The before/after fade
  pairs, the barber portrait, the detail crops and the two video loops from §9 of the
  brief have not been shot. Nothing is faked to fill the grid; a slot appears when a
  file does. Video support is wired (poster-first, in-view only, never on save-data)
  and `media-src 'self'` is added to the CSP the moment a `GALLERY` entry has one.
- **No looping attention animations, no scarcity patterns.** The old `fabPulse` and
  the scroll cue are gone and are not coming back.

## Still open (see BUSINESS-BRIEF.md §10)
1. What Bio Wax №1–№4 actually differ in — the copy claims colour only until confirmed.
2. `geo` — the exact lat/lng pin from Google Business Profile.
3. The shot list above.
4. Unverified claims kept off the page on purpose: street parking, walking distance
   from the harbour, "last cut starts 30 minutes before close", and any description of
   the fade's finishing technique.

## Netlify
`netlify.toml`: build `node build.js`, publish `dist`, Node 20. Read the comment block
in that file before adding a redirect — one particular rule shape took the site down
with `ERR_TOO_MANY_REDIRECTS`.

## Add Russian later
Add a `ru` block to `L` in `content/content.js` and `"ru"` to `SITE.langs` — the
generator, hreflang, sitemap and `/ru/` folder follow automatically.
