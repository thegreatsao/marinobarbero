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
const { SITE, HOURS, SERVICES, PRODUCTS, L } = require("./content/content.js");

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

// CSP source hash for an inline <script> body (must match the bytes between the tags
// exactly). Used to keep script-src strict — no 'unsafe-inline' — while still allowing
// our own inline snippets (the js-class flag and, when enabled, the GA4 config).
const cspHash = (js) => `'sha256-${crypto.createHash("sha256").update(js, "utf8").digest("base64")}'`;

// Inline script bodies, defined once so the emitted <script> and the CSP hash always
// agree. INLINE_JS_CLASS sets the "js" class before paint (progressive enhancement).
const INLINE_JS_CLASS = `document.documentElement.className="js";`;
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
function navHtml(lang) {
  const t = L[lang], b = basePath(lang);
  const link = (href, label) => `<a href="${href}">${esc(label)}</a>`;
  const langSwitch = SITE.langs
    .map((lg) => `<a href="${basePath(lg)}" hreflang="${hrefLangCode(lg)}" class="${lg === lang ? "active" : ""}" aria-label="${esc(L[lg].label)}">${lg.toUpperCase()}</a>`)
    .join("");
  return `<header class="nav" aria-label="${esc(SITE.brand)}">
    <a class="nav__logo" href="${b}" aria-label="${esc(SITE.brandFull)}">MARINO<em>BARBERO</em></a>
    <nav class="nav__menu" aria-label="Primary">
      <div class="nav__links">
        ${link("#services", t.nav.services)}
        ${link("#products", t.nav.products)}
        ${link("#about", t.nav.about)}
        ${link("#gallery", t.nav.gallery)}
        ${link("#visit", t.nav.visit)}
      </div>
      <div class="lang" role="group" aria-label="Language">${langSwitch}</div>
      <a href="${SITE.freshaUrl}" class="btn btn--nav" target="_blank" rel="noopener" data-magnetic>${esc(t.nav.book)} <span class="arr">→</span></a>
    </nav>
    <button class="nav__burger" aria-label="Menu"><span></span><span></span><span></span></button>
  </header>`;
}

