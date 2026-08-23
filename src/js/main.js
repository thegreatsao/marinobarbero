/* =========================================================================
   Marino Barbero — motion layer
   Native scroll + IntersectionObserver reveals, GSAP hero + parallax,
   marquee, magnetic buttons, custom cursor, mobile menu.
   GSAP + ScrollTrigger loaded from CDN in <head>. Degrades gracefully.
   ========================================================================= */
(function () {
  "use strict";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGSAP = typeof window.gsap !== "undefined";
  const isDesktop = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  /* ---------- Nav: solid background after scroll ---------- */
  const nav = document.querySelector(".nav");
  const onScroll = () => { if (nav) nav.classList.toggle("scrolled", window.scrollY > 40); };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Anchor links (also close mobile menu) ---------- */
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length < 2) return;
      const el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      document.body.classList.remove("menu-open");
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    });
  });

  /* ---------- Reveal on scroll ---------- */
  const revealEls = document.querySelectorAll(".reveal, [data-stagger], .img-reveal");
  if (reduce) {
    revealEls.forEach((el) => el.classList.add("in"));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          if (el.hasAttribute("data-stagger")) {
            [...el.children].forEach((child, i) => { child.style.transitionDelay = i * 90 + "ms"; });
          }
          el.classList.add("in");
          io.unobserve(el);
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" }
    );
    revealEls.forEach((el) => io.observe(el));
  }

  /* ---------- Hero scene + parallax ---------- */
  if (hasGSAP && !reduce) {
    const { gsap } = window;
    if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);

    // Intro reveal — only when the tab is visible at load. A background tab (or a
    // preview with a throttled rAF ticker) freezes GSAP mid-tween; guarding here
    // means the hero content is never left stuck at opacity:0 (CSS shows it by default).
    if (!document.hidden) {
      const lines = document.querySelectorAll(".hero__title .line span");
      if (lines.length) {
        gsap.set(lines, { yPercent: 115 });
        gsap.to(lines, { yPercent: 0, duration: 1.2, stagger: 0.12, ease: "expo.out", delay: 0.2 });
      }
      gsap.from(".hero .eyebrow, .hero__sub, .hero__actions", {
        y: 26, opacity: 0, duration: 1, stagger: 0.12, ease: "power3.out", delay: 0.55,
      });
    }

    if (window.ScrollTrigger) {
      const heroImg = document.querySelector(".hero__media img");
      if (heroImg) {
        gsap.to(heroImg, {
          yPercent: 12, ease: "none",
          scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
        });
      }
      document.querySelectorAll("[data-parallax]").forEach((el) => {
        const amt = parseFloat(el.getAttribute("data-parallax")) || 8;
        gsap.to(el, {
          yPercent: -amt, ease: "none",
          scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true },
        });
      });
    }
  }

  /* ---------- Marquee (seamless loop) ---------- */
  // Below 860px the CSS turns the strip into a wrapped static row — a scrolling ticker is
  // overflow:hidden by definition, and that is what the mobile audit reads as clipped text
  // (MB-108). So the loop only runs at the widths where the strip actually scrolls, and it
  // starts and stops on the media query rather than being decided once at load: a window
  // dragged across 861px (or a tablet rotated) has to end up in the right state, and a
  // one-off check at load time gets that wrong in both directions.
  const wide = window.matchMedia("(min-width: 861px)");
  document.querySelectorAll(".marquee").forEach((m) => {
    const track = m.querySelector(".marquee__track");
    if (!track || reduce) return;
    // Both copies of the strip come from build.js, not from innerHTML here: duplicating at
    // runtime made the rendered DOM differ from the served HTML (MB-105). The half-width
    // maths is unchanged — there are still exactly two copies.
    let x = 0;
    let raf = null;
    let paused = false;
    const speed = 0.4;
    let half = track.scrollWidth / 2;
    const tick = () => {
      if (!paused) {
        x -= speed;
        if (-x >= half) x = 0;
        track.style.transform = `translate3d(${x}px,0,0)`;
      }
      raf = requestAnimationFrame(tick);
    };
    const start = () => { if (raf === null) { half = track.scrollWidth / 2; raf = requestAnimationFrame(tick); } };
    const stop = () => {
      if (raf === null) return;
      cancelAnimationFrame(raf);
      raf = null;
      x = 0;
      track.style.transform = "";  // hand the strip back to the stylesheet
    };
    m.addEventListener("mouseenter", () => (paused = true));
    m.addEventListener("mouseleave", () => (paused = false));
    window.addEventListener("resize", () => { if (raf !== null) half = track.scrollWidth / 2; });
    wide.addEventListener("change", (e) => (e.matches ? start() : stop()));
    if (wide.matches) start();
  });

  /* ---------- Magnetic buttons (desktop) ---------- */
  if (isDesktop && !reduce && hasGSAP) {
    const { gsap } = window;
    document.querySelectorAll("[data-magnetic]").forEach((btn) => {
      btn.addEventListener("mousemove", (e) => {
        const r = btn.getBoundingClientRect();
        const mx = e.clientX - (r.left + r.width / 2);
        const my = e.clientY - (r.top + r.height / 2);
        gsap.to(btn, { x: mx * 0.3, y: my * 0.4, duration: 0.5, ease: "power3.out" });
      });
      btn.addEventListener("mouseleave", () => {
        gsap.to(btn, { x: 0, y: 0, duration: 0.6, ease: "elastic.out(1, 0.4)" });
      });
    });
  }

  /* ---------- Custom cursor (desktop) ---------- */
  if (isDesktop && !reduce) {
    const ring = document.querySelector(".cursor");
    const dot = document.querySelector(".cursor-dot");
    if (ring && dot) {
      let rx = 0, ry = 0, dx = 0, dy = 0;
      window.addEventListener("mousemove", (e) => {
        dx = e.clientX; dy = e.clientY;
        dot.style.transform = `translate(${dx}px, ${dy}px) translate(-50%, -50%)`;
      });
      const follow = () => {
        rx += (dx - rx) * 0.18; ry += (dy - ry) * 0.18;
        ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
        requestAnimationFrame(follow);
      };
      follow();
      document.querySelectorAll("a, button, [data-magnetic], .gal__cell").forEach((el) => {
        el.addEventListener("mouseenter", () => document.body.classList.add("cursor-active"));
        el.addEventListener("mouseleave", () => document.body.classList.remove("cursor-active"));
      });
    }
  }

  /* ---------- Mobile menu toggle ---------- */
  const burger = document.querySelector(".nav__burger");
  if (burger) burger.addEventListener("click", () => document.body.classList.toggle("menu-open"));

  /* ---------- Refresh ScrollTrigger after full load ---------- */
  window.addEventListener("load", () => {
    if (hasGSAP && window.ScrollTrigger) {
      if (window.ScrollTrigger.clearScrollMemory) window.ScrollTrigger.clearScrollMemory("manual");
      window.scrollTo(0, 0);
      requestAnimationFrame(() => requestAnimationFrame(() => window.ScrollTrigger.refresh()));
    }
  });
  let _rt;
  window.addEventListener("resize", () => {
    clearTimeout(_rt);
    _rt = setTimeout(() => { if (hasGSAP && window.ScrollTrigger) window.ScrollTrigger.refresh(); }, 200);
  });

  /* ---------- Booking panel (floating icon → slide-in overlay → Fresha) ---------- */
  const bkOpen = document.getElementById("bk-open");
  const bkPanel = document.getElementById("bk-panel");
  if (bkOpen && bkPanel) {
    const open = () => {
      document.body.classList.add("bk-on");
      bkPanel.setAttribute("aria-hidden", "false");
      bkOpen.setAttribute("aria-expanded", "true");
      const first = bkPanel.querySelector(".bk-close");
      if (first) first.focus();
    };
    const close = () => {
      document.body.classList.remove("bk-on");
      bkPanel.setAttribute("aria-hidden", "true");
      bkOpen.setAttribute("aria-expanded", "false");
      bkOpen.focus();
    };
    bkOpen.addEventListener("click", open);
    document.querySelectorAll("[data-bk-close]").forEach((el) => el.addEventListener("click", close));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && document.body.classList.contains("bk-on")) close(); });
  }

  /* ---------- Cookie consent (Google Consent Mode v2) ---------- */
  // gtag defaults every category to "denied" (set inline in <head>). Show the banner
  // only when the visitor hasn't chosen yet; "Accept" flips consent to granted, "Decline"
  // keeps it denied. Choice is persisted so the banner stays dismissed on return visits.
  //
  // All four categories are granted together, matching what the banner text asks for
  // (analytics AND ad performance, in both languages). Granting analytics_storage alone
  // would leave Google Ads unable to tie a book_click back to the ad click that paid for
  // it — and the conversion-modelling that is supposed to cover that gap needs far more
  // ad clicks per week than this budget will ever produce.
  const consent = document.getElementById("consent");
  if (consent) {
    const KEY = "mb-consent";
    const GRANTS = {
      analytics_storage: "granted",
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
    };
    let stored = null;
    try { stored = localStorage.getItem(KEY); } catch (e) {}
    if (stored !== "granted" && stored !== "denied") consent.hidden = false;
    const decide = (val) => {
      try { localStorage.setItem(KEY, val); } catch (e) {}
      if (val === "granted" && typeof window.gtag === "function") {
        window.gtag("consent", "update", GRANTS);
      }
      consent.hidden = true;
    };
    const accept = consent.querySelector("[data-consent-accept]");
    const decline = consent.querySelector("[data-consent-decline]");
    if (accept) accept.addEventListener("click", () => decide("granted"));
    if (decline) decline.addEventListener("click", () => decide("denied"));

    // "Cookie settings" in the footer: forget the stored answer and ask again. The privacy
    // policy states consent can be withdrawn at any time, and this is that "any time" —
    // without it the banner never comes back once a choice is made.
    //
    // Consent is pushed back to denied immediately rather than on the next answer: the
    // moment someone reaches for this control, the previous grant should stop applying.
    document.querySelectorAll("[data-consent-reset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        try { localStorage.removeItem(KEY); } catch (e) {}
        if (typeof window.gtag === "function") {
          window.gtag("consent", "update", {
            analytics_storage: "denied", ad_storage: "denied",
            ad_user_data: "denied", ad_personalization: "denied",
          });
        }
        consent.hidden = false;
        consent.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
      });
    });
  }

  /* ---------- Outbound conversion events ---------- */
  // The booking finishes on fresha.com and the shop's phone — neither is a domain we can
  // tag. So the last thing measurable on our side is the hand-off click, and that is what
  // both GA4 and Google Ads count as a conversion here.
  //
  // Delegated on document rather than bound per link: the Fresha CTA appears in the nav,
  // hero, services, visit, footer, the slide-in booking panel and the 404 page, and the
  // panel's markup is regenerated by build.js. One listener survives all of that.
  //
  // Event names only, no send_to — the Google Ads conversion actions are created by
  // importing these GA4 events, so no conversion label has to be hardcoded (and no code
  // change is needed when the Ads account is finally set up). The AW- config emitted in
  // <head> is still what enables the conversion linker and remarketing.
  const CONVERSIONS = [
    { match: (h) => h.indexOf("fresha.com") > -1, event: "book_click" },
    { match: (h) => h.indexOf("wa.me") > -1, event: "whatsapp_click" },
    { match: (h) => h.indexOf("tel:") === 0, event: "call_click" },
  ];
  document.addEventListener("click", (e) => {
    if (typeof window.gtag !== "function") return;
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    const href = a.getAttribute("href") || "";
    const hit = CONVERSIONS.find((c) => c.match(href));
    // Every one of these links is target="_blank" or a tel: hand-off, so the current
    // document is never torn down — the hit has time to leave without transport_type.
    if (hit) window.gtag("event", hit.event, { link_url: a.href });
  });

  /* ---------- Footer year ---------- */
  const y = document.querySelector("[data-year]");
  if (y) y.textContent = new Date().getFullYear();
})();
