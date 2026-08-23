#!/usr/bin/env node
/* =========================================================================
   Marino Barbero — The Barber Shop · static site generator
   One template, rendered per language (EL root, /en/). Outputs to dist/.
   No dependencies; plain Node. Deploy dist/ to Netlify.
   ========================================================================= */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { SITE, HOURS, SERVICES, PRODUCTS, GALLERY, L } = require("./content/content.js");

const ROOT = __dirname;
const SRC = path.join(ROOT, "src");
const DIST = path.join(ROOT, "dist");

// Content-hashed asset paths (populated in build()). Because the filename changes
// whenever the file's bytes change, the immutable long cache in _headers is safe:
// an edit always produces a new URL, so browsers never serve a stale CSS/JS.
const ASSETS = { css: "/assets/css/styles.css", js: "/assets/js/main.js" };
const hash8 = (buf) => crypto.createHash("sha1").update(buf).digest("hex").slice(0, 8);

// Logical image name (e.g. "interior.jpg") -> content-hashed URL, populated in build().
// Images live under /assets/* with an immutable 1-year cache, so their bytes must be
// fingerprinted too: swapping a photo for a new one under the same source name yields a
// new URL, and visitors never get served a year-stale image from cache. img() resolves
// the name for templates; it falls back to the plain path if an image wasn't emitted.
const IMG = {};
const img = (name) => IMG[name] || `/assets/img/${name}`;

// Self-hosted display face. The two files are content-hashed like every other
// asset, which means the @font-face src in styles.css cannot be written by hand:
// the stylesheet ships a placeholder per file and build() substitutes the hashed
// URL before minifying and hashing the CSS itself. That keeps /assets/* on the
// immutable one-year cache without ever serving a stale pairing.
//
// Latin only, on purpose. Playfair Display has no Greek coverage, so /el/ falls
// through to Georgia (see the @font-face block in styles.css). Preloading is
// per-page and per-language for the same reason — see headHtml().
const FONTS = {
  __FONT_LATIN__: "playfair-display-latin.woff2",
  __FONT_ITALIC__: "playfair-display-italic-latin.woff2",
};
const FONT_URL = {};
const font = (file) => FONT_URL[file] || `/assets/fonts/${file}`;

// Whether any Work cell carries a video loop. Drives the one CSP directive that
// only exists when there is media to play, so the header stays minimal until the
// two loops in the shot list are actually shot.
const hasVideo = GALLERY.some((g) => g.video);

// CSP source hash for an inline <script> body (must match the bytes between the tags
// exactly). Used to keep script-src strict — no 'unsafe-inline' — while still allowing
// our own inline snippets (the js-class flag and, when enabled, the GA4 config).
const cspHash = (js) => `'sha256-${crypto.createHash("sha256").update(js, "utf8").digest("base64")}'`;

// Inline script bodies, defined once so the emitted <script> and the CSP hash always
// agree.
//
// The old `html.js` flag is gone: its only consumer was the reveal gate in
// styles.css, and the reveals are scroll-driven CSS now. Nothing on the page
// needs to know whether scripting is on, so the page ships one less inline
// script and one less CSP hash.
//
// GA4 + Google Ads bootstrap with Consent Mode v2. One line, no trailing newline, so its
// hash is stable. Consent DEFAULTS to denied (no cookies) before gtag runs — GDPR/ePrivacy
// for EU/Cyprus visitors; the banner (main.js) grants all four categories on accept, and a
// prior "granted" choice in localStorage is restored here before the first hit.
//
// The restored grant must list the same four categories main.js grants. Restoring only
// analytics would silently downgrade every returning visitor to ads-denied — the ad
// categories would come back denied on each new page load despite a stored "granted".
//
// gtag.js is loaded once from googletagmanager.com and serves both IDs, so the Ads config
// costs no extra request and no extra script-src origin.
const GRANT_ALL = `{ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted'}`;
const gaInline = (gaId, adsId) => `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});try{if(localStorage.getItem('mb-consent')==='granted')gtag('consent','update',${GRANT_ALL})}catch(e){}gtag('js',new Date());gtag('config','${gaId}');${adsId ? `gtag('config','${adsId}');` : ""}`;

/* ---------- helpers ---------- */
const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rmrf = (p) => fs.existsSync(p) && fs.rmSync(p, { recursive: true, force: true });
const mkdir = (p) => fs.mkdirSync(p, { recursive: true });
const write = (p, c) => { mkdir(path.dirname(p)); fs.writeFileSync(p, c); };
const copyDir = (from, to) => {
  mkdir(to);
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    e.isDirectory() ? copyDir(a, b) : fs.copyFileSync(a, b);
  }
};

const basePath = (lang) => (lang === SITE.langs[0] ? "/" : `/${lang}/`);
const pageUrl = (lang) => SITE.domain + basePath(lang);
// Secondary pages live under the language root: /privacy/ and /en/privacy/.
const subPath = (lang, slug) => `${basePath(lang)}${slug}/`;
const subUrl = (lang, slug) => SITE.domain + subPath(lang, slug);
// One date for the whole build: schema dateModified, the footer line and llms.txt all
// have to agree, and "when was this generated" is a property of the build, not of a page.
const BUILD_DATE = new Date().toISOString().slice(0, 10);
const hrefLangCode = (lang) => L[lang].htmlLang;

// Booking / contact links
// The street in the language of the page. The Greek page shows "Πάφιας Αφροδίτης 18Α",
// so the Greek schema has to say the same thing: an address in the markup that appears
// nowhere in the visible text is a NAP mismatch, and the entity checker reads it as one.
const street = (lang) => (lang === "el" ? SITE.streetEl : SITE.street);
const whatsappLink = (lang) => `${SITE.whatsapp}?text=${encodeURIComponent(SITE.whatsappMsg[lang] || SITE.whatsappMsg.en)}`;

/* ---------- on-brand SVG placeholder (dark charcoal + gold) ---------- */
function placeholder(label, w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(label)}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1a1712"/><stop offset="1" stop-color="#100f0d"/></linearGradient>
    <filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope="0.05"/></feComponentTransfer></filter>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <rect width="${w}" height="${h}" filter="url(#n)" opacity="0.6"/>
  <g fill="none" stroke="#c9a24b" stroke-width="1.4" opacity="0.5">
    <circle cx="${w * 0.5}" cy="${h * 0.46}" r="${Math.min(w, h) * 0.14}"/>
  </g>
  <text x="50%" y="90%" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="${Math.round(w * 0.03)}" fill="#c9a24b" opacity="0.85">${esc(label)}</text>
