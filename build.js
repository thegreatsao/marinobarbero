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
const { SITE, HOURS, SERVICES, L } = require("./content/content.js");

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
// GA4 bootstrap with Consent Mode v2. One line, no trailing newline, so its hash is
// stable. Consent DEFAULTS to denied (no cookies) before gtag runs — GDPR/ePrivacy for
// EU/Cyprus visitors; the banner (main.js) flips analytics_storage to granted on accept,
// and a prior "granted" choice in localStorage is restored here before the first hit.
const gaInline = (id) => `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});try{if(localStorage.getItem('mb-consent')==='granted')gtag('consent','update',{analytics_storage:'granted'})}catch(e){}gtag('js',new Date());gtag('config','${id}');`;

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
const hrefLangCode = (lang) => L[lang].htmlLang;

// Booking / contact links
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
    image: SITE.domain + img("interior.jpg"),
    description: t.meta.description,
    telephone: SITE.phone,
    priceRange: "€€",
    currenciesAccepted: "EUR",
    paymentAccepted: "Cash, Credit Card",
    address: {
      "@type": "PostalAddress",
      streetAddress: SITE.street,
      addressLocality: SITE.city,
      postalCode: SITE.postal,
      addressRegion: SITE.region,
      addressCountry: SITE.country,
    },
    geo: { "@type": "GeoCoordinates", latitude: SITE.geo.lat, longitude: SITE.geo.lng },
    areaServed: { "@type": "City", name: SITE.city },
    hasMap: SITE.googleProfile,
    sameAs: [SITE.instagram, SITE.googleProfile],
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
    <div class="hero__media"><img src="${img("interior-bg.jpg")}" alt="${esc(L[lang].meta.ogAlt)}" width="1600" height="1067" fetchpriority="high"></div>
    <div class="hero__scrim" aria-hidden="true"></div>
    <div class="wrap hero__inner">
      <p class="eyebrow">${esc(t.eyebrow)}</p>
      <h1 class="hero__title">${lines}</h1>
      <p class="hero__sub">${esc(t.subtitle)}</p>
      <div class="hero__actions">
        <a href="${SITE.freshaUrl}" class="btn" target="_blank" rel="noopener" data-magnetic>${esc(t.book)} <span class="arr">→</span></a>
        <a href="${whatsappLink(lang)}" class="btn btn--ghost" target="_blank" rel="noopener">${esc(t.whatsapp)}</a>
      </div>
    </div>
    <div class="scroll-cue" aria-hidden="true"><span>${esc(t.scroll)}</span><span class="bar"></span></div>
  </section>`;
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
  return `<div class="marquee" aria-hidden="true"><div class="marquee__track">${items}</div></div>`;
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

function aboutHtml(lang) {
  const t = L[lang].about;
  return `<section class="about" id="about">
    <div class="wrap about__grid">
      <div class="about__media img-reveal" data-parallax="6"><img src="${img("haircut-fade.jpg")}" alt="${esc(L[lang].gallery.alt)}" width="720" height="960" loading="lazy"></div>
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
  const imgs = [
    { src: img("interior.jpg"), w: 1200, h: 680 },
    { src: img("haircut-fade.jpg"), w: 720, h: 960 },
    { src: img("interior-bg.jpg"), w: 1200, h: 800 },
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

function visitHtml(lang) {
  const t = L[lang].visit;
  const rows = t.hours.map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join("");
  const mapQ = encodeURIComponent(`${SITE.street}, ${SITE.postal} ${SITE.city}, Cyprus`);
  const addr = lang === "el" ? SITE.streetEl : SITE.street;
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
        </div>
      </div>
      <div class="footer__bottom">
        <span>© <span data-year>2026</span> ${esc(SITE.brandFull)}. ${esc(t.footer.rights)}</span>
        <span>${esc(lang === "el" ? SITE.streetEl : SITE.street)}, ${esc(SITE.district)}, ${esc(SITE.city)}, Cyprus</span>
      </div>
    </div>
  </footer>`;
}

/* ---------- floating booking icon + slide-in panel (hands off to Fresha) ---------- */
function bookingHtml(lang) {
  const t = L[lang], bk = t.booking, s = t.services;
  const stars = "★★★★★";
  const rows = SERVICES.map(
    (sv) => `<li class="bk-svc"><span>${esc(s.names[sv.key])}</span><span class="bk-svc__price">€${sv.price}</span></li>`
  ).join("");
  const calIcon = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><path d="M8.5 14.5l2 2 4-4.5"/></svg>`;
  return `<button class="book-fab" id="bk-open" aria-label="${esc(bk.open)}" aria-controls="bk-panel" aria-expanded="false" title="${esc(bk.open)}">${calIcon}</button>
  <div class="bk-backdrop" data-bk-close></div>
  <aside class="bk-panel" id="bk-panel" role="dialog" aria-modal="true" aria-label="${esc(bk.title)}" aria-hidden="true">
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
  </aside>`;
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

/* ---------- Google Analytics 4 (gtag.js) ---------- */
// Emits nothing when SITE.ga4 is empty, so the site ships analytics-free until an
// ID is configured. Placed early in <head> per Google's install guidance. The async
// loader comes from googletagmanager.com; the config runs inline (CSP-hashed).
function gaHead() {
  if (!SITE.ga4) return "";
  return `
  <script async src="https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(SITE.ga4)}"></script>
  <script>${gaInline(SITE.ga4)}</script>`;
}

/* ---------- <head> with full SEO ---------- */
function headHtml(lang) {
  const t = L[lang];
  const alternates = SITE.langs
    .map((lg) => `<link rel="alternate" hreflang="${hrefLangCode(lg)}" href="${pageUrl(lg)}">`)
    .join("\n  ");
  return `<meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script>${INLINE_JS_CLASS}</script>${gaHead()}
  <title>${esc(t.meta.title)}</title>
  <meta name="description" content="${esc(t.meta.description)}">
  <link rel="canonical" href="${pageUrl(lang)}">
  ${alternates}
  <link rel="alternate" hreflang="x-default" href="${pageUrl(SITE.langs[0])}">
  <meta name="theme-color" content="#100f0d">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta name="author" content="${esc(SITE.brandFull)}">
  <meta name="geo.region" content="CY-05">
  <meta name="geo.placename" content="Kato Paphos">
  <meta name="geo.position" content="${SITE.geo.lat};${SITE.geo.lng}">
  <!-- Open Graph -->
  <meta property="og:type" content="business.business">
  <meta property="og:site_name" content="${esc(SITE.brandFull)}">
  <meta property="og:locale" content="${t.ogLocale}">
  <meta property="og:title" content="${esc(t.meta.title)}">
  <meta property="og:description" content="${esc(t.meta.description)}">
  <meta property="og:url" content="${pageUrl(lang)}">
  <meta property="og:image" content="${SITE.domain}${img("interior.jpg")}">
  <meta property="og:image:alt" content="${esc(t.meta.ogAlt)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(t.meta.title)}">
  <meta name="twitter:description" content="${esc(t.meta.description)}">
  <meta name="twitter:image" content="${SITE.domain}${img("interior.jpg")}">
  <link rel="preload" as="image" href="${img("interior-bg.jpg")}" fetchpriority="high">
  <link rel="stylesheet" href="${ASSETS.css}">
  <link rel="icon" href="${img("favicon.svg")}" type="image/svg+xml">
  ${jsonLd(lang)}`;
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
    ${aboutHtml(lang)}
    ${galleryHtml(lang)}
    ${visitHtml(lang)}
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

/* ---------- custom 404 page (one per language) ---------- */
// Fully static and self-contained: no main.js, no GA, no reveal classes — so it renders
// correctly with zero JS (a 404 route can be hit before/without the bundle). Reuses the
// hashed stylesheet for on-brand styling. Netlify serves the nearest 404.html (root for
// "/…", /en/404.html for "/en/…") with a real 404 status. Marked noindex.
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
  <script>${INLINE_JS_CLASS}</script>
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

/* ---------- SEO + hosting files ---------- */
function sitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = SITE.langs
    .map((lg) => {
      const alts = SITE.langs
        .map((a) => `    <xhtml:link rel="alternate" hreflang="${hrefLangCode(a)}" href="${pageUrl(a)}"/>`)
        .join("\n");
      return `  <url>
    <loc>${pageUrl(lg)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${lg === SITE.langs[0] ? "1.0" : "0.8"}</priority>
${alts}
    <xhtml:link rel="alternate" hreflang="x-default" href="${pageUrl(SITE.langs[0])}"/>
  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;
}

const robots = `User-agent: *
Allow: /

Sitemap: ${SITE.domain}/sitemap.xml
`;

// CSP is built here so the inline-script hashes always match the bytes emitted above,
// and so the Google Analytics origins are added only when SITE.ga4 is set.
function headersFile() {
  const on = Boolean(SITE.ga4);
  // Inline scripts we must allow-list: the js-class flag, plus the GA4 config when on.
  const inlineHashes = [cspHash(INLINE_JS_CLASS), ...(on ? [cspHash(gaInline(SITE.ga4))] : [])];
  const scriptSrc = ["'self'", "https://cdnjs.cloudflare.com", ...(on ? ["https://www.googletagmanager.com"] : []), ...inlineHashes];
  // GA4 sends hits (and loads gtag) from these origins; Google may route via any of them.
  const gaConnect = ["https://*.google-analytics.com", "https://*.googletagmanager.com", "https://*.analytics.google.com"];
  const connectSrc = ["'self'", ...(on ? gaConnect : [])];
  const imgSrc = ["'self'", "data:", ...(on ? ["https://*.google-analytics.com", "https://*.googletagmanager.com"] : [])];
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
  const cssBuf = fs.readFileSync(path.join(SRC, "css", "styles.css"));
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
  ["interior-bg.jpg", "interior.jpg", "haircut-fade.jpg"].forEach((name) => {
    if (IMG[name]) return;
    const buf = Buffer.from(placeholder("Marino Barbero · Kato Paphos", 1600, 1067));
    const hashed = `${name.replace(/\.jpg$/, "")}.${hash8(buf)}.svg`;
    write(path.join(imgOut, hashed), buf);
    IMG[name] = `/assets/img/${hashed}`;
  });

  for (const lang of SITE.langs) {
    const home = lang === SITE.langs[0];
    write(home ? path.join(DIST, "index.html") : path.join(DIST, lang, "index.html"), renderPage(lang));
    // Per-language custom 404 — Netlify serves the nearest (root for "/…", /en/404.html
    // for "/en/…") with a real 404 status.
    write(home ? path.join(DIST, "404.html") : path.join(DIST, lang, "404.html"), notFoundHtml(lang));
  }

  write(path.join(DIST, "sitemap.xml"), sitemap());
  write(path.join(DIST, "robots.txt"), robots);
  write(path.join(DIST, "_headers"), headersFile());

  console.log("✓ Built dist/ for languages:", SITE.langs.join(", "));
}

build();
