/* =========================================================================
   Marino Barbero — behaviour layer

   No libraries. GSAP and ScrollTrigger were dropped in the 2026-08 redesign:
   the two things they were doing here — a hero line reveal and a parallax
   scrub — are now CSS (clip-path animation, no scroll coupling), and 70KB of
   CDN JavaScript on a paid-traffic landing page with Quality Score 3 was
   paying for effects the brief asked us to remove anyway. Dropping them also
   takes cdnjs.cloudflare.com out of script-src.

   Everything below is progressive: the page is fully readable and bookable
   with this file blocked. Nothing here controls whether content is visible —
   the service rows ship as real links, and the booking sheet is an enhancement
   over those links, never a gate in front of them.
   ========================================================================= */
(function () {
  "use strict";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Anchor links ---------- */
  // Native smooth scroll does the work (scroll-behavior in the stylesheet); this
  // only exists so scroll-margin-top is respected consistently and so a hash
  // never lands the target under the sticky nav.
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length < 2) return;
      const el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    });
  });

  /* Reveals are pure CSS (animation-timeline: view()) and the hero line is a
     load-time CSS animation — see styles.css. Deliberately not here: nothing
     about whether the page is legible should depend on this file loading. */

  /* ---------- Video loops ----------
     Poster-first, in-view only, paused out of view, and never fetched at all on
     a saved-data or 2g connection or under reduced motion. `preload="none"` in
     the markup means nothing is requested until play() is called, so the guard
     below is the whole opt-out: no play(), no bytes. */
  //
  // observeLoops() is exposed to the rail below, which clones slides for the infinite
  // scroll: a cloned <video> is a new element the original observer never saw, and an
  // unobserved clone sits frozen on its poster next to a moving original.
  let observeLoops = () => {};
  {
    const conn = navigator.connection || {};
    const cheap = conn.saveData === true || conn.effectiveType === "2g" || conn.effectiveType === "slow-2g";
    if (!reduce && !cheap) {
      const vio = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const v = entry.target;
            if (entry.isIntersecting) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
            else v.pause();
          });
        },
        { threshold: 0.3 }
      );
      observeLoops = (root) => (root || document).querySelectorAll("video[data-loop]").forEach((v) => vio.observe(v));
      observeLoops(document);
    }
  }

  /* ---------- Product rail ----------
     The rail is a scroll-snap flex row and works with this file blocked: it swipes, it
     scrolls, and it takes arrow keys once focused. Everything below is on top of that.

     Infinite by cloning, not by animating: the six real slides are flanked by a copy of
     the whole set on each side, and whenever the scroll position drifts into a copy it
     is snapped back by exactly one set width. The jump is invisible because the pixels
     under it are identical, and because it happens with snapping switched off — Safari
     and Chrome will otherwise re-snap mid-jump and land a card off-centre.

     The copies are decoration: aria-hidden, and every focusable thing inside them is
     taken out of the tab order, so a keyboard user meets each product exactly once and
     a screen reader is not read the same shelf three times.

     Cloning is skipped under reduced motion — an endless rail is motion the user asked
     us not to produce — and the rail then keeps its honest ends. */
  const prodRail = document.getElementById("prod-rail");
  const prodTrack = prodRail && prodRail.querySelector(".prod-rail");
  if (prodTrack && prodTrack.querySelector(".prod-slide")) {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const originals = [...prodTrack.children];
    const period = () => {
      const gap = parseFloat(getComputedStyle(prodTrack).columnGap) || 0;
      return originals.reduce((sum, el) => sum + el.getBoundingClientRect().width + gap, 0);
    };
    const step = () => {
      const gap = parseFloat(getComputedStyle(prodTrack).columnGap) || 0;
      return originals[0].getBoundingClientRect().width + gap;
    };

    let looping = false;
    if (!reduce) {
      const copy = (where) => {
        const frag = document.createDocumentFragment();
        originals.forEach((el) => {
          const c = el.cloneNode(true);
          c.setAttribute("aria-hidden", "true");
          c.classList.add("prod-slide--clone");
          c.querySelectorAll("a, button, video").forEach((n) => n.setAttribute("tabindex", "-1"));
          frag.appendChild(c);
        });
        where === "before" ? prodTrack.prepend(frag) : prodTrack.appendChild(frag);
      };
      copy("before");
      copy("after");
      observeLoops(prodTrack);
      looping = true;

      // Park on the real set. Snapping is off for the jump and restored after, otherwise
      // the browser animates toward a snap point and the seam becomes visible.
      const jumpTo = (x) => {
        const snap = prodTrack.style.scrollSnapType;
        prodTrack.style.scrollSnapType = "none";
        prodTrack.scrollLeft = x;
        prodTrack.style.scrollSnapType = snap || "";
      };
      requestAnimationFrame(() => jumpTo(period()));

      let ticking = false;
      prodTrack.addEventListener(
        "scroll",
        () => {
          if (ticking) return;
          ticking = true;
          requestAnimationFrame(() => {
            const p = period();
            // Half a set of slack on each side: far enough that the seam is never on
            // screen, close enough that a fast flick cannot outrun it.
            if (prodTrack.scrollLeft < p * 0.5) jumpTo(prodTrack.scrollLeft + p);
            else if (prodTrack.scrollLeft > p * 1.5) jumpTo(prodTrack.scrollLeft - p);
            ticking = false;
          });
        },
        { passive: true }
      );
      window.addEventListener("resize", () => jumpTo(period()));
    }

    // Arrows exist only where a pointer can use them — a touch device swipes, and two
    // more tap targets there buy nothing.
    if (fine) {
      const arrow = (dir, label) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "prod-nav prod-nav--" + dir;
        b.setAttribute("aria-label", label);
        b.innerHTML =
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' +
          (dir === "prev" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7") +
          '" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        prodRail.appendChild(b);
        return b;
      };
      const prev = arrow("prev", prodRail.dataset.prev || "Previous");
      const next = arrow("next", prodRail.dataset.next || "Next");
      const go = (sign) => prodTrack.scrollBy({ left: sign * step(), behavior: reduce ? "auto" : "smooth" });
      prev.addEventListener("click", () => go(-1));
      next.addEventListener("click", () => go(1));

      // A looping rail has no ends, so neither arrow ever disables. Without the clones
      // (reduced motion) the ends are real again and the arrows say so.
      if (!looping) {
        const sync = () => {
          const max = prodTrack.scrollWidth - prodTrack.clientWidth;
          prev.disabled = prodTrack.scrollLeft <= step() * 0.5;
          next.disabled = prodTrack.scrollLeft >= max - 8;
        };
        prodTrack.addEventListener("scroll", sync, { passive: true });
        window.addEventListener("resize", sync);
        sync();
      }
    }
  }

  /* ---------- Service picker → sticky bar → booking sheet ----------
     The structural change of this redesign. The customer used to choose twice:
     once mentally on our price table, then again for real in Fresha's generic
     menu. Now the choice happens here, and the hand-off carries it.

     Rows arrive as <a href="…fresha…"> so that a JS-less visitor still gets the
     menu. On init each one is replaced by a real <button aria-pressed> — the tag
     is swapped rather than the role patched onto the anchor, because a link that
     toggles a selection is neither a link nor a button to assistive tech, and
     aria-pressed on an <a> is not valid. Same box, same bytes, no layout shift. */
  const picker = document.getElementById("picker");
  const bar = document.getElementById("bar");
  const sheet = document.getElementById("sheet");

  if (picker) {
    // i18n and the Fresha base URL travel on the container, so nothing that a
    // translator owns is hardcoded in this file. T.many is the "{n} services"
    // pattern, used once more than one group is held.
    const T = picker.dataset;
    const rows = [];

    picker.querySelectorAll("a.svc").forEach((a) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = a.className;
      b.innerHTML = a.innerHTML;
      Object.keys(a.dataset).forEach((k) => { b.dataset[k] = a.dataset[k]; });
      b.setAttribute("aria-pressed", "false");
      a.replaceWith(b);
      rows.push(b);
    });

    const totalK = document.getElementById("svc-total-k");
    const totalV = document.getElementById("svc-total-v");
    const barTitle = document.getElementById("bar-title");
    const barSub = document.getElementById("bar-sub");
    const shSvc = document.getElementById("sheet-svc");
    const shDur = document.getElementById("sheet-dur");
    const shTotal = document.getElementById("sheet-total");
    const shGo = document.getElementById("sheet-go");

    // One service per group, any number of groups — so at most one haircut, one
    // beard-or-wash and one treatment, which is what a single visit to the chair
    // actually looks like. Picking a second row in a group replaces the first
    // rather than adding to it; picking the row that is already held lets it go.
    //
    // Keyed by data-cat rather than by walking the DOM, so the rule survives any
    // change to how the groups are laid out.
    const held = Object.create(null);

    // Group order, taken from the markup, so the bar and the sheet list services
    // in the order the page shows them rather than the order they were tapped.
    const order = rows
      .map((r) => r.dataset.cat)
      .filter((cat, i, all) => all.indexOf(cat) === i);
    const chosen = () => order.map((cat) => held[cat]).filter(Boolean);

    const render = () => {
      const list = chosen();
      const armed = list.length > 0;
      document.body.classList.toggle("sheet-armed", armed);

      const dur = list.reduce((n, r) => n + Number(r.dataset.dur), 0);
      const price = list.reduce((n, r) => n + Number(r.dataset.price), 0);
      const names = list.map((r) => r.dataset.name);
      // One service is named; several are counted, because "Haircut, Beard, Face
      // mask · 60 min · €40" does not fit the bar in any language.
      const label = list.length === 1 ? names[0] : T.many.replace("{n}", list.length);
      const durText = dur + " " + T.unit;
      const priceText = "€" + price;

      if (totalK) totalK.textContent = armed ? label + " · " + durText : T.empty;
      if (totalV) totalV.textContent = armed ? priceText : "—";

      if (barTitle) barTitle.textContent = armed ? label + " · " + durText + " · " + priceText : T.open;
      if (barSub) barSub.textContent = armed ? T.sub : T.via;

      // The sheet has room to name every service even when the bar does not.
      if (shSvc) shSvc.textContent = armed ? names.join(", ") : T.any;
      if (shDur) shDur.textContent = armed ? durText : T.choose;
      if (shTotal) shTotal.textContent = armed ? priceText : T.from;
      // The ticked services travel with the click. Fresha ignores query keys it
      // does not know, so today this carries the choice into our own analytics
      // rather than pre-filling their menu — the value is the same URL either
      // way, and it is ready the day Fresha accepts a service parameter.
      if (shGo) {
        shGo.href = armed
          ? T.fresha + "?service=" + encodeURIComponent(list.map((r) => r.dataset.svc).join(","))
          : T.fresha;
      }
    };

    rows.forEach((row) => {
      row.addEventListener("click", () => {
        const cat = row.dataset.cat;
        const wasHeld = held[cat] === row;
        // Clear the group, then take the row unless it was the one already held.
        rows.forEach((r) => { if (r.dataset.cat === cat) r.setAttribute("aria-pressed", "false"); });
        if (wasHeld) delete held[cat];
        else { held[cat] = row; row.setAttribute("aria-pressed", "true"); }
        render();
      });
    });

    render();
  }

  /* ---------- Sticky bar: enters once, when the hero leaves ----------
     Retires the old floating fab and its pulse. 200ms opacity + 8px rise, and
     then it never animates again. */
  const hero = document.querySelector(".hero");
  if (bar && hero) {
    const bio = new IntersectionObserver(
      (entries) => { document.body.classList.toggle("bar-on", !entries[0].isIntersecting); },
      { threshold: 0, rootMargin: "-40% 0px 0px 0px" }
    );
    bio.observe(hero);
  } else if (bar) {
    document.body.classList.add("bar-on");
  }

  /* ---------- Section rail: which section am I in ----------
     One observer over the sections, and the rail marks the last one whose top
     has passed the reading line. Reading line rather than "is intersecting":
     two sections are on screen at once for most of a scroll, and an
     is-intersecting test flickers between them. A line at 45% of the viewport
     changes the answer exactly once per boundary.

     aria-current is the whole state — the stylesheet reads it, and a screen
     reader announces it, from the same attribute. */
  const rail = document.getElementById("rail");
  if (rail) {
    const links = [].slice.call(rail.querySelectorAll("a[href^='#']"));
    const targets = links
      .map((a) => ({ link: a, el: document.querySelector(a.getAttribute("href")) }))
      .filter((t) => t.el);

    if (targets.length) {
      let current = null;
      const mark = () => {
        const line = window.innerHeight * 0.45;
        let found = null;
        for (let i = 0; i < targets.length; i++) {
          if (targets[i].el.getBoundingClientRect().top <= line) found = targets[i].link;
        }
        if (found === current) return;
        if (current) current.removeAttribute("aria-current");
        if (found) found.setAttribute("aria-current", "true");
        current = found;
      };

      // rAF-throttled: this runs on every scroll event and must not be the
      // reason the page misses a frame.
      let queued = false;
      const onScroll = () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; mark(); });
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
      mark();
    }
  }

  /* ---------- Booking sheet ---------- */
  if (sheet) {
    let lastFocus = null;
    const closeBtn = sheet.querySelector(".sheet__close");

    const open = () => {
      lastFocus = document.activeElement;
      document.body.classList.add("sheet-on");
      sheet.removeAttribute("aria-hidden");
      // The panel is visibility:hidden until the class lands, and nothing inside a
      // visibility:hidden subtree can take focus — so focus() one frame later,
      // once the style has actually been recalculated. Calling it inline looks
      // right and silently does nothing.
      requestAnimationFrame(() => { if (closeBtn) closeBtn.focus(); });
    };
    const close = () => {
      document.body.classList.remove("sheet-on");
      sheet.setAttribute("aria-hidden", "true");
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    };

    document.querySelectorAll("[data-sheet-open]").forEach((el) => el.addEventListener("click", open));
    sheet.querySelectorAll("[data-sheet-close]").forEach((el) => el.addEventListener("click", close));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && document.body.classList.contains("sheet-on")) close();
    });
    // The hand-off leaves in a new tab, so the sheet is dismissed behind it
    // rather than left open over the page the visitor comes back to.
    sheet.querySelectorAll("a[href]").forEach((a) => a.addEventListener("click", () => setTimeout(close, 80)));
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
    // The body flag lets the hero reserve room for the banner: the primary CTA
    // must not sit underneath a notice that appears on first load.
    const show = (on) => {
      consent.hidden = !on;
      document.body.classList.toggle("consent-on", on);
    };
    if (stored !== "granted" && stored !== "denied") show(true);
    const decide = (val) => {
      try { localStorage.setItem(KEY, val); } catch (e) {}
      if (val === "granted" && typeof window.gtag === "function") {
        window.gtag("consent", "update", GRANTS);
      }
      show(false);
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
        show(true);
        consent.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
      });
    });
  }

  /* ---------- Outbound conversion events ---------- */
  // The booking finishes on fresha.com and the shop's phone — neither is a domain we can
  // tag. So the last thing measurable on our side is the hand-off click, and that is what
  // both GA4 and Google Ads count as a conversion here.
  //
  // Delegated on document rather than bound per link: the Fresha CTA appears in the hero,
  // the sticky bar, the booking sheet, the service rows before JS upgrades them, the
  // footer and the 404 page. One listener survives all of that.
  //
  // Event names only, no send_to — the Google Ads conversion actions are created by
  // importing these GA4 events, so no conversion label has to be hardcoded (and no code
  // change is needed when the Ads account is finally set up). The AW- config emitted in
  // <head> is still what enables the conversion linker and remarketing.
  //
  // book_click now carries the picked service where there is one. It is the only place the
  // page can answer "did the picker actually change what people book", which is the whole
  // premise of this redesign.
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
    if (!hit) return;
    const params = { link_url: a.href };
    if (hit.event === "book_click") {
      const picked = [].slice.call(document.querySelectorAll('#picker .svc[aria-pressed="true"]'));
      params.service = picked.length ? picked.map(function (r) { return r.dataset.svc; }).join(",") : "none";
    }
    // Every one of these links is target="_blank" or a tel: hand-off, so the current
    // document is never torn down — the hit has time to leave without transport_type.
    window.gtag("event", hit.event, params);
  });

  /* ---------- Footer year ---------- */
  const y = document.querySelector("[data-year]");
  if (y) y.textContent = new Date().getFullYear();
})();