</svg>`;
}

/* ---------- structured data: HairSalon / LocalBusiness ---------- */
function jsonLd(lang) {
  const t = L[lang];
  const s = t.services;
  const data = {
    "@context": "https://schema.org",
    "@type": ["HairSalon", "LocalBusiness"],
    "@id": SITE.domain + "/#business",
    name: SITE.brandFull,
    alternateName: SITE.brand,
    url: pageUrl(lang),
    image: SITE.domain + img("og-cover.jpg"),
    description: t.meta.description,
    telephone: SITE.phone,
    priceRange: "€€",
    currenciesAccepted: "EUR",
    paymentAccepted: "Cash, Credit Card",
    address: {
      "@type": "PostalAddress",
      streetAddress: street(lang),
      addressLocality: SITE.city,
      postalCode: SITE.postal,
      addressRegion: SITE.region,
      addressCountry: SITE.country,
    },
    geo: { "@type": "GeoCoordinates", latitude: SITE.geo.lat, longitude: SITE.geo.lng },
    areaServed: { "@type": "City", name: SITE.city },
    hasMap: SITE.googleProfile,
    // Only profiles that exist: an empty slot in SITE stays out of the graph rather than
    // shipping a broken sameAs. Facebook / TikTok / Wikidata are still blank — filling any
    // of them is what moves GEO-006, and no code change is needed once they are.
    sameAs: [SITE.instagram, SITE.googleProfile, SITE.facebook, SITE.tiktok, SITE.wikidata].filter(Boolean),
    potentialAction: {
      "@type": "ReserveAction",
      target: { "@type": "EntryPoint", urlTemplate: SITE.freshaUrl, inLanguage: t.htmlLang, actionPlatform: ["http://schema.org/DesktopWebPlatform", "http://schema.org/MobileWebPlatform"] },
      result: { "@type": "Reservation", name: t.hero.book },
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: SITE.rating.value,
      reviewCount: SITE.rating.count,
      bestRating: "5",
      worstRating: "1",
    },
    openingHoursSpecification: HOURS.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: h.d.map((d) => ({ Mo: "Monday", Tu: "Tuesday", We: "Wednesday", Th: "Thursday", Fr: "Friday", Sa: "Saturday", Su: "Sunday" }[d])),
      opens: h.open,
      closes: h.close,
    })),
    makesOffer: SERVICES.map((sv) => ({
      "@type": "Offer",
      priceCurrency: "EUR",
      price: String(sv.price),
      itemOffered: { "@type": "Service", name: s.names[sv.key], serviceType: "Barber service" },
    })),
  };
  // Escape "<" so a content value can never break out of the <script> block
  // (e.g. a future "</script>" in copy). JSON.stringify alone doesn't escape it.
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

/* ---------- structured data: the retail shelf as an ItemList of Products ---------- */
// Emitted as a second ld+json block rather than folded into the business node: they are
// separate entities and Google reads multiple blocks fine.
//
// availability is InStoreOnly and the offer's seller/availableAtOrFrom both point at the
// business @id — that is the honest encoding of "we stock this, we don't ship it", and it
// keeps the markup consistent with a page that has no checkout.
//
// Products without a confirmed per-SKU price use AggregateOffer + lowPrice, which is the
// machine-readable equivalent of the visible "from €10". Using a flat Offer price here
// would publish a figure the page doesn't actually state.
function productsJsonLd(lang) {
  const t = L[lang].products;
  const data = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": pageUrl(lang) + "#products",
    name: t.heading,
    numberOfItems: PRODUCTS.length,
    itemListElement: PRODUCTS.map((p, i) => {
      const from = productIsFrom(p);
      const offer = {
        "@type": from ? "AggregateOffer" : "Offer",
        priceCurrency: "EUR",
        availability: "https://schema.org/InStoreOnly",
        seller: { "@id": SITE.domain + "/#business" },
        availableAtOrFrom: { "@id": SITE.domain + "/#business" },
        ...(from ? { lowPrice: String(productPrice(p)), offerCount: 1 } : { price: String(productPrice(p)) }),
        ...(productUrl(p) ? { url: productUrl(p) } : {}),
      };
      return {
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "Product",
          "@id": SITE.domain + "/#product-" + p.img,
          name: p.schemaName,
          brand: { "@type": "Brand", name: p.brand },
          category: t.types[p.key],
          description: t.desc[p.key],
          image: SITE.domain + img(`product-${p.img}-880.webp`),
          ...(p.size ? { size: p.size } : {}),
          offers: offer,
        },
      };
    }),
  };
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

/* ---------- structured data: the page itself, its dates and its trail ---------- */
// The business node says what the shop is; this says what the document is, which is where
// datePublished / dateModified belong (CN-038 reads the page for freshness signals and
// found none). BreadcrumbList rides along only where there is a real trail to describe:
// on a one-page site the home page has no parent, and a one-item breadcrumb is noise.
function webPageJsonLd(lang, page) {
  const t = L[lang];
  const url = page ? page.url : pageUrl(lang);
  const data = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: page ? page.title : t.meta.title,
    description: page ? page.description : t.meta.description,
    inLanguage: t.htmlLang,
    isPartOf: { "@type": "WebSite", "@id": `${SITE.domain}/#website`, url: `${SITE.domain}/`, name: SITE.brandFull, inLanguage: t.htmlLang },
    about: { "@id": `${SITE.domain}/#business` },
    datePublished: SITE.published,
    dateModified: BUILD_DATE,
  };
  if (page && page.crumb) data.breadcrumb = { "@id": `${page.url}#breadcrumb` };
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

// Emitted as its own node rather than nested in WebPage: both are valid, but a nested list
// is invisible to every tool that scans for a top-level BreadcrumbList, and the point of
// the markup is being found.
function breadcrumbJsonLd(lang, page) {
  const t = L[lang];
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "@id": `${page.url}#breadcrumb`,
    itemListElement: [
      { "@type": "ListItem", position: 1, name: t.breadcrumb.home, item: pageUrl(lang) },
      { "@type": "ListItem", position: 2, name: page.crumb, item: page.url },
    ],
  };
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

/* ---------- partials ---------- */

// The cheapest price on the menu, for the "from €18" pill above the fold and the
// booking sheet's resting state. Read from SERVICES so it cannot contradict the
// price list further down the page.
const priceFloor = Math.min(...SERVICES.map((s) => s.price));

// The language switch is a pair of real links inside a pill, not a toggle: "/" is
// English and "/el/" is Greek, both crawlable, both 56x40 inside a 48px row. The
// current language renders as a <span> — a link to the page you are already on is
// noise for a screen reader and a wasted tap target.
function langSwitchHtml(lang, hrefFor) {
  return SITE.langs
    .map((lg) =>
      lg === lang
        ? `<span class="active" aria-current="true" lang="${hrefLangCode(lg)}">${lg.toUpperCase()}</span>`
        : `<a href="${hrefFor(lg)}" hreflang="${hrefLangCode(lg)}" lang="${hrefLangCode(lg)}" aria-label="${esc(L[lg].label)}">${lg.toUpperCase()}</a>`
    )
    .join("");
}

// The hexagon of the interior lamps — the brand's visual signature, drawn with a
// clip-path over the metal gradient so it costs no request and no image bytes.
const hex = `<span class="hex" aria-hidden="true"></span>`;

function navHtml(lang) {
  const t = L[lang], b = basePath(lang);
  // No burger. The mobile artboard carries the wordmark and the language switch
  // and nothing else: a five-item overlay menu on a single-scroll page is a
  // control that exists to be closed. The anchors below appear from 960px, where
  // there is room for them on one line.
  const links = [
    ["#services", t.nav.services],
    ["#gallery", t.nav.gallery],
    ["#about", t.nav.about],
    ["#visit", t.nav.visit],
  ]
    .map(([href, label]) => `<a href="${href}">${esc(label)}</a>`)
    .join("");
  return `<header class="nav" aria-label="${esc(SITE.brand)}">
    <a class="nav__logo" href="${b}" aria-label="${esc(SITE.brandFull)}">${esc(SITE.brand)}</a>
    <div class="nav__right">
      <nav class="nav__links" aria-label="Primary">${links}</nav>
      <div class="lang" role="group" aria-label="Language">${langSwitchHtml(lang, basePath)}</div>
    </div>
  </header>`;
}

// Above the fold, the 15-second decision. A tourist standing on a street in Kato
// Paphos with a phone gets all five answers before any scroll: what (barber shop),
// where (Kato Paphos), proof (5.0 / 128), price (from €18) and action (Book).
//
// The photograph is full-bleed and gold-graded, the type sits in the dark half,
// and the rating is the most designed object on the page — it is the strongest
// asset the business owns and it used to be a line of text below the fold.
function heroHtml(lang) {
  const t = L[lang].hero, p = L[lang].proof;
  return `<section class="hero" id="top">
    <div class="hero__media">
      <!-- LCP element. Stays a static <img> with fetchpriority=high and a matching
           preload in <head>; no video is ever the LCP here. -->
      <img src="${img("interior.webp")}" alt="${esc(L[lang].meta.ogAlt)}" width="1600" height="906" fetchpriority="high" decoding="sync">
    </div>
    <span class="hero__pool" aria-hidden="true"></span>
    <span class="hero__scrim" aria-hidden="true"></span>
    ${navHtml(lang)}
    <div class="wrap hero__inner">
      <!-- The eyebrow carries the service category and the district, which the H1
           alone did not (KW-073). It reads as one sentence to a crawler and as a
           kicker above the headline to a visitor. -->
      <p class="eyebrow hero__eyebrow">${hex}${esc(t.eyebrow)}</p>
      <h1 class="hero__title">${esc(t.titleLead)} <em class="metal">${esc(t.titleAccent)}</em></h1>
      <p class="hero__sub">${esc(t.subtitle)}</p>
      <div class="hero__proof">
        <span class="hero__score metal num">${esc(p.rating)}</span>
        <span class="hero__rate">
          <span class="hero__stars" aria-hidden="true">★★★★★</span>
          <span class="hero__reviews">${esc(p.count)}</span>
        </span>
        <span class="pill hero__pill num">${esc(t.pill)}</span>
        <span class="pill hero__pill--wide num">${esc(t.pillWide)}</span>
      </div>
      <div class="hero__actions">
        <button type="button" class="btn" data-sheet-open>${esc(t.book)} <span class="arr" aria-hidden="true">→</span></button>
        <a href="${whatsappLink(lang)}" class="btn btn--ghost" target="_blank" rel="noopener">${esc(t.whatsapp)}</a>
      </div>
    </div>
  </section>`;
}