function heroHtml(lang) {
  const t = L[lang].hero;
  // Join with spaces so the H1's text content reads as words ("Χρόνος για το τέλειο
  // κούρεμα."), not run-together — matters for crawlers and screen readers. The space
  // text nodes sit between block-level .line elements, so they don't affect layout.
  const lines = t.titleLines.map((l) => `<span class="line"><span>${esc(l)}</span></span>`).join(" ");
  return `<section class="hero" id="top">
    <div class="hero__media"><img src="${img("interior-bg.webp")}" alt="${esc(L[lang].meta.ogAlt)}" width="1440" height="1187" fetchpriority="high"></div>
    <div class="hero__scrim" aria-hidden="true"></div>
    <div class="wrap hero__inner">
      <!-- The eyebrow lives INSIDE the h1 on purpose. On its own the headline said
           "Time for the perfect cut" — no service category, no city — and the audit read
           it as an H1 that answers no query (KW-073). Wrapped in here it reads
           "Men's Barber Shop · Kato Paphos / Time for the perfect cut." to a crawler and
           looks exactly as before to a visitor. -->
      <h1 class="hero__title">
        <span class="eyebrow hero__eyebrow">${esc(t.eyebrow)}</span>
        <span class="hero__lines">${lines}</span>
      </h1>
      <p class="hero__sub">${esc(t.subtitle)}</p>
      <div class="hero__actions">
        <a href="${SITE.freshaUrl}" class="btn" target="_blank" rel="noopener" data-magnetic>${esc(t.book)} <span class="arr">→</span></a>
        <a href="${whatsappLink(lang)}" class="btn btn--ghost" target="_blank" rel="noopener">${esc(t.whatsapp)}</a>
      </div>
    </div>
    <div class="scroll-cue" aria-hidden="true"><span>${esc(t.scroll)}</span><span class="bar"></span></div>
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

function proofHtml(lang) {
  const t = L[lang].proof;
  const stars = "★★★★★";
  return `<section class="proof" aria-label="Google rating">
    <div class="wrap proof__grid reveal">
      <div class="proof__score">
        <span class="proof__num">${esc(t.rating)}</span>
        <span class="proof__stars" aria-hidden="true">${stars}</span>
        <span class="proof__meta">${esc(t.of)} · ${esc(t.count)}</span>
      </div>
      <blockquote class="proof__quote">${esc(t.quote)}</blockquote>
      <a class="proof__cta" href="${SITE.googleProfile}" target="_blank" rel="noopener">${esc(t.cta)} <span class="arr">↗</span></a>
    </div>
  </section>`;
}

function marqueeHtml(lang) {
  const items = L[lang].marquee.map((m) => `<span>${esc(m)}</span><span class="dot" aria-hidden="true">·</span>`).join("");
  // The clone is flagged item by item rather than wrapped in one element. The wrapper had
  // to be display:contents so the flex gap would still land between words, and a text
  // container with no box of its own reads as clipped text to anything measuring
  // scrollWidth against clientWidth (MB-108).
  const clones = L[lang].marquee
    .map((m) => `<span data-marquee-clone>${esc(m)}</span><span class="dot" data-marquee-clone aria-hidden="true">·</span>`)
    .join("");
  // The track is emitted twice, and main.js no longer duplicates it at runtime. The loop
  // needs two copies to scroll seamlessly (it translates by scrollWidth / 2), but doing
  // that with innerHTML made the rendered DOM differ from the served HTML — 94 spans
  // against 82 — which is exactly what MB-105 measures. Same pixels, one source.
  // Two copies, each in its own element: the loop needs both (it translates by half the
  // track), but below 860px the second one is hidden and the strip wraps instead of
  // scrolling — a ticker is overflow:hidden by definition, which is what MB-108 counts as
  // clipped text at phone width.
  return `<div class="marquee" aria-hidden="true"><div class="marquee__track">${items}${clones}</div></div>`;
}

function servicesHtml(lang) {
  const t = L[lang].services;
  const groups = t.groups
    .map((g) => {
      const rows = SERVICES.filter((s) => s.cat === g.cat)
        .map(
          (s) => `<li class="svc${s.hero ? " svc--hero" : ""}">
            <span class="svc__name">${esc(t.names[s.key])}${s.hero ? ` <span class="svc__tag">★</span>` : ""}</span>
            <span class="svc__dur">${s.dur} ${esc(t.min)}</span>
            <span class="svc__price">€${s.price}</span>
          </li>`
        )
        .join("");
      return `<div class="svc-group reveal">
        <h3 class="svc-group__title">${esc(g.name)}</h3>
        <ul class="svc-list">${rows}</ul>
      </div>`;
    })
    .join("");
  return `<section class="services" id="services">
    <div class="wrap">
      <div class="sec-head reveal"><p class="eyebrow">${esc(t.label)}</p><h2>${esc(t.heading)}</h2></div>
      <div class="svc-grid">${groups}</div>
      <p class="svc-note reveal">${esc(t.note)}</p>
      <div class="svc-cta reveal"><a href="${SITE.freshaUrl}" class="btn" target="_blank" rel="noopener" data-magnetic>${esc(t.book)} <span class="arr">→</span></a></div>
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
      ? `<span class="prod__from">${esc(t.from)}</span> ${price}`
      : price;
    const href = productUrl(p);
    // The whole card becomes a link only once a real product URL exists; until then it is
    // a plain <article> so nothing looks clickable that isn't.
    const tag = href ? "a" : "article";
    const attrs = href ? ` href="${href}" target="_blank" rel="noopener"` : "";
    return `<${tag} class="prod"${attrs}>
      <div class="prod__shot">
        <img src="${img(`product-${p.img}-440.webp`)}"
             srcset="${img(`product-${p.img}-440.webp`)} 440w, ${img(`product-${p.img}-880.webp`)} 880w"
             sizes="(max-width: 560px) 88vw, (max-width: 960px) 44vw, 340px"
             alt="${esc(alt)}" width="880" height="880" loading="lazy" decoding="async">
      </div>
      <div class="prod__body">
        <p class="prod__brand">${esc(p.brand)} · ${esc(p.line)}</p>
        <h3 class="prod__name">${esc(name)}</h3>
        <p class="prod__meta">${esc(meta)}</p>
        <p class="prod__desc">${esc(t.desc[p.key])}</p>
        <p class="prod__price">${priceHtml}</p>
      </div>
    </${tag}>`;
  }).join("");
  // Fallback line while there is no shop URL: says plainly where the products are sold,
  // so nobody waits for a checkout that doesn't exist.
  const foot = shopUrl
    ? `<div class="prod-cta reveal"><a href="${shopUrl}" class="btn" target="_blank" rel="noopener" data-magnetic>${esc(t.cta)} <span class="arr">→</span></a></div>`
    : `<p class="prod-shopline reveal"><span class="prod-shopline__dot" aria-hidden="true"></span>${esc(t.inShop)}</p>`;
  return `<section class="products" id="products">
    <div class="wrap">
      <div class="sec-head reveal">
        <p class="eyebrow">${esc(t.label)}</p>
        <h2>${esc(t.heading)}</h2>
        <p class="prod-intro">${esc(t.intro)}</p>
      </div>
      <div class="prod-grid" data-stagger>${cards}</div>
      <p class="prod-note reveal">${esc(t.note)}</p>
      ${foot}
    </div>
  </section>`;
}

