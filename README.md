# Marino Barbero — The Barber Shop (website)

Bilingual (EL primary, EN) marketing site for a men's barbershop in Kato Paphos.
Zero-dependency Node static generator → deploys to Netlify. Dark charcoal + gold,
serif headings (Georgia), system sans body. No web fonts.

## Build & preview
```bash
node build.js        # renders dist/
npm run serve        # build + local server on :4120
```
Preview config: `.claude/launch.json` (name `marino-barbero`, serves `dist/`).

## Structure
- `content/content.js` — single source of truth (business facts + EL/EN copy). **Edit here.**
- `build.js` — generator: pages, `HairSalon`+`LocalBusiness` JSON-LD, sitemap, robots, `_headers`, favicon.
- `src/css/styles.css`, `src/js/main.js` — styles + motion (GSAP hero/parallax, reveals, marquee, cursor).
- `src/img/` — real photos (`interior-bg.jpg` hero, `interior.jpg`, `haircut-fade.jpg`).
- `dist/` — build output; `/` = EL, `/en/` = EN.

## Before launch — swap these placeholders (all in `content/content.js`)
1. `freshaUrl` — real Fresha public booking URL (wired to all 5 "Book" CTAs + schema ReserveAction).
2. `domain` — currently the Netlify subdomain; set to the real domain once bought, then rebuild (updates canonical/hreflang/sitemap/schema).
3. `googleProfile` — exact Google Business Profile / Maps share link (currently a Maps search query).
4. `geo` — refine lat/lng with the exact pin from Google Business Profile.
5. Confirm service durations / combo prices (flagged in BUSINESS-BRIEF.md).

## Netlify
`netlify.toml`: build `node build.js`, publish `dist`, Node 20. Point Netlify at this
folder; the subdomain works immediately, custom domain added later in Netlify DNS.

## Add Russian later
Add a `ru` block to `L` in `content/content.js` and `"ru"` to `SITE.langs` — the
generator, hreflang, sitemap and `/ru/` folder follow automatically.