// Fade is the hero of the Google Ads campaign and had no matching region on the
// page: the tightest ad-to-page message-match win available, and one of the three
// Quality Score inputs. Everything stated here is confirmed by the Fresha menu.
//
// The before/after pair the design calls for does not exist yet, so this renders
// the one photograph on hand rather than an empty slot captioned "to be shot".
function fadeHtml(lang) {
  const t = L[lang].fade;
  const body = esc(t.body).replace("{svc}", `<span class="fade__svc">${esc(L[lang].services.names.fade)}</span>`);
  const specs = t.specs
    .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd class="num">${esc(v)}</dd></div>`)
    .join("");
  return `<section class="fade" id="fade">
    <div class="wrap fade__grid">
      <div>
        <p class="eyebrow reveal num">${esc(t.label)}</p>
        <h2 class="reveal">${esc(t.headingLead)} <em>${esc(t.headingAccent)}</em></h2>
        <p class="fade__body">${body}</p>
        <dl class="fade__specs">${specs}</dl>
      </div>
      <figure class="fade__media img-reveal">
        <img src="${img("haircut-fade.webp")}" alt="${esc(t.caption)}" width="1080" height="1920" loading="lazy" decoding="async">
        <figcaption class="fade__cap">${esc(t.caption)}</figcaption>
      </figure>
    </div>
  </section>`;
}

// Visible trail for the secondary pages. Mirrors the BreadcrumbList exactly — markup that
// claims a trail the page does not show is the kind of thing Google drops the rich result for.
function crumbsHtml(lang, current) {
  const t = L[lang];
  // The class says "breadcrumbs" in English on purpose: that is the token every
  // breadcrumb detector looks for, and a localized class name would hide the component
  // from all of them. The aria-label stays in the page language, for the people who hear it.
  return `<nav class="breadcrumbs" aria-label="${esc(t.breadcrumb.label)}">
    <ol>
      <li><a href="${basePath(lang)}">${esc(t.breadcrumb.home)}</a></li>
      <li aria-current="page">${esc(current)}</li>
    </ol>
  </nav>`;
}

/* ---------- the price list, rebuilt as a service picker ----------
   The most important structural change in the redesign. The old block was a
   table plus a separate CTA into Fresha's generic menu, so the customer chose
   twice: once mentally here, once for real over there. Now the row IS the
   choice — tapping it arms the sticky bar and the hand-off carries the service.

   Every row ships as an <a> straight into the Fresha menu, which is exactly
   where it pointed before, so the page is fully bookable with JavaScript off.
   main.js swaps each anchor for a real <button aria-pressed> on init.

   The strings the picker needs at runtime ride on the container as data-*: the
   unit, the resting labels and the Fresha base URL all belong to whoever owns
   the translations, not to main.js. */
function servicesHtml(lang) {
  const t = L[lang].services, bk = L[lang].booking;
  const groups = t.groups
    .map((g) => {
      const rows = SERVICES.filter((s) => s.cat === g.cat)
        .map(
          (s) => `<li><a class="svc" href="${SITE.freshaUrl}" target="_blank" rel="noopener"
            data-svc="${esc(s.key)}" data-name="${esc(t.names[s.key])}" data-dur="${s.dur}" data-price="${s.price}">
            <span class="svc__mark" aria-hidden="true">✓</span>
            <span class="svc__name">${esc(t.names[s.key])}</span>
            <span class="svc__dur num">${s.dur} ${esc(t.min)}</span>
            <span class="svc__price num">€${s.price}</span>
            <span class="svc__ext" aria-hidden="true">↗</span>
          </a></li>`
        )
        .join("");
      return `<div class="svc-group">
        <h3 class="svc-group__title">${esc(g.name)}</h3>
        <ul class="svc-list">${rows}</ul>
      </div>`;
    })
    .join("");
  return `<section class="services" id="services">
    <div class="wrap">
      <div class="sec-head reveal">
        <div><p class="eyebrow">${esc(t.label)}</p><h2>${esc(t.heading)}</h2></div>
        <p>${esc(t.pickHint)}</p>
      </div>
      <div class="svc-grid" id="picker"
        data-fresha="${SITE.freshaUrl}"
        data-unit="${esc(t.min)}"
        data-empty="${esc(t.totalEmpty)}"
        data-open="${esc(bk.open)}"
        data-sub="${esc(bk.barSub)}"
        data-via="${esc(bk.barVia)}"
        data-any="${esc(bk.anyService)}"
        data-choose="${esc(bk.chooseOnFresha)}"
        data-from="${esc(L[lang].hero.pill)}">${groups}</div>
      <!-- Reads "Nothing ticked yet — —" until a row is picked. aria-live so the
           running total is announced when it changes, since the change is the
           whole point of the interaction. -->
      <p class="svc-total" aria-live="polite">
        <span class="svc-total__k" id="svc-total-k">${esc(t.totalEmpty)}</span>
        <span class="svc-total__v metal num" id="svc-total-v">—</span>
      </p>
      <p class="sec-note">${esc(t.note)}</p>
    </div>
  </section>`;
}

/* ---------- retail shelf (display only — no cart, nothing ships) ---------- */
// Price falls back to SITE.priceFrom rendered as "from €10" so the page never states a
// per-SKU price the shop hasn't confirmed. A product with an explicit `price` renders
// that exact figure instead, and productPrice() is the single place both the visible
// label and the JSON-LD offer read from — they can't drift apart.
const productPrice = (p) => (typeof p.price === "number" ? p.price : SITE.priceFrom);
const productIsFrom = (p) => typeof p.price !== "number";
// Per-product link wins over the section-wide Fresha shop URL; both may be empty.
const productUrl = (p) => p.url || SITE.freshaShopUrl || "";

function productsHtml(lang) {
  const t = L[lang].products;
  const shopUrl = SITE.freshaShopUrl;
  const cards = PRODUCTS.map((p) => {
    const name = t.names[p.key];
    const type = t.types[p.key];
    const variant = t.variants && t.variants[p.key];
    // Meta line: only the facts printed on the packaging (type, tin colour, net size).
    const meta = [type, variant, p.size].filter(Boolean).join(" · ");
    const alt = `${p.brand} ${name} ${p.line} — ${type}`;
    const price = `€${productPrice(p)}`;
    const priceHtml = productIsFrom(p)
      ? `<span class="prod__from">${esc(t.from)}</span>${price}`
      : price;
    const href = productUrl(p);
    // The whole card becomes a link only once a real product URL exists; until then it is
    // a plain <article> so nothing looks clickable that isn't.
    const tag = href ? "a" : "article";
    const attrs = href ? ` href="${href}" target="_blank" rel="noopener"` : "";
    // The cut-out sits on a pool of gold light rather than a filled panel — the
    // one place in the design where gold is unambiguously a light source.
    // sizes reflects the real layout: two-up on the phone, a 116px thumbnail
    // beside the copy from 960px.
    return `<${tag} class="prod"${attrs}>
      <div class="prod__shot">
        <img src="${img(`product-${p.img}-440.webp`)}"
             srcset="${img(`product-${p.img}-440.webp`)} 440w, ${img(`product-${p.img}-880.webp`)} 880w"
             sizes="(min-width: 60em) 116px, 44vw"
             alt="${esc(alt)}" width="880" height="880" loading="lazy" decoding="async">
      </div>
      <div class="prod__body">
        <p class="prod__brand">${esc(p.brand)} · ${esc(p.line)}</p>
        <h3 class="prod__name">${esc(name)}</h3>
        <p class="prod__meta">${esc(meta)}</p>
        <p class="prod__desc">${esc(t.desc[p.key])}</p>
        <p class="prod__price num">${priceHtml}</p>
      </div>
    </${tag}>`;
  }).join("");
  // Fallback line while there is no shop URL: says plainly where the products are sold,
  // so nobody waits for a checkout that doesn't exist.
  const foot = shopUrl
    ? `<div class="prod-cta reveal"><a href="${shopUrl}" class="btn" target="_blank" rel="noopener">${esc(t.cta)} <span class="arr" aria-hidden="true">→</span></a></div>`
    : `<p class="prod-shopline"><span class="prod-shopline__dot" aria-hidden="true"></span>${esc(t.inShop)}</p>`;
  return `<section class="products" id="products">
    <div class="wrap">
      <div class="sec-head reveal">
        <div><p class="eyebrow">${esc(t.label)}</p><h2>${esc(t.heading)}</h2></div>
        <p>${esc(t.intro)} <span class="prod-intro__shop">${esc(t.introShop)}</span></p>
      </div>
      <div class="prod-grid">${cards}</div>
      <p class="sec-note">${esc(t.note)} ${esc(t.noteCodes)}</p>
      ${foot}
    </div>
  </section>`;
}

function aboutHtml(lang) {
  const t = L[lang].about;
  // The 3:4 portrait split and the gold-ruled pull-quote were the most finished
  // block on the old site and are kept as they were. The portrait of the barber
  // the redesign asks for has not been shot; until it is, the fade photograph
  // holds the frame rather than a captioned placeholder.
  return `<section class="about" id="about">
    <div class="wrap about__grid">
      <figure class="about__media img-reveal"><img src="${img("haircut-fade.webp")}" alt="${esc(L[lang].gallery.alt)}" width="1080" height="1920" loading="lazy" decoding="async"></figure>
      <div class="about__text">
        <p class="eyebrow reveal">${esc(t.label)}</p>
        <h2 class="reveal">${esc(t.heading)}</h2>
        ${t.body.map((p) => `<p>${esc(p)}</p>`).join("")}
        <blockquote class="about__quote">${esc(t.quote)}<cite>${esc(t.quoteAuthor)}</cite></blockquote>
      </div>
    </div>
  </section>`;
}

/* ---------- Work ----------
   One cell per GALLERY entry, so the block is composed at whatever material
   exists instead of holding open slots for photographs nobody has taken. A
   single-file scroll strip on the phone (a 16:9 loop cropped into a phone-width
   cell is nothing), a mosaic from 960px.

   width/height are the files' real intrinsic sizes, not the rendered box: the
   browser reserves space from that ratio before the bytes arrive, and a wrong
   value here is a layout shift. CSS aspect-ratio + object-fit crop the cell.

   A video entry renders poster-first with preload="none", so no media byte is
   requested until main.js calls play() — which it only does in view, and never
   on save-data, 2g or reduced motion. */
function galleryHtml(lang) {
  const t = L[lang].gallery;
  const cells = GALLERY.map((g) => {
    const cls = `gal__cell gal__cell--${g.span} gal__cell--r-${g.ratio.replace("/", "-")} img-reveal`;
    const cap = t.captions[g.cap];
    const media = g.video
      ? `<video data-loop muted playsinline loop preload="none" poster="${img(g.img)}" width="${g.w}" height="${g.h}" aria-label="${esc(cap)}">
           <source src="${img(g.video + ".webm")}" type="video/webm">
           <source src="${img(g.video + ".mp4")}" type="video/mp4">
         </video>`
      : `<img src="${img(g.img)}" alt="${esc(cap)}" width="${g.w}" height="${g.h}" loading="lazy" decoding="async">`;
    return `<figure class="${cls}">${media}<figcaption class="gal__cap">${esc(cap)}</figcaption></figure>`;
  }).join("");
  return `<section class="gallery" id="gallery">
    <div class="wrap">
      <div class="sec-head reveal">
        <div><p class="eyebrow">${esc(t.label)}</p><h2>${esc(t.heading)}</h2></div>
        <p>${esc(t.intro)}</p>
      </div>
      <div class="gal__grid">${cells}</div>
    </div>
  </section>`;
}

// Evergreen block, and the only place on the site that answers a question in words
// rather than in a price row: opening hours, languages, walk-ins, payment. The questions
// come from what people actually search ("barber near me", "barber shop paphos") and from
// what the shop already promises in its ads.
function faqHtml(lang) {
  const t = L[lang].faq;
  const items = t.items
    .map((it) => `<details class="faq__item">
          <summary>${esc(it.q)}</summary>
          <p>${esc(it.a)}</p>
        </details>`)
    .join("\n        ");
  return `<section class="faq" id="faq">
    <div class="wrap faq__grid">
      <div class="faq__head reveal"><p class="eyebrow">${esc(t.label)}</p><h2>${esc(t.heading)}</h2></div>
      <div class="faq__list">
        ${items}
      </div>
    </div>
  </section>`;
}

// For a tourist this section is the whole product: where, when, how far. Three
// cards on desktop — address, hours, map — stacked on the phone in that order,
// because "where am I going" comes before "when are they open".
//
// The map stays a real grayscale-graded Google embed rather than the mockup's
// placeholder tile: an embed that shows the street is worth more than a swatch,
// and the privacy policy already declares the IP hand-off it causes.
function visitHtml(lang) {
  const t = L[lang].visit;
  const rows = t.hours.map((r) => `<tr><td>${esc(r[0])}</td><td class="num">${esc(r[1])}</td></tr>`).join("");
  const mapQ = encodeURIComponent(`${SITE.street}, ${SITE.postal} ${SITE.city}, Cyprus`);
  const addr = street(lang);
  return `<section class="visit" id="visit">
    <div class="wrap">
      <div class="sec-head reveal">
        <div><p class="eyebrow">${esc(t.label)}</p><h2>${esc(t.heading)}</h2></div>
        <p class="num">${esc(t.intro)}</p>
      </div>
      <div class="visit__grid">
        <div class="visit__card">
          <h3>${esc(t.addressLabel)}</h3>
          <address><b>${esc(addr)}</b>${esc(SITE.district)}, ${esc(SITE.postal)} ${esc(SITE.city)}<br>Cyprus</address>
          <div class="visit__actions">
            <a href="tel:${SITE.phoneRaw}" class="btn btn--ghost num">${esc(SITE.phone)}</a>
            <a href="${whatsappLink(lang)}" class="btn btn--ghost" target="_blank" rel="noopener">WhatsApp</a>
          </div>
        </div>
        <div class="visit__card">
          <h3>${esc(t.hoursLabel)}</h3>
          <table class="hours-table"><tbody>${rows}</tbody></table>
          <div class="visit__actions">
            <a href="${SITE.googleProfile}" class="btn btn--ghost" target="_blank" rel="noopener">${esc(L[lang].footer.reviews)} <span aria-hidden="true">↗</span></a>
          </div>
        </div>
        <div class="map">
          <iframe title="${esc(SITE.brand)} — ${esc(t.label)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"
            src="https://maps.google.com/maps?q=${mapQ}&z=16&output=embed"></iframe>
        </div>
      </div>
    </div>
  </section>`;
}

function footerHtml(lang) {
  const t = L[lang];
  // The other language is named in its own language ("Ελληνικά" / "English"),
  // never as a flag or a code: a flag is a country, not a language.
  const other = SITE.langs.filter((lg) => lg !== lang);
  const otherLinks = other
    .map((lg) => `<a href="${basePath(lg)}" hreflang="${hrefLangCode(lg)}" lang="${hrefLangCode(lg)}">${esc(L[lg].label)}</a>`)
    .join("");
  return `<footer class="footer wrap">
    <div class="footer__brand">
      ${hex}
      <span>
        <span class="footer__name">Marino <i class="metal">Barbero</i></span>
        <span class="footer__tag">${esc(t.footer.tagline)}</span>
      </span>
    </div>
    <div class="footer__links">
      <a href="${SITE.instagram}" target="_blank" rel="noopener">@marino_barbero</a>
      <a href="${SITE.googleProfile}" target="_blank" rel="noopener">${esc(t.footer.reviews)}</a>
      <a href="${subPath(lang, "privacy")}">${esc(t.footer.privacy)}</a>
      <!-- The policy promises that consent can be withdrawn, so there has to be a way
           to withdraw it: this clears the stored choice and brings the banner back.
           A button, not a link — it performs an action and goes nowhere. -->
      <button type="button" class="footer__reset" data-consent-reset>${esc(t.footer.cookies)}</button>
      ${otherLinks}
    </div>
    <p class="footer__legal num">
      <span>© <span data-year>2026</span> ${esc(SITE.brandFull)}. ${esc(t.footer.rights)}</span>
      <span>${esc(street(lang))}, ${esc(SITE.district)}, ${esc(SITE.city)}, Cyprus</span>
      <span>${esc(t.footer.updated)} <time datetime="${BUILD_DATE}">${BUILD_DATE}</time></span>
    </p>
  </footer>`;
}

/* ---------- sticky booking bar + booking sheet ----------
   Replaces the floating round fab and its `fabPulse`. A looped scale-and-fade to
   draw the eye is the single most recognisable tell of generated UI, and the
   brief names it: it is gone, and nothing on this page loops any more.

   The bar sits in the thumb zone, holds the picked service if there is one, and
   keeps WhatsApp beside it for the people who will not self-book. It enters once
   when the hero scrolls away, on 200ms opacity + 8px, and never animates again.

   Both the bar's book control and the hero's are <button data-sheet-open>, not
   links: they open a panel on this page. The only <a> in the flow is the one that
   actually leaves for Fresha, which is also the only click GA4 counts. */
const WA_ICON = `<svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.22 8.22 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.2 8.2 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23Z"/></svg>`;

function barHtml(lang) {
  const bk = L[lang].booking;
  return `<div class="bar" id="bar">
    <button type="button" class="bar__book" data-sheet-open>
      <span>
        <span class="bar__title num" id="bar-title">${esc(bk.open)}</span>
        <span class="bar__sub" id="bar-sub">${esc(bk.barVia)}</span>
      </span>
      <span class="arr" aria-hidden="true">→</span>
    </button>
    <a class="bar__wa" href="${whatsappLink(lang)}" target="_blank" rel="noopener" aria-label="WhatsApp">${WA_ICON}</a>
  </div>`;
}

// The panel is a <div>, not an <aside>: the HTML spec allows neither role="dialog" nor
// aria-modal on <aside>, and the W3C validator failed the page on both (CI-017 / TE-181).
// The class carries all the styling, so the tag is invisible either way.
//
// The resting state is honest about what the hand-off carries — "Any service /
// Choose on Fresha / from €18" — rather than pretending a choice has been made.
function sheetHtml(lang) {
  const bk = L[lang].booking;
  return `<div class="sheet" id="sheet" role="dialog" aria-modal="true" aria-label="${esc(bk.title)}" aria-hidden="true">
    <button type="button" class="sheet__scrim" data-sheet-close tabindex="-1" aria-hidden="true"></button>
    <div class="sheet__panel">
      <button type="button" class="sheet__close" data-sheet-close aria-label="${esc(bk.close)}">✕</button>
      <span class="sheet__grip" aria-hidden="true"></span>
      <h2>${esc(bk.title)}</h2>
      <p class="sheet__intro">${esc(bk.intro)}</p>
      <div class="sheet__card">
        <span class="sheet__row"><span class="sheet__k">${esc(bk.serviceLabel)}</span><span class="sheet__v" id="sheet-svc">${esc(bk.anyService)}</span></span>
        <span class="sheet__row"><span class="sheet__k">${esc(bk.durLabel)}</span><span class="sheet__v num" id="sheet-dur">${esc(bk.chooseOnFresha)}</span></span>
        <span class="sheet__row sheet__row--total"><span class="sheet__k">${esc(bk.totalLabel)}</span><span class="sheet__total num" id="sheet-total">${esc(L[lang].hero.pill)}</span></span>
      </div>
      <div class="sheet__actions">
        <a class="btn" id="sheet-go" href="${SITE.freshaUrl}" target="_blank" rel="noopener">${esc(bk.cta)} <span class="arr" aria-hidden="true">→</span></a>
        <a class="btn btn--ghost" href="${whatsappLink(lang)}" target="_blank" rel="noopener">${esc(bk.whatsappAlt)}</a>
      </div>
      <p class="sheet__via">${esc(bk.via)}</p>
    </div>
  </div>`;
}

/* ---------- cookie consent banner (only when GA4 is on) ---------- */
// Hidden by default (hidden attr); main.js reveals it when no prior choice is stored.
// Buttons carry data-consent-* hooks; main.js wires them to gtag consent update.
//
// It lifts by var(--bar-h) so it clears the sticky bar. That replaces the old
// hard-coded 4.4rem, which was measured against a fab that no longer exists.
function consentHtml(lang) {
  if (!SITE.ga4) return "";
  const c = L[lang].consent;
  return `<div class="consent" id="consent" role="dialog" aria-live="polite" aria-label="${esc(c.aria)}" hidden>
    <p class="consent__text">${esc(c.text)}</p>
    <button type="button" class="btn btn--ghost consent__btn" data-consent-decline>${esc(c.decline)}</button>
    <button type="button" class="btn consent__btn" data-consent-accept>${esc(c.accept)}</button>
  </div>`;
}

/* ---------- Google Analytics 4 + Google Ads (gtag.js) ---------- */
// Emits nothing when SITE.ga4 is empty, so the site ships analytics-free until an
// ID is configured. Placed early in <head> per Google's install guidance. The async
// loader comes from googletagmanager.com; the config runs inline (CSP-hashed).
//
// SITE.ads is additive and independent: with it empty the output is byte-identical to
// the analytics-only build, and headersFile() leaves the Ads origins out of the CSP.
function gaHead() {
  if (!SITE.ga4) return "";
  return `
  <script async src="https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(SITE.ga4)}"></script>
  <script>${gaInline(SITE.ga4, SITE.ads)}</script>`;
}

/* ---------- display font preload ----------
   Only on the pages and in the language that can actually use the file. Playfair
   has no Greek, so /el/ would download 31KB and render none of it — the Greek
   pages get Georgia and no preload at all. `font-display: block` means the
   headline waits for these bytes, which is exactly why they are preloaded rather
   than discovered when the CSS is parsed.
   crossorigin is required on a font preload even same-origin: without it the
   browser fetches the file twice, once for the preload and once for the face. */
function fontPreload(lang) {
  if (lang !== "en") return "";
  return Object.values(FONTS)
    .map((f) => `<link rel="preload" as="font" type="font/woff2" href="${font(f)}" crossorigin>`)
    .join("\n  ");
}

/* ---------- <head> with full SEO ---------- */
// `page` is null for a language home page and {slug, url, title, description, crumb}
// for a secondary one. Everything that differs between the two — canonical, hreflang set,
// og:type, the hero preload, the product and FAQ graphs — hangs off that one argument.
function headHtml(lang, page) {
  const t = L[lang];
  const title = page ? page.title : t.meta.title;
  const description = page ? page.description : t.meta.description;
  const url = page ? page.url : pageUrl(lang);
  const alternates = SITE.langs
    .map((lg) => `<link rel="alternate" hreflang="${hrefLangCode(lg)}" href="${page ? subUrl(lg, page.slug) : pageUrl(lg)}">`)
    .join("\n  ");
  // x-default is the page offered to someone whose own language matches neither, so it
  // follows the demand (English), not the site's root language. See SITE.xDefaultLang.
  const xDefault = page ? subUrl(SITE.xDefaultLang, page.slug) : pageUrl(SITE.xDefaultLang);
  return `<meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">${gaHead()}
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${url}">
  ${alternates}
  <link rel="alternate" hreflang="x-default" href="${xDefault}">
  <meta name="theme-color" content="#100f0d">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta name="author" content="${esc(SITE.brandFull)}">
  <meta name="geo.region" content="CY-05">
  <meta name="geo.placename" content="Kato Paphos">
  <meta name="geo.position" content="${SITE.geo.lat};${SITE.geo.lng}">
  <!-- Open Graph -->
  <meta property="og:type" content="${page ? "website" : "business.business"}">
  <meta property="og:site_name" content="${esc(SITE.brandFull)}">
  <meta property="og:locale" content="${t.ogLocale}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${url}">
  <!-- Social card is a dedicated 1200x630 JPEG, not the WebP used on the page: several
       scrapers (WhatsApp among them, and WhatsApp is a booking channel here) still fail to
       render WebP previews, and a broken preview costs more than the extra 99 KB. -->
  <meta property="og:image" content="${SITE.domain}${img("og-cover.jpg")}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(t.meta.ogAlt)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${SITE.domain}${img("og-cover.jpg")}">
  ${page ? "" : `<link rel="preload" as="image" href="${img("interior.webp")}" fetchpriority="high">`}
  ${fontPreload(lang)}
  <link rel="stylesheet" href="${ASSETS.css}">
  <link rel="icon" href="${img("favicon.svg")}" type="image/svg+xml">
  ${jsonLd(lang)}
  ${page ? "" : productsJsonLd(lang)}
  ${webPageJsonLd(lang, page)}
  ${page && page.crumb ? breadcrumbJsonLd(lang, page) : ""}`;
  // No FAQPage node on purpose. Google restricted FAQ rich results to government and
  // health sites in 2023, so the markup on a barbershop earns no result and reads as
  // schema for schema's sake (TECH-001). The visible FAQ block stays — that is what the
  // freshness and AI-citability checks read, and what a customer actually gets.
}

/* ---------- full page ---------- */
function renderPage(lang) {
  const t = L[lang];
  return `<!DOCTYPE html>
<html lang="${t.htmlLang}" dir="${t.dir}">
<head>
  ${headHtml(lang)}
</head>
<body>
  <main>
    <!-- The nav is emitted inside .hero so it can sit over the photograph without
         a second stacking context; the hero is the only section it overlaps. -->
    ${heroHtml(lang)}
    ${fadeHtml(lang)}
    ${servicesHtml(lang)}
    ${galleryHtml(lang)}
    ${aboutHtml(lang)}
    ${productsHtml(lang)}
    ${visitHtml(lang)}
    ${faqHtml(lang)}
  </main>
  ${footerHtml(lang)}
  ${barHtml(lang)}
  ${sheetHtml(lang)}
  ${consentHtml(lang)}
  <script src="${ASSETS.js}" defer></script>
</body>
</html>`;
}

/* ---------- privacy policy (one per language) ---------- */
// A real page, not a modal: the site had no legal page at all (CN-040) and no legal link
// in the footer (AR-160), and a policy that lives in a popup cannot be linked, indexed or
// read later. Indexable on purpose — a privacy page is a trust signal, and hiding it from
// search helps nobody.
//
// The nav is the minimal one (logo + language), because the full nav is a list of anchors
// that only exist on the home page. GSAP is not loaded here — main.js degrades on its own
// and all this page needs from it is the consent banner and the cookie reset.
function privacyPage(lang) {
  const t = L[lang];
  const pv = t.privacy;
  const page = {
    slug: "privacy",
    url: subUrl(lang, "privacy"),
    title: pv.metaTitle,
    description: pv.metaDescription,
    crumb: pv.title,
  };
  const sections = pv.sections
    .map((sec) => `<section class="legal__sec">
          <h2>${esc(sec.h)}</h2>
          ${sec.p.map((x) => `<p>${esc(x)}</p>`).join("\n          ")}
        </section>`)
    .join("\n        ");
  // Short answers above the legal text. Cards, not a <dl> in a panel: the
  // question is the thing being scanned, so it gets display type and its own box.
  const glance = pv.glance
    .map(([q, a]) => `<div class="glance__item"><p class="glance__q">${esc(q)}</p><p class="glance__a">${esc(a)}</p></div>`)
    .join("\n          ");

  return `<!DOCTYPE html>
<html lang="${t.htmlLang}" dir="${t.dir}">
<head>
  ${headHtml(lang, page)}
</head>
<body class="no-bar">
  <header class="nav nav--solid" aria-label="${esc(SITE.brand)}">
    <a class="nav__back" href="${basePath(lang)}">← ${esc(t.breadcrumb.home)}</a>
    <div class="lang" role="group" aria-label="Language">${langSwitchHtml(lang, (lg) => subPath(lg, "privacy"))}</div>
  </header>
  <main class="legal">
    <div class="wrap legal__grid">
      <!-- Sticky title column on desktop: eight sections of legal text is a long
           way to scroll without being told what you are reading. -->
      <div class="legal__head">
        ${crumbsHtml(lang, pv.title)}
        ${hex}
        <h1>${esc(pv.title)}</h1>
        <p class="legal__updated num">${esc(pv.updatedLabel)} · <time datetime="${BUILD_DATE}">${BUILD_DATE}</time></p>
        <div class="legal__aside">
          <button type="button" class="btn btn--ghost" data-consent-reset>${esc(t.footer.cookies)}</button>
          <a href="tel:${SITE.phoneRaw}" class="btn btn--ghost num">${esc(SITE.phone)}</a>
        </div>
      </div>
      <div class="legal__body">
        <p class="legal__intro">${esc(pv.intro)}</p>
        <p class="eyebrow glance__label">${esc(pv.glanceLabel)}</p>
        <div class="glance">
          ${glance}
        </div>
        <div class="legal__secs">
          ${sections}
        </div>
        <p class="legal__nap num">${esc(SITE.brandFull)} · ${esc(street(lang))}, ${esc(SITE.district)}, ${esc(SITE.postal)} ${esc(SITE.city)}, Cyprus · ${esc(SITE.phone)}</p>
      </div>
    </div>
  </main>
  ${footerHtml(lang)}
  ${consentHtml(lang)}
  <script src="${ASSETS.js}" defer></script>
</body>
</html>`;
}

/* ---------- custom 404 page (one per language) ---------- */
// Fully static and self-contained: no main.js, no reveal classes — so it renders
// correctly with zero JS (a 404 route can be hit before/without the bundle). Reuses the
// hashed stylesheet for on-brand styling. Netlify serves the nearest 404.html (root for
// "/…", /en/404.html for "/en/…") with a real 404 status. Marked noindex.
//
// The GA snippet IS emitted here (gaHead) even though nothing else on this page needs JS:
// Google Tag diagnostics counts an untagged page as a measurement gap, and a 404 that
// nobody measures is a broken inbound link nobody finds out about. Same bytes as the main
// pages, so the CSP hash in headersFile() already covers it.
function notFoundHtml(lang) {
  const t = L[lang];
  const nf = t.notFound;
  const b = basePath(lang);
  return `<!DOCTYPE html>
<html lang="${t.htmlLang}" dir="${t.dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">${gaHead()}
  <title>${esc(nf.title)} · ${esc(SITE.brand)}</title>
  <meta name="robots" content="noindex, follow">
  <meta name="theme-color" content="#100f0d">
  ${fontPreload(lang)}
  <link rel="stylesheet" href="${ASSETS.css}">
  <link rel="icon" href="${img("favicon.svg")}" type="image/svg+xml">
</head>
<body class="nf-body no-bar">
  <header class="nav nav--solid" aria-label="${esc(SITE.brand)}">
    <a class="nav__logo" href="${b}" aria-label="${esc(SITE.brandFull)}">${esc(SITE.brand)}</a>
    <div class="lang" role="group" aria-label="Language">${langSwitchHtml(lang, basePath)}</div>
  </header>
  <main class="notfound">
    <div class="notfound__inner">
      ${hex}
      <p class="notfound__code num" aria-hidden="true">${esc(nf.code)}</p>
      <h1 class="notfound__title">${esc(nf.heading)}</h1>
      <p class="notfound__text">${esc(nf.text)}</p>
      <div class="notfound__actions">
        <a href="${b}" class="btn">${esc(nf.home)} <span class="arr" aria-hidden="true">→</span></a>
        <a href="${SITE.freshaUrl}" class="btn btn--ghost" target="_blank" rel="noopener">${esc(nf.book)}</a>
      </div>
    </div>
  </main>
</body>
</html>`;
}

/* ---------- asset minification ---------- */
// The generator has no dependencies and the stylesheet is a single hand-written file, so
// this removes only what is provably decoration and leaves every value alone (TE-174).
//
// Deliberately NOT touched: whitespace around "+", "-", "*", "/" and ">" — those carry
// meaning inside calc() and in child selectors — and the space after ":", which costs a
// few bytes and keeps the output readable if anyone ever opens it in devtools. Runs of
// whitespace collapse to one space rather than to nothing for the same reason:
// calc(100vw - 2 * var(--pad)) has to survive.
function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")   // comments
    .replace(/\s+/g, " ")                 // any run of whitespace -> one space
    .replace(/\s*([{};,])\s*/g, "$1")     // separators need no padding
    .replace(/;}/g, "}")                 // last semicolon in a block is redundant
    .trim();
}