function aboutHtml(lang) {
  const t = L[lang].about;
  return `<section class="about" id="about">
    <div class="wrap about__grid">
      <div class="about__media img-reveal" data-parallax="6"><img src="${img("haircut-fade.webp")}" alt="${esc(L[lang].gallery.alt)}" width="1080" height="1920" loading="lazy"></div>
      <div class="about__text reveal">
        <p class="eyebrow">${esc(t.label)}</p>
        <h2>${esc(t.heading)}</h2>
        ${t.body.map((p) => `<p>${esc(p)}</p>`).join("")}
        <blockquote class="about__quote">${esc(t.quote)}<cite>${esc(t.quoteAuthor)}</cite></blockquote>
      </div>
    </div>
  </section>`;
}

function galleryHtml(lang) {
  const t = L[lang].gallery;
  // width/height are the files' real intrinsic sizes, not the rendered box. The browser
  // reserves space from this ratio before the bytes arrive; a wrong ratio here is a layout
  // shift, and CSS aspect-ratio + object-fit still crop the cell exactly as before.
  const imgs = [
    { src: img("interior.webp"), w: 1600, h: 906 },
    { src: img("haircut-fade.webp"), w: 1080, h: 1920 },
    { src: img("interior-bg.webp"), w: 1440, h: 1187 },
  ];
  const cells = imgs
    .map((im, i) => `<figure class="gal__cell img-reveal${i === 0 ? " gal__cell--wide" : ""}"><img src="${im.src}" alt="${esc(t.alt)}" width="${im.w}" height="${im.h}" loading="lazy"></figure>`)
    .join("");
  return `<section class="gallery" id="gallery">
    <div class="wrap">
      <div class="sec-head reveal"><p class="eyebrow">${esc(t.label)}</p><h2>${esc(t.heading)}</h2></div>
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
    <div class="wrap">
      <div class="sec-head reveal"><p class="eyebrow">${esc(t.label)}</p><h2>${esc(t.heading)}</h2></div>
      <div class="faq__list reveal">
        ${items}
      </div>
    </div>
  </section>`;
}

function visitHtml(lang) {
  const t = L[lang].visit;
  const rows = t.hours.map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join("");
  const mapQ = encodeURIComponent(`${SITE.street}, ${SITE.postal} ${SITE.city}, Cyprus`);
  const addr = street(lang);
  return `<section class="visit" id="visit">
    <div class="wrap visit__grid">
      <div class="reveal">
        <p class="eyebrow">${esc(t.label)}</p>
        <h2>${esc(t.heading)}</h2>
        <div class="visit__info">
          <div class="visit__block">
            <h3>${esc(t.addressLabel)}</h3>
            <p>${esc(addr)}<br>${esc(SITE.district)}, ${esc(SITE.postal)} ${esc(SITE.city)}</p>
            <a href="${SITE.googleProfile}" target="_blank" rel="noopener">${esc(L[lang].footer.reviews)} ↗</a>
          </div>
          <div class="visit__block">
            <h3>${esc(t.contactLabel)}</h3>
            <a href="tel:${SITE.phoneRaw}">${esc(SITE.phone)}</a>
            <a href="${whatsappLink(lang)}" target="_blank" rel="noopener">WhatsApp ↗</a>
            <a href="${SITE.instagram}" target="_blank" rel="noopener">Instagram ↗</a>
          </div>
          <div class="visit__block visit__block--wide">
            <h3>${esc(t.hoursLabel)}</h3>
            <table class="hours-table"><tbody>${rows}</tbody></table>
          </div>
        </div>
        <div class="visit__cta"><a href="${SITE.freshaUrl}" class="btn" target="_blank" rel="noopener" data-magnetic>${esc(t.book)} <span class="arr">→</span></a></div>
      </div>
      <div class="map reveal">
        <iframe title="Marino Barbero location map" loading="lazy" referrerpolicy="no-referrer-when-downgrade"
          src="https://maps.google.com/maps?q=${mapQ}&z=16&output=embed"></iframe>
      </div>
    </div>
  </section>`;
}

function footerHtml(lang) {
  const t = L[lang];
  return `<footer class="footer">
    <div class="wrap">
      <div class="footer__top">
        <div class="footer__brand">MARINO BARBERO<span>${esc(t.footer.tagline)}</span></div>
        <div class="footer__links">
          <a href="${SITE.freshaUrl}" target="_blank" rel="noopener">${esc(t.nav.book)}</a>
          <a href="${whatsappLink(lang)}" target="_blank" rel="noopener">WhatsApp</a>
          <a href="${SITE.instagram}" target="_blank" rel="noopener">Instagram</a>
          <a href="${SITE.googleProfile}" target="_blank" rel="noopener">${esc(t.footer.reviews)}</a>
          <a href="${subPath(lang, "privacy")}">${esc(t.footer.privacy)}</a>
          <!-- The policy promises that consent can be withdrawn, so there has to be a way
               to withdraw it: this clears the stored choice and brings the banner back.
               A button, not a link — it performs an action and goes nowhere. -->
          <button type="button" class="footer__reset" data-consent-reset>${esc(t.footer.cookies)}</button>
        </div>
      </div>
      <div class="footer__bottom">
        <span>© <span data-year>2026</span> ${esc(SITE.brandFull)}. ${esc(t.footer.rights)}</span>
        <span>${esc(street(lang))}, ${esc(SITE.district)}, ${esc(SITE.city)}, Cyprus</span>
        <span>${esc(t.footer.updated)} <time datetime="${BUILD_DATE}">${BUILD_DATE}</time></span>
      </div>
    </div>
  </footer>`;
}