/* ---------- SEO + hosting files ---------- */
function sitemap() {
  const today = BUILD_DATE;
  // Home pages first, then every secondary page, each with the same alternate set the
  // page's own <head> declares — a sitemap that disagrees with the page is worse than no
  // sitemap, because Google has to pick one and will not tell you which.
  const entries = [
    ...SITE.langs.map((lg) => ({ lang: lg, slug: null, priority: lg === SITE.langs[0] ? "1.0" : "0.8", freq: "monthly" })),
    ...SITE.langs.map((lg) => ({ lang: lg, slug: "privacy", priority: "0.3", freq: "yearly" })),
  ];
  const urls = entries
    .map(({ lang: lg, slug, priority, freq }) => {
      const loc = slug ? subUrl(lg, slug) : pageUrl(lg);
      const alts = SITE.langs
        .map((a) => `    <xhtml:link rel="alternate" hreflang="${hrefLangCode(a)}" href="${slug ? subUrl(a, slug) : pageUrl(a)}"/>`)
        .join("\n");
      return `  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${freq}</changefreq>
    <priority>${priority}</priority>
${alts}
    <xhtml:link rel="alternate" hreflang="x-default" href="${slug ? subUrl(SITE.xDefaultLang, slug) : pageUrl(SITE.xDefaultLang)}"/>
  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;
}

// robots.txt is written per token, not as one blanket rule, because "AI crawler" is three
// different jobs and they deserve three different answers (GEO-003).
//
//   answers   — a bot fetching the page because someone is asking a question right now.
//               A citation here is a booking, so these stay open. Note that Perplexity-User
//               generally ignores robots.txt anyway; it is listed for the record.
//   training  — a bot collecting text to train a model. Allowed on purpose: a barbershop
//               gains from being the shop models know about in Kato Paphos, and there is
//               nothing on this site worth withholding. Flip any of these to Disallow if
//               the owner decides otherwise — the file is the only place it needs changing.
//               Google-Extended covers Gemini training and grounding, not AI Overviews or
//               AI Mode (those follow the normal Googlebot rules above).
//               Applebot-Extended covers training only; Applebot's use in answers is
//               governed by nosnippet, which this site does not set.
//   ads       — creative and landing-page review. Blocking these breaks the campaign.
const AI_AGENTS = {
  answers: ["Claude-User", "Claude-SearchBot", "OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "Perplexity-User", "MistralAI-User"],
  training: ["ClaudeBot", "GPTBot", "Google-Extended", "Applebot-Extended", "CCBot", "meta-externalagent"],
  ads: ["AdsBot-Google", "AdsBot-Google-Mobile", "AdsBot-Google-Mobile-Apps"],
};

const robots = `# Search engines: everything, including images and the map embed.
User-agent: *
Allow: /

# AI assistants answering a question about this shop — allowed, a citation is a booking.
${AI_AGENTS.answers.map((a) => `User-agent: ${a}\nAllow: /`).join("\n\n")}

# Model training — allowed deliberately, not by omission.
${AI_AGENTS.training.map((a) => `User-agent: ${a}\nAllow: /`).join("\n\n")}

# Ad review — required for the Google Ads campaign to run.
${AI_AGENTS.ads.map((a) => `User-agent: ${a}\nAllow: /`).join("\n\n")}

Sitemap: ${SITE.domain}/sitemap.xml

# Plain-language map of this site for LLMs: ${SITE.domain}/llms.txt
`;

// llms.txt — the site in plain text for models that read pages to answer a question
// rather than to rank them (GEO-001 / GEO-002). Written in English on purpose: the
// English page carries 1820 of 1852 Search Console impressions, and ChatGPT already
// sends sessions here.
//
// Everything below is generated from content.js, so the file cannot drift from the page:
// a price changed in one place is changed in both.
function llmsTxt() {
  const t = L.en;
  const services = SERVICES.map((sv) => `- ${t.services.names[sv.key]} — €${sv.price} (${sv.dur} min)`).join("\n");
  const products = PRODUCTS.map((pr) => {
    const variant = t.products.variants[pr.key] ? `, ${t.products.variants[pr.key]}` : "";
    return `- ${pr.schemaName} — ${t.products.types[pr.key]}${variant}, from €${SITE.priceFrom}`;
  }).join("\n");
  const hours = t.visit.hours.map((h) => `- ${h[0]}: ${h[1]}`).join("\n");
  const today = new Date().toISOString().slice(0, 10);

  return `# ${SITE.brandFull}

> Men's barber shop in Kato Paphos, Cyprus. Fades, classic cuts and beard care, booked
> online. Rated ${SITE.rating.value} from ${SITE.rating.count} Google reviews. Greek and English spoken.

Two pages, same shop, one in each language — English at the root, Greek at /el/. There is
no blog, no online store and nothing ships: the products listed below are sold over the
counter, and the only transaction on this site is an appointment.

## Pages
- [${SITE.brand} — English](${pageUrl("en")}): ${L.en.meta.description}
- [${SITE.brand} — Greek](${pageUrl("el")}): ${L.el.meta.description}
- [Privacy policy](${subUrl("en", "privacy")}): what the site measures, who receives it, how to withdraw consent ([Greek](${subUrl("el", "privacy")}))

## Visit
- Address: ${SITE.street}, ${SITE.district}, ${SITE.postal} ${SITE.city}, Cyprus
- Phone: ${SITE.phone}
- WhatsApp: ${SITE.whatsapp}
- Google Business Profile: ${SITE.googleProfile}
- Instagram: ${SITE.instagram}

## Opening hours
${hours}

## Services and prices
${services}

Prices are the in-shop price list in euro. Cash and card accepted.

## Products stocked in the shop
${products}

Retail only, in person. "From €${SITE.priceFrom}" is a floor across the range, not a per-item price —
ask in the chair which code suits your hair.

## Booking
- [Book online](${SITE.freshaUrl}): live availability, handled by Fresha
- [WhatsApp](${SITE.whatsapp}): if you would rather ask a person

## Answers to the usual questions
${t.faq.items.map((it) => `- ${it.q} ${it.a}`).join("\n")}

Last updated: ${today}
`;
}

// DO NOT add a "/en -> /en/" rule to a _redirects file here. It was tried and it took the
// site down with ERR_TOO_MANY_REDIRECTS.
//
// Two Netlify behaviours combine to make that rule a loop:
//   1. Netlify normalises the trailing slash before matching, so a `from = "/en"` rule
//      matches BOTH /en and /en/ — the destination matches its own source.
//   2. The force flag ("!") makes the rule win over an existing static file, so
//      /en/index.html never gets a chance to be served and the 301 fires forever.
//
// It is also unnecessary: Netlify already serves /en/index.html for a request to /en.
// The equivalent rule in netlify.toml is harmless only because it has no force flag —
// without it, an existing file wins and the redirect never fires.

// CSP is built here so the inline-script hashes always match the bytes emitted above,
// and so the Google Analytics origins are added only when SITE.ga4 is set.
function headersFile() {
  const on = Boolean(SITE.ga4);
  // Google Ads rides on the GA4 tag, so it can only be on when analytics is.
  const ads = on && Boolean(SITE.ads);
  // The only inline script left is the gtag config, and only when analytics is on.
  const inlineHashes = on ? [cspHash(gaInline(SITE.ga4, SITE.ads))] : [];
  // gtag.js itself comes from googletagmanager.com for both products, but the Ads half
  // pulls a further script from googleadservices.com for the conversion linker.
  //
  // Google Tag diagnostics flagged "security settings are blocking measurement" (21.08.2026)
  // and it was right: the conversion ping does not go only to googleadservices.com. gtag
  // also hits www.google.com (/pagead/1p-conversion and /ccm/collect — the first-party
  // conversion path) and the doubleclick hosts (td. and stats. for GA4-Ads linkage). With
  // those missing from img-src/connect-src the browser dropped the pings and the account
  // recorded no conversions. www.google.com.cy is here because Google routes some pings
  // through the visitor's regional domain; other ccTLDs stay blocked, which only costs
  // third-party cookie syncing — dead in most browsers and denied by default here anyway.
  const adsOrigins = [
    "https://www.googleadservices.com",
    "https://googleads.g.doubleclick.net",
    "https://stats.g.doubleclick.net",
    "https://td.doubleclick.net",
    "https://www.google.com",
    "https://www.google.com.cy",
    // Added 22.08.2026 after the live console showed gtag's conversion beacon blocked on
    // both connect-src and img-src: gtag posts /ccm/collect to pagead2 as well as to the
    // hosts above, and with it missing the Ads account sees no page_view or conversion
    // from a real visit — which is the likeliest reason Ads reports 0 conversions while
    // GA4 counts book_click. Same reasoning as every other host in this list.
    "https://pagead2.googlesyndication.com",
    // Added the same day, one deploy later. The first fix was verified with consent
    // DENIED, which is the only state a visitor has before answering the banner — and in
    // that state gtag routes everything through pagead2. With consent GRANTED it routes
    // through here instead (/ccm/s/collect), and that was still blocked: the conversions
    // that Ads can actually attribute are exactly the ones from visitors who accepted.
    "https://ad.doubleclick.net",
  ];
  // googleads.g.doubleclick.net serves the view-through conversion tag as a SCRIPT, not
  // just as a beacon: with it missing from script-src the tag was blocked and gtag fell
  // back to an image pixel, which carries less than the script does. Same trust tier as
  // googletagmanager and googleadservices — all three are Google-operated and all three
  // are here only because the Ads account is live.
  //
  // cdnjs.cloudflare.com was removed in the 2026-08 redesign along with GSAP: the
  // motion layer is CSS now, so the page loads no third-party script except the
  // Google tag, and only when analytics is switched on.
  const scriptSrc = ["'self'", ...(on ? ["https://www.googletagmanager.com"] : []), ...(ads ? ["https://www.googleadservices.com", "https://googleads.g.doubleclick.net"] : []), ...inlineHashes];
  // GA4 sends hits (and loads gtag) from these origins; Google may route via any of them.
  const gaConnect = ["https://*.google-analytics.com", "https://*.googletagmanager.com", "https://*.analytics.google.com"];
  const connectSrc = ["'self'", ...(on ? gaConnect : []), ...(ads ? adsOrigins : [])];
  // Conversion pings are still delivered as image beacons in some browsers, so the Ads
  // origins have to be in img-src as well as connect-src.
  const imgSrc = ["'self'", "data:", ...(on ? ["https://*.google-analytics.com", "https://*.googletagmanager.com"] : []), ...(ads ? adsOrigins : [])];
  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    // No inline <style> or style="" is emitted, and GSAP animates via CSSOM
    // (element.style.prop), which CSP does not gate — so 'unsafe-inline' is unnecessary.
    "style-src 'self'",
    `img-src ${imgSrc.join(" ")}`,
    // The display face is self-hosted, so this stays at 'self' — no Google Fonts
    // origin, no third-party font request, nothing to add when the subset changes.
    "font-src 'self'",
    // Only present once a Work cell actually carries a loop (GALLERY entries with
    // `video`). Until then there is no media to play and no directive to write.
    ...(hasVideo ? ["media-src 'self'"] : []),
    "frame-src https://www.google.com https://maps.google.com",
    `connect-src ${connectSrc.join(" ")}`,
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
  return `/assets/*
  Cache-Control: public, max-age=31536000, immutable

/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN
  Cross-Origin-Opener-Policy: same-origin
  Content-Security-Policy: ${csp}
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), browsing-topics=()
`;
}

/* ---------- favicon (gold "MB" monogram on charcoal) ---------- */
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#100f0d"/><text x="50%" y="53%" dominant-baseline="middle" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="30" fill="#c9a24b" letter-spacing="-1">MB</text></svg>`;

/* ---------- build ---------- */
function build() {
  rmrf(DIST);
  mkdir(DIST);

  // Fonts before CSS: the stylesheet's @font-face src has to name the hashed
  // filenames, so the files must exist and be fingerprinted first.
  const fontOut = path.join(DIST, "assets", "fonts");
  const fontSrc = path.join(SRC, "fonts");
  for (const file of Object.values(FONTS)) {
    const p = path.join(fontSrc, file);
    if (!fs.existsSync(p)) throw new Error(`Missing display font: src/fonts/${file}`);
    const buf = fs.readFileSync(p);
    const ext = path.extname(file);
    const hashed = `${file.slice(0, -ext.length)}.${hash8(buf)}${ext}`;
    write(path.join(fontOut, hashed), buf);
    FONT_URL[file] = `/assets/fonts/${hashed}`;
  }

  // Hash + write CSS/JS first so the pages can reference the fingerprinted URLs.
  // Minify before hashing: the hash has to describe the bytes that actually ship.
  //
  // The font placeholders are substituted here rather than in the stylesheet so
  // that styles.css stays a plain, editable file that opens correctly in a
  // browser on its own. Every placeholder must resolve — an unreplaced token
  // would ship a 404 in a @font-face and take the display type down silently.
  let cssSrc = fs.readFileSync(path.join(SRC, "css", "styles.css"), "utf8");
  for (const [token, file] of Object.entries(FONTS)) {
    if (!cssSrc.includes(token)) throw new Error(`styles.css no longer references ${token}`);
    cssSrc = cssSrc.split(token).join(font(file));
  }
  const cssBuf = Buffer.from(minifyCss(cssSrc));
  const jsBuf = fs.readFileSync(path.join(SRC, "js", "main.js"));
  const cssName = `styles.${hash8(cssBuf)}.css`;
  const jsName = `main.${hash8(jsBuf)}.js`;
  ASSETS.css = `/assets/css/${cssName}`;
  ASSETS.js = `/assets/js/${jsName}`;
  write(path.join(DIST, "assets", "css", cssName), cssBuf);
  write(path.join(DIST, "assets", "js", jsName), jsBuf);

  // Content-hash every image BEFORE rendering pages so templates resolve img() to the
  // fingerprinted URLs. emitImg writes "<base>.<hash><ext>" and records name -> URL.
  const imgOut = path.join(DIST, "assets", "img");
  mkdir(imgOut);
  const emitImg = (name, buf) => {
    const ext = path.extname(name);
    const hashed = `${name.slice(0, -ext.length)}.${hash8(buf)}${ext}`;
    write(path.join(imgOut, hashed), buf);
    IMG[name] = `/assets/img/${hashed}`;
  };
  const srcImg = path.join(SRC, "img");
  if (fs.existsSync(srcImg)) {
    for (const f of fs.readdirSync(srcImg)) {
      const s = path.join(srcImg, f);
      if (fs.statSync(s).isFile()) emitImg(f, fs.readFileSync(s));
    }
  }
  // Generated favicon, hashed like any other asset.
  emitImg("favicon.svg", Buffer.from(favicon));
  // On-brand SVG fallback for any required photo missing from src/img, mapped onto the
  // .jpg logical name so templates requesting it still resolve to a real emitted file.
  ["interior-bg.webp", "interior.webp", "haircut-fade.webp", "og-cover.jpg"].forEach((name) => {
    if (IMG[name]) return;
    const buf = Buffer.from(placeholder("Marino Barbero · Kato Paphos", 1600, 1067));
    const hashed = `${name.replace(/\.(webp|jpg)$/, "")}.${hash8(buf)}.svg`;
    write(path.join(imgOut, hashed), buf);
    IMG[name] = `/assets/img/${hashed}`;
  });

  for (const lang of SITE.langs) {
    const home = lang === SITE.langs[0];
    write(home ? path.join(DIST, "index.html") : path.join(DIST, lang, "index.html"), renderPage(lang));
    // Per-language custom 404 — Netlify serves the nearest (root for "/…", /en/404.html
    // for "/en/…") with a real 404 status.
    write(home ? path.join(DIST, "404.html") : path.join(DIST, lang, "404.html"), notFoundHtml(lang));
    const privacyDir = home ? path.join(DIST, "privacy") : path.join(DIST, lang, "privacy");
    write(path.join(privacyDir, "index.html"), privacyPage(lang));
  }

  write(path.join(DIST, "sitemap.xml"), sitemap());
  write(path.join(DIST, "robots.txt"), robots);
  write(path.join(DIST, "llms.txt"), llmsTxt());
  write(path.join(DIST, "_headers"), headersFile());

  console.log("✓ Built dist/ for languages:", SITE.langs.join(", "));
}

build();