/* ---------- floating booking icon + slide-in panel (hands off to Fresha) ---------- */
// The panel is a <div>, not an <aside>: the HTML spec allows neither role="dialog" nor
// aria-modal on <aside>, and the W3C validator failed the page on both (CI-017 / TE-181).
// The class carries all the styling, so the tag is invisible either way.
function bookingHtml(lang) {
  const t = L[lang], bk = t.booking, s = t.services;
  const stars = "★★★★★";
  const rows = SERVICES.map(
    (sv) => `<li class="bk-svc"><span>${esc(s.names[sv.key])}</span><span class="bk-svc__price">€${sv.price}</span></li>`
  ).join("");
  const calIcon = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><path d="M8.5 14.5l2 2 4-4.5"/></svg>`;
  return `<button class="book-fab" id="bk-open" aria-label="${esc(bk.open)}" aria-controls="bk-panel" aria-expanded="false" title="${esc(bk.open)}">${calIcon}</button>
  <div class="bk-backdrop" data-bk-close></div>
  <div class="bk-panel" id="bk-panel" role="dialog" aria-modal="true" aria-label="${esc(bk.title)}" aria-hidden="true">
    <div class="bk-panel__head">
      <div><p class="eyebrow">${esc(SITE.brand)}</p><h2 class="bk-title">${esc(bk.title)}</h2></div>
      <button class="bk-close" data-bk-close aria-label="${esc(bk.close)}">✕</button>
    </div>
    <p class="bk-intro">${esc(bk.intro)}</p>
    <div class="bk-rating"><span class="bk-rating__stars" aria-hidden="true">${stars}</span><span>${esc(t.proof.rating)} · ${esc(t.proof.count)}</span></div>
    <ul class="bk-list">${rows}</ul>
    <div class="bk-foot">
      <a class="btn bk-go" href="${SITE.freshaUrl}" target="_blank" rel="noopener">${esc(bk.cta)} <span class="arr">→</span></a>
      <span class="bk-via">${esc(bk.via)}</span>
    </div>
  </div>`;
}

/* ---------- cookie consent banner (only when GA4 is on) ---------- */
// Hidden by default (hidden attr); main.js reveals it when no prior choice is stored.
// Buttons carry data-consent-* hooks; main.js wires them to gtag consent update.
function consentHtml(lang) {
  if (!SITE.ga4) return "";
  const c = L[lang].consent;
  return `<div class="consent" id="consent" role="dialog" aria-live="polite" aria-label="${esc(c.aria)}" hidden>
    <p class="consent__text">${esc(c.text)}</p>
    <div class="consent__actions">
      <button type="button" class="btn btn--ghost consent__btn" data-consent-decline>${esc(c.decline)}</button>
      <button type="button" class="btn consent__btn" data-consent-accept>${esc(c.accept)}</button>
    </div>
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
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script>${INLINE_JS_CLASS}</script>${gaHead()}
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
  ${page ? "" : `<link rel="preload" as="image" href="${img("interior-bg.webp")}" fetchpriority="high">`}
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
  <div class="cursor" aria-hidden="true"></div><div class="cursor-dot" aria-hidden="true"></div>
  ${navHtml(lang)}
  <main>
    ${heroHtml(lang)}
    ${proofHtml(lang)}
    ${marqueeHtml(lang)}
    ${servicesHtml(lang)}
    ${productsHtml(lang)}
    ${aboutHtml(lang)}
    ${galleryHtml(lang)}
    ${visitHtml(lang)}
    ${faqHtml(lang)}
  </main>
  ${footerHtml(lang)}
  ${bookingHtml(lang)}
  ${consentHtml(lang)}
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js" defer integrity="sha384-g4NTh/Iv5PPU4xPyhEWqPcwtNXOvdaDI8LLnyYfyNZOjKJeYQyjzQ9X5275eBjpt" crossorigin="anonymous"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js" defer integrity="sha384-Z3REaz79l2IaAZqJsSABtTbhjgOUYyV3p90XNnAPCSHg3EMTz1fouunq9WZRtj3d" crossorigin="anonymous"></script>
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
  const langSwitch = SITE.langs
    .map((lg) => `<a href="${subPath(lg, "privacy")}" hreflang="${hrefLangCode(lg)}" class="${lg === lang ? "active" : ""}" aria-label="${esc(L[lg].label)}">${lg.toUpperCase()}</a>`)
    .join("");
  const sections = pv.sections
    .map((sec) => `<section class="legal__sec">
          <h2>${esc(sec.h)}</h2>
          ${sec.p.map((x) => `<p>${esc(x)}</p>`).join("\n          ")}
        </section>`)
    .join("\n        ");

  return `<!DOCTYPE html>
<html lang="${t.htmlLang}" dir="${t.dir}">
<head>
  ${headHtml(lang, page)}
</head>
<body>
  <header class="nav nav--min nav--solid" aria-label="${esc(SITE.brand)}">
    <a class="nav__logo" href="${basePath(lang)}" aria-label="${esc(SITE.brandFull)}">MARINO<em>BARBERO</em></a>
    <div class="lang" role="group" aria-label="Language">${langSwitch}</div>
  </header>
  <main class="legal">
    <div class="wrap legal__inner">
      ${crumbsHtml(lang, pv.title)}
      <h1>${esc(pv.title)}</h1>
      <p class="legal__updated">${esc(pv.updatedLabel)}: <time datetime="${BUILD_DATE}">${BUILD_DATE}</time></p>
      <p class="legal__intro">${esc(pv.intro)}</p>
      <section class="glance">
        <h2>${esc(pv.glanceLabel)}</h2>
        <dl>
          ${pv.glance.map(([q, a]) => `<dt>${esc(q)}</dt><dd>${esc(a)}</dd>`).join("\n          ")}
        </dl>
      </section>
      ${sections}
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
  const langSwitch = SITE.langs
    .map((lg) => `<a href="${basePath(lg)}" hreflang="${hrefLangCode(lg)}" class="${lg === lang ? "active" : ""}" aria-label="${esc(L[lg].label)}">${lg.toUpperCase()}</a>`)
    .join("");
  return `<!DOCTYPE html>
<html lang="${t.htmlLang}" dir="${t.dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script>${INLINE_JS_CLASS}</script>${gaHead()}
  <title>${esc(nf.title)} · ${esc(SITE.brand)}</title>
  <meta name="robots" content="noindex, follow">
  <meta name="theme-color" content="#100f0d">
  <link rel="stylesheet" href="${ASSETS.css}">
  <link rel="icon" href="${img("favicon.svg")}" type="image/svg+xml">
</head>
<body class="nf-body">
  <header class="nav nav--min" aria-label="${esc(SITE.brand)}">
    <a class="nav__logo" href="${b}" aria-label="${esc(SITE.brandFull)}">MARINO<em>BARBERO</em></a>
    <div class="lang" role="group" aria-label="Language">${langSwitch}</div>
  </header>
  <main class="notfound">
    <div class="wrap notfound__inner">
      <p class="notfound__code" aria-hidden="true">${esc(nf.code)}</p>
      <h1 class="notfound__title">${esc(nf.heading)}</h1>
      <p class="notfound__text">${esc(nf.text)}</p>
      <div class="notfound__actions">
        <a href="${b}" class="btn">${esc(nf.home)} <span class="arr">→</span></a>
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

Two pages, same shop, one in each language. There is no blog, no online store and nothing
ships: the products listed below are sold over the counter, and the only transaction on
this site is an appointment.

## Pages
- [${SITE.brand} — Greek](${SITE.domain}/): ${L.el.meta.description}
- [${SITE.brand} — English](${SITE.domain}/en/): ${L.en.meta.description}
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
  // Inline scripts we must allow-list: the js-class flag, plus the gtag config when on.
  const inlineHashes = [cspHash(INLINE_JS_CLASS), ...(on ? [cspHash(gaInline(SITE.ga4, SITE.ads))] : [])];
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
  const scriptSrc = ["'self'", "https://cdnjs.cloudflare.com", ...(on ? ["https://www.googletagmanager.com"] : []), ...(ads ? ["https://www.googleadservices.com", "https://googleads.g.doubleclick.net"] : []), ...inlineHashes];
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
    "font-src 'self'",
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

  // Hash + write CSS/JS first so the pages can reference the fingerprinted URLs.
  // Minify before hashing: the hash has to describe the bytes that actually ship.
  const cssSrc = fs.readFileSync(path.join(SRC, "css", "styles.css"), "utf8");
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
