// Marino Barbero — The Barber Shop · content model (EN primary, EL; RU can be added later)
// Single source of truth. build.js renders one template per language.
// Prices/durations flagged (CONFIRM) in the business brief — verify before final launch.

const SITE = {
  // Primary custom domain (apex, no www). Netlify serves the .netlify.app subdomain too
  // and 301-redirects it to this once set as the primary domain.
  domain: "https://marinobarbero.com",
  brand: "Marino Barbero",
  brandFull: "Marino Barbero — The Barber Shop",

  // Booking: Fresha is the self-serve layer, WhatsApp is the human fallback.
  // Public Fresha booking URL — every "Book" CTA + schema ReserveAction uses it.
  // Deep-links straight to Fresha's "Select services" step instead of the venue profile,
  // so a booking is one screen closer. Verified in a browser: it 302s to
  // /a/marino-barbero-…/booking?menu=true and Fresha appends its own pId + cartId.
  //
  // The share link the owner copied carried "?share=true&pId=3049940". Both are dropped
  // here: pId is re-added by Fresha on its own, and share=true tags the visit as
  // share-originated — baking it into every CTA would file all website bookings under one
  // share campaign and make the Fresha source report useless.
  freshaUrl: "https://www.fresha.com/book-now/marino-barbero-m3zsn6k3/all-offer",
  phone: "+357 95 900930",
  phoneRaw: "+35795900930",
  whatsapp: "https://wa.me/35795900930",
  whatsappMsg: {
    el: "Γεια σας! Θα ήθελα να κλείσω ραντεβού στο Marino Barbero.",
    en: "Hi! I'd like to book an appointment at Marino Barbero.",
  },

  instagram: "https://instagram.com/marino_barbero",
  // Empty until the real profile exists. build.js drops blanks from schema sameAs, so a
  // URL pasted here is the whole fix for GEO-006 ("entity is resolvable") — Google reads
  // sameAs to tie this page to the same business it already knows from Maps and Instagram.
  // wikidata takes the item URL (https://www.wikidata.org/wiki/Q…) once one is created.
  facebook: "",
  tiktok: "",
  wikidata: "",
  // Google Business Profile (Maps place link) — used for reviews CTA + schema sameAs/hasMap.
  googleProfile: "https://www.google.com/maps/place//data=!4m2!3m1!1s0x14e70759e78c1bf5:0xbe7b292b4dd5166d",

  street: "Pafias Afroditis 18A",
  streetEl: "Πάφιας Αφροδίτης 18Α",
  district: "Kato Paphos",
  postal: "8041",
  city: "Paphos",
  region: "Paphos",
  country: "CY",
  // Approx Kato Paphos coordinates — refine with the exact pin from Google Business Profile.
  geo: { lat: 34.7583, lng: 32.4130 },

  rating: { value: "5.0", count: "128" },
  // First entry is the document root. English leads as of the 2026-08 redesign: the
  // demand is not Greek. 1820 of 1852 Search Console impressions and 92 of 106 GA4
  // sessions land on English, /en outdrew / by 62 to 14, and Greek-script queries are
  // 0.9% of impressions (90d to 21.08.2026). So English moved to "/" and Greek to
  // "/el/"; netlify.toml 301s the old /en/* URLs onto the new root.
  //
  // Greek is not demoted in quality — same components, same design, same schema. Only
  // the URL and the default changed. The one visual difference is display type: Playfair
  // has no Greek coverage, so /el/ falls back to Georgia (see --display in styles.css).
  langs: ["en", "el"],

  // Which language a search engine should offer someone whose own language matches
  // neither. Same answer as before the language flip, for the same reason (the demand is
  // English) — it now simply coincides with the root instead of pointing away from it.
  xDefaultLang: "en",

  // First day the site was in Google's index (sitemap submitted 24.07, first impressions
  // 23.07). Used for schema datePublished — dateModified is the build date.
  published: "2026-07-24",

  // Retail shelf, not e-commerce. There is no cart and nothing ships — the products
  // section is a display of what is stocked in the shop.
  //
  // priceFrom is deliberately a floor, not a per-SKU price: a 35 ml beard oil and a
  // wax puck do not cost the same, and a hard price on the page is a promise the
  // chair has to honour. Every product renders "from €10" until real per-SKU prices
  // land (add `price` to a PRODUCTS entry and build.js will show it instead).
  priceFrom: 10,
  // Fresha product/retail link — empty until the owner supplies it. While empty each
  // card renders the "available in the shop" line; the moment this is filled in,
  // build.js renders a real CTA on the section instead. Per-product override: set
  // `url` on a PRODUCTS entry.
  freshaShopUrl: "",

  // Google Analytics 4 Measurement ID (format: G-XXXXXXXXXX). Leave "" to disable
  // analytics entirely — build.js then emits no gtag snippet and no GA CSP entries.
  ga4: "G-G29D979G0Z",

  // Google Ads conversion ID (format: AW-XXXXXXXXX). Same contract as ga4: leave ""
  // and build.js emits no Ads config and no Ads CSP origins.
  //
  // The booking itself completes on fresha.com, a domain we cannot tag — so the
  // conversion measured here is the CLICK that hands off to Fresha, not the booking.
  // main.js fires it as `book_click`; the real click→booking rate is only knowable by
  // reconciling against the Fresha calendar by hand. Treat the number in Google Ads as
  // intent, not revenue.
  //
  // ⚠️ This must be the tag of the Ads account that actually SPENDS. The shop has more
  // than one account, and for a week this pointed at a paused one: the site fired
  // book_click into an account that pays for nothing, while the account running the
  // campaign reported zero conversions and looked broken. Verify the ID against the
  // spending account before every campaign launch.
  ads: "AW-18388273554",
};

// Opening hours — used by schema + contact block.
// Mon–Sat 09:30–20:00, Sun 11:00–17:00.
const HOURS = [
  { d: ["Mo", "Tu", "We", "Th", "Fr", "Sa"], open: "09:30", close: "20:00" },
  { d: ["Su"], open: "11:00", close: "17:00" },
];

// Flat service list (used for schema Offers). Grouped for display via `cat`.
// cat: cut | beard | treatment
//
// SOURCE OF TRUTH IS FRESHA, NOT THIS FILE. Every price and duration below was read off
// the live Fresha booking menu on 2026-07-25 and matches it exactly. The card is charged
// through Fresha, so if the two ever disagree the customer is right and the site is wrong.
// Re-check here after any change to the Fresha service menu.
//
// Previously wrong and now corrected: haircut was listed at €15 while Fresha charges €18,
// and four durations were guesses that did not match the booking menu.
//
// The three combo packages (€22 / €25 / €55) were removed: they were never created in
// Fresha, so every "book" click from that block landed in a menu where they did not exist.
// If they get added to Fresha, restore them here with cat "combo" plus a group entry and
// names in both languages.
const SERVICES = [
  { key: "haircut", cat: "cut", price: 18, dur: 30 },
  { key: "fade", cat: "cut", price: 18, dur: 30, hero: true },
  { key: "beard", cat: "beard", price: 7, dur: 10 },
  { key: "wash", cat: "beard", price: 10, dur: 20 },
  { key: "massage", cat: "treatment", price: 20, dur: 15 },
  { key: "scalp", cat: "treatment", price: 20, dur: 30 },
  { key: "mask", cat: "treatment", price: 15, dur: 20 },
];

// Retail products stocked in the shop. `img` is the base name of the transparent
// cut-out in src/img (rendered as product-<img>-440.webp / -880.webp for srcset).
// `brand` and `size` are printed on the packaging and are safe to publish; anything
// not on the box or confirmed by the manufacturer is NOT asserted in the copy.
//
// Deliberate omission: the Bio Wax №1–№4 codes almost certainly differ in hold or
// finish, but that mapping could not be verified from the packaging or from the
// manufacturer, so no card claims one. Copy differentiates by colour and code only.
// (CONFIRM) with the owner, then extend the per-language `desc` strings below.
// `schemaName` is the full manufacturer product name as printed on the box. It is not
// translated (a product name is a proper noun) and is what goes into the Product JSON-LD,
// while the shorter per-language `names` are what the card shows.
const PRODUCTS = [
  { key: "biowax_1", img: "biowax-1", brand: "Bio Wax", line: "The Original", schemaName: "Bio Wax №1 The Original" },
  { key: "biowax_2", img: "biowax-2", brand: "Bio Wax", line: "The Original", schemaName: "Bio Wax №2 The Original" },
  { key: "biowax_3", img: "biowax-3", brand: "Bio Wax", line: "The Original", schemaName: "Bio Wax №3 The Original" },
  { key: "biowax_4", img: "biowax-4", brand: "Bio Wax", line: "The Original", schemaName: "Bio Wax №4 The Original" },
  { key: "funkyhead", img: "crazybull-funkyhead", brand: "Crazy Bull", line: "Funky Head", size: "100 g", schemaName: "Crazy Bull Funky Head Matte Forming Paste" },
  { key: "minotaur", img: "crazybull-minotaur", brand: "Crazy Bull", line: "Minotaur", size: "35 ml", schemaName: "Crazy Bull Minotaur Beard Oil" },
];

// The Work section, one entry per cell, in render order. Everything the mockup shows in
// this block that is not listed here does not exist yet — the before/after fade pairs, the
// portrait of the barber, the detail crops and the two video loops are all still to be
// shot (see §9 of REDESIGN-PROMPT.md). Nothing is faked to fill the grid: the layout is
// driven by this list, so it stays composed at three cells and grows when files land.
//
// `img`   logical name in src/img, resolved to its content-hashed URL by build.js
// `w`/`h` the file's real intrinsic size — the browser reserves the box from this ratio,
//         and a wrong value here is a layout shift, not a cosmetic slip
// `cap`   key into L[lang].gallery.captions
// `span`  desktop mosaic width in grid columns (of 4); mobile is a single-file strip
// `ratio` CSS aspect-ratio for the cell
//
// To add a video loop: give an entry `video: "clippers"` (base name of the .webm/.mp4 pair
// in src/video) alongside `img`, which then becomes its poster. main.js loads it only on
// entering the viewport, never on save-data / 2g / reduced-motion, and pauses it out of
// view; build.js adds media-src 'self' to the CSP as soon as one exists. Two loops maximum
// — that is a budget decision, not a style one.
const GALLERY = [
  { img: "interior.webp", w: 1600, h: 906, cap: "interior", span: 2, ratio: "16/11" },
  { img: "interior-bg.webp", w: 1440, h: 1187, cap: "evening", span: 2, ratio: "16/11" },
];

const L = {
  el: {
    htmlLang: "el",
    ogLocale: "el_GR",
    label: "Ελληνικά",
    dir: "ltr",
    meta: {
      // Head term first, brand second, and the whole thing under 60 characters so the
      // SERP does not cut it (the previous 70-char version was truncated). "Πάφος" is
      // dropped in favour of "Κάτω Πάφο" — the district is what people search here, and
      // it contains the city. Greek demand is thin (0.9% of impressions, Search Console
      // 90d) but this is the page a Greek-speaking local lands on.
      title: "Κουρείο στην Κάτω Πάφο — Marino Barbero | Fade, Γένια",
      // ~155 chars: past that Google truncates in the SERP. The retail mention is here and
      // NOT in the title on purpose — the title is already at capacity on the query that
      // actually earns money ("κουρείο Πάφος"), and diluting it to chase wax searches
      // would trade a booking for a €10 tin.
      description:
        "Ανδρικό κουρείο στην Κάτω Πάφο. Fade, κούρεμα, περιποίηση γενιών — 5.0★ από 128 πελάτες. Κεριά styling & λάδι γενιών στο κατάστημα. Κλείσε ραντεβού online.",
      ogAlt: "Marino Barbero — κουρείο στην Κάτω Πάφο",
    },
    nav: {
      services: "Υπηρεσίες", about: "Το κουρείο", gallery: "Gallery",
      visit: "Πού θα μας βρεις", book: "Κλείσε ραντεβού",
      // Rail-only, kept short enough to sit in the page gutter.
      fade: "Το fade", products: "Προϊόντα", faq: "Ερωτήσεις",
      sections: "Ενότητες σελίδας",
    },
    hero: {
      eyebrow: "Ανδρικό Κουρείο · Κάτω Πάφος",
      // The headline is split so the last word can carry the gold gradient on its own
      // (--metal + background-clip:text). One accented word per page, no more.
      titleLead: "Χρόνος για το τέλειο",
      titleAccent: "κούρεμα.",
      // "κουρείο" verbatim, in the paragraph and not only in the eyebrow above it: the
      // audit reads the opening paragraph, and it was carrying the synonym "μπαρμπέρικο".
      subtitle:
        "Ανδρικό κουρείο στην Κάτω Πάφο που αφιερώνει χρόνο σε κάθε κούρεμα. Fade, κλασικά κουρέματα και περιποίηση γενιών — με βαθμολογία 5.0★ από 128 πελάτες.",
      book: "Κλείσε ραντεβού",
      whatsapp: "WhatsApp",
      // Price above the fold. Pre-qualifies the visitor and matches the ad copy, which
      // is one of the three Quality Score inputs. Both figures come from SERVICES.
      pill: "από €18",
      pillWide: "Από €18 · 30 λεπτά",
    },
    proof: {
      rating: "5.0",
      of: "στα 5.0",
      count: "128 κριτικές Google",
      quote: "«Παίρνει τον χρόνο του για ένα τέλειο κούρεμα.»",
      cta: "Δες τις κριτικές στο Google",
    },
    // Fade is the hero of the Google Ads campaign and had no matching region on the page —
    // the tightest ad-to-page message-match win available, and it feeds Quality Score.
    //
    // Everything asserted here comes from the confirmed Fresha menu (§2 of the business
    // brief): the service exists under the name "Fade", 30 minutes, €18, same price as the
    // classic cut. The fade heights are the standard names for the cut, not a claim about
    // this shop's technique. Nothing about razors, talc or finishing practice is stated —
    // none of it is confirmed, and the chair would have to honour it.
    fade: {
      label: "Το fade · 30 λεπτά · €18",
      headingLead: "Ένα fade, σε",
      headingAccent: "τριάντα λεπτά",
      // {svc} is replaced with the Fresha service name, highlighted in gold.
      body:
        "Skin, low, mid ή high — πες στον μπαρμπέρη πόσο ψηλά θέλεις να ανεβαίνει το σβήσιμο. Κλείνεται ως {svc} στη Fresha, στην ίδια τιμή με το κλασικό κούρεμα.",
      specs: [
        ["Χρόνος", "30 λεπτά"],
        ["Τιμή", "€18"],
        ["Στη Fresha", "Fade"],
      ],
      caption: "Ολοκληρωμένο fade",
    },
    services: {
      label: "Τιμοκατάλογος",
      heading: "Υπηρεσίες & τιμές",
      // The picker replaced the price table: tapping a row selects the service, the
      // sticky bar arms with it, and the hand-off carries it. This line says so, because
      // a table that suddenly responds to taps needs one sentence of explanation.
      pickHint: "Διάλεξε μια υπηρεσία. Η μπάρα από κάτω γεμίζει και η Fresha ανοίγει σε αυτήν.",
      totalEmpty: "Δεν έχεις διαλέξει ακόμη",
      note: "Οι τιμές είναι σε ευρώ. Πληρωμή στο κατάστημα (μετρητά / κάρτα). Πέρνα και χωρίς ραντεβού αν είναι ελεύθερη καρέκλα — το ραντεβού απλώς κρατά την ώρα.",
      groups: [
        { cat: "cut", name: "Κουρέματα" },
        { cat: "beard", name: "Γένια & πλύσιμο" },
        { cat: "treatment", name: "Θεραπείες" },
      ],
      names: {
        haircut: "Κούρεμα", fade: "Fade", beard: "Γένια", wash: "Λούσιμο μαλλιών",
        massage: "Μασάζ κεφαλής", scalp: "Θεραπεία τριχωτού", mask: "Μάσκα προσώπου",
      },
      min: "λεπτά",
      book: "Κλείσε ραντεβού",
    },
    products: {
      label: "Προϊόντα",
      heading: "Ό,τι δουλεύουμε στην καρέκλα",
      intro:
        "Κεριά styling και περιποίηση γενιών που χρησιμοποιούμε καθημερινά στο κουρείο. Μπορείς να τα πάρεις μαζί σου μετά το κούρεμα.",
      // Desktop has room for the second half of the truth: this is a shelf, not a shop.
      introShop: "Διαθέσιμα στο κουρείο — δεν υπάρχει καλάθι εδώ και δεν στέλνουμε τίποτα.",
      from: "από",
      inShop: "Διαθέσιμο στο κουρείο",
      note: "Οι τιμές ξεκινούν από €10 ανά τεμάχιο. Πώληση στο κατάστημα (μετρητά / κάρτα). Ρώτησε τον μπαρμπέρη ποιο ταιριάζει στα μαλλιά σου.",
      // Says out loud what the PRODUCTS comment says in code: the №1–№4 difference is
      // unverified, so the copy differentiates by colour and nothing else.
      noteCodes: "Οι κωδικοί Bio Wax διαφέρουν μόνο στο χρώμα — τίποτα για το κράτημα δεν δηλώνεται όσο δεν το επιβεβαιώνει ο κατασκευαστής.",
      cta: "Δες τα προϊόντα",
      names: {
        biowax_1: "Bio Wax №1", biowax_2: "Bio Wax №2", biowax_3: "Bio Wax №3", biowax_4: "Bio Wax №4",
        funkyhead: "Funky Head", minotaur: "Minotaur",
      },
      // Sub-line under the name: the product type as printed on the box.
      types: {
        biowax_1: "Κερί μαλλιών", biowax_2: "Κερί μαλλιών", biowax_3: "Κερί μαλλιών", biowax_4: "Κερί μαλλιών",
        funkyhead: "Matte forming paste", minotaur: "Beard oil",
      },
      // Colour of the tin — the one Bio Wax differentiator we can actually verify.
      variants: {
        biowax_1: "Κεχριμπαρένιο", biowax_2: "Ματ μαύρο", biowax_3: "Κόκκινο", biowax_4: "Μπλε",
      },
      desc: {
        biowax_1: "Το κεχριμπαρένιο №1 της σειράς The Original. Δουλεύεται στο στεγνό μαλλί, στο τέλος του κουρέματος.",
        biowax_2: "Το ματ μαύρο №2 της ίδιας σειράς. Ρώτησέ μας ποιος κωδικός ταιριάζει στα μαλλιά σου.",
        biowax_3: "Το κόκκινο №3 της σειράς The Original — το ίδιο βαζάκι που βλέπεις στον πάγκο.",
        biowax_4: "Το μπλε №4 κλείνει τη σειρά των τεσσάρων κωδικών.",
        funkyhead:
          "Πάστα με βάση το νερό για υφή και ματ φινίρισμα. Ελαφρύ έως μέτριο κράτημα στο στεγνό μαλλί, πιο μαλακό στο νωπό. Vegan.",
        minotaur:
          "Λάδι-serum περιποίησης για τα γένια. Θρέφει και πειθαρχεί χωρίς λιπαρή αίσθηση — με συστατικά φυτικής προέλευσης.",
      },
    },
    about: {
      label: "Το κουρείο",
      heading: "Κυπριακό κουρείο, φτιαγμένο γύρω από τη λεπτομέρεια",
      body: [
        "Το Marino Barbero βρίσκεται στην καρδιά της Κάτω Πάφου — ένα ανδρικό κουρείο όπου κάθε κούρεμα γίνεται με χρόνο και προσοχή, όχι στο πόδι.",
        "Ντόπιος μάστορας, καθαρές γραμμές, ζεστό περιβάλλον. Είτε είσαι μόνιμος κάτοικος είτε περνάς από την Πάφο, φεύγεις με ένα κούρεμα που κρατάει.",
      ],
      quote: "«Παίρνει τον χρόνο του για ένα τέλειο κούρεμα.»",
      quoteAuthor: "— από κριτική πελάτη στο Google",
    },
    // `intro` and `captions` describe only the photographs that actually exist. The shot
    // list in the redesign brief (before/after pairs, a portrait of the barber, detail
    // crops, two video loops) has not been shot yet: build.js renders one cell per entry
    // in GALLERY, so a slot appears the moment a file does — and not before.
    gallery: {
      label: "Gallery",
      heading: "Μέσα στο κουρείο",
      intro: "Το κουρείο με το φως της ημέρας και το βράδυ, με τα εξάγωνα φωτιστικά αναμμένα.",
      alt: "Marino Barbero — κουρείο στην Κάτω Πάφο",
      captions: {
        interior: "Ο χώρος με το φως της ημέρας",
        evening: "Βραδινό φως · αναμμένα εξάγωνα φωτιστικά",
      },
    },
    visit: {
      label: "Πού θα μας βρεις",
      heading: "Κάτω Πάφος",
      // Derived from HOURS, so it cannot drift from the table below it. Deliberately says
      // nothing about parking or walking distance from the harbour — neither is confirmed.
      intro: "Ανοιχτά κάθε μέρα: Δευτέρα με Σάββατο από τις 09:30, Κυριακή από τις 11:00.",
      addressLabel: "Διεύθυνση",
      hoursLabel: "Ώρες λειτουργίας",
      contactLabel: "Επικοινωνία",
      book: "Κλείσε ραντεβού",
      hours: [
        ["Δευτέρα – Σάββατο", "09:30 – 20:00"],
        ["Κυριακή", "11:00 – 17:00"],
      ],
    },
    footer: {
      tagline: "Ανδρικό Κουρείο · Κάτω Πάφος, Κύπρος",
      rights: "Με την επιφύλαξη παντός δικαιώματος.",
      reviews: "Κριτικές Google",
      privacy: "Πολιτική απορρήτου",
      cookies: "Ρυθμίσεις cookies",
      updated: "Ενημερώθηκε",
    },
    // "home" names the link, "label" names the landmark — a screen reader announcing
    // "navigation, Αρχική" says nothing about what the navigation is.
    breadcrumb: { home: "Αρχική", label: "Διαδρομή πλοήγησης" },
    faq: {
      label: "Συχνές ερωτήσεις",
      heading: "Ό,τι ρωτούν πριν κλείσουν ραντεβού",
      items: [
        {
          q: "Χρειάζεται ραντεβού ή μπορώ να περάσω;",
          a: "Το online ραντεβού εξασφαλίζει την ώρα σου και παίρνει λίγα δευτερόλεπτα. Αν περάσεις χωρίς ραντεβού, θα σε εξυπηρετήσουμε μόλις ελευθερωθεί καρέκλα.",
        },
        {
          q: "Είστε ανοιχτά Κυριακή;",
          a: "Ναι. Δευτέρα με Σάββατο 09:30–20:00 και Κυριακή 11:00–17:00.",
        },
        {
          q: "Πόσο διαρκεί ένα κούρεμα ή ένα fade;",
          a: "Το κούρεμα και το fade κρατούν περίπου 30 λεπτά, η περιποίηση γενιών 10. Ο χρόνος στην καρέκλα δεν κόβεται για να βγει το πρόγραμμα.",
        },
        {
          q: "Σε ποιες γλώσσες μιλάτε;",
          a: "Ελληνικά και αγγλικά.",
        },
        {
          q: "Πόσο κοστίζει και πώς πληρώνω;",
          a: "Κούρεμα και fade €18, γένια €7 — ο πλήρης τιμοκατάλογος είναι πιο πάνω. Δεχόμαστε μετρητά και κάρτα στο κατάστημα.",
        },
        {
          q: "Πουλάτε τα προϊόντα που δουλεύετε;",
          a: "Ναι, στο κατάστημα. Δεν έχουμε online κατάστημα και δεν στέλνουμε παραγγελίες — ρώτησέ μας στην καρέκλα ποιος κωδικός ταιριάζει στα μαλλιά σου.",
        },
      ],
    },
    privacy: {
      metaTitle: "Πολιτική απορρήτου — Marino Barbero",
      // 120–165 characters: shorter than that and Google pads the snippet with text it
      // picks itself.
      metaDescription:
        "Τι δεδομένα συλλέγει ο ιστότοπος του κουρείου Marino Barbero στην Κάτω Πάφο, ποιος τα λαμβάνει, σε τι βασίζεται και πώς αποσύρεις τη συγκατάθεσή σου.",
      title: "Πολιτική απορρήτου",
      updatedLabel: "Τελευταία ενημέρωση",
      // Σύντομες απαντήσεις πάνω από το κείμενο: μια νομική σελίδα που ξεκινά με οκτώ
      // παραγράφους δεν απαντά σε τίποτα, και ούτε ο επισκέπτης ούτε η μηχανή βρίσκουν
      // την απάντηση (GO-144 / GEO-004).
      glanceLabel: "Με δύο λόγια",
      glance: [
        ["Τι συλλέγει ο ιστότοπος από μόνος του;", "Τίποτα. Δεν υπάρχουν φόρμες, λογαριασμοί ούτε πληρωμές."],
        ["Υπάρχουν cookies πριν απαντήσω στο μήνυμα;", "Όχι. Κανένα cookie μέτρησης δεν φορτώνεται πριν πατήσεις «Αποδοχή»."],
        ["Ποιος λαμβάνει δεδομένα αν δεχτώ;", "Google Analytics 4 και Google Ads, για επισκεψιμότητα και απόδοση διαφημίσεων."],
        ["Πού πηγαίνουν τα στοιχεία του ραντεβού;", "Στη Fresha, που είναι ανεξάρτητος υπεύθυνος επεξεργασίας με τη δική της πολιτική."],
        ["Πώς αποσύρω τη συγκατάθεση;", "Από τον σύνδεσμο «Ρυθμίσεις cookies» στο υποσέλιδο, οποτεδήποτε."],
      ],
      intro:
        "Ο ιστότοπος δεν έχει φόρμες, λογαριασμούς ή πληρωμές. Δεν ζητάμε τίποτα από εσένα εδώ: το ραντεβού κλείνεται στη Fresha και η συνομιλία γίνεται στο WhatsApp. Παρακάτω είναι, με ονόματα και σκοπούς, ό,τι περνά από αυτή τη σελίδα.",
      sections: [
        {
          h: "Υπεύθυνος επεξεργασίας",
          p: [
            "Marino Barbero — The Barber Shop, Πάφιας Αφροδίτης 18Α, Κάτω Πάφος, 8041 Πάφος, Κύπρος.",
            "Επικοινωνία για οτιδήποτε σχετικό με τα δεδομένα σου: τηλέφωνο +357 95 900930, ή το ίδιο νούμερο στο WhatsApp.",
          ],
        },
        {
          h: "Τι συλλέγεται χωρίς τη συγκατάθεσή σου",
          p: [
            "Μόνο τα τεχνικά αρχεία του διακομιστή που κρατά ο πάροχος φιλοξενίας (Netlify): διεύθυνση IP, τύπος περιηγητή και ποια σελίδα ζητήθηκε. Χρησιμεύουν στην ασφάλεια και στη διάγνωση σφαλμάτων, δεν συνδέονται με όνομα και δεν χρησιμοποιούνται για διαφήμιση.",
            "Πριν πατήσεις «Αποδοχή», δεν φορτώνεται κανένα cookie μέτρησης. Η επιλογή σου αποθηκεύεται τοπικά στον περιηγητή σου (localStorage, κλειδί «mb-consent») και δεν στέλνεται πουθενά.",
          ],
        },
        {
          h: "Τι συλλέγεται αν δώσεις συγκατάθεση",
          p: [
            "Google Analytics 4: ψευδώνυμα αναγνωριστικά, ποιες ενότητες είδες, αν πάτησες «Κλείσε ραντεβού», WhatsApp ή το τηλέφωνο, κατά προσέγγιση περιοχή από την IP, τύπος συσκευής. Τα δεδομένα διατηρούνται 14 μήνες.",
            "Google Ads: μέτρηση αν μια επίσκεψη ήρθε από διαφήμιση και αν κατέληξε σε κλικ στο ραντεβού. Χωρίς αυτό δεν ξέρουμε ποια διαφήμιση αξίζει τα χρήματά της.",
            "Και τα δύο τρέχουν σε λειτουργία συγκατάθεσης (consent mode): όσο η απάντηση είναι «Απόρριψη», τα σχετικά cookies μένουν κλειστά.",
          ],
        },
        {
          h: "Πού σε στέλνει αυτή η σελίδα",
          p: [
            "Fresha — το online ραντεβού. Ό,τι δίνεις εκεί (όνομα, τηλέφωνο, email) πηγαίνει στη Fresha ως ανεξάρτητο υπεύθυνο επεξεργασίας, με τη δική της πολιτική.",
            "WhatsApp (Meta) — αν επιλέξεις να γράψεις. Ισχύουν οι όροι του WhatsApp.",
            "Instagram (Meta) και το προφίλ μας στο Google — απλοί εξωτερικοί σύνδεσμοι.",
            "Ο ενσωματωμένος χάρτης Google Maps: μόλις φορτώσει, η Google λαμβάνει τη διεύθυνση IP σου. Είναι απαραίτητος για να βρεις το κατάστημα.",
          ],
        },
        {
          h: "Νομικές βάσεις",
          p: [
            "Συγκατάθεση για τη μέτρηση και τη διαφήμιση (άρθρο 6 παρ. 1 στοιχ. α΄ GDPR). Έννομο συμφέρον για τα αρχεία ασφαλείας του διακομιστή (στοιχ. στ΄). Εκτέλεση σύμβασης όταν κλείνεις ραντεβού (στοιχ. β΄) — αυτό γίνεται στη Fresha.",
          ],
        },
        {
          h: "Τα δικαιώματά σου",
          p: [
            "Πρόσβαση, διόρθωση, διαγραφή, περιορισμός, εναντίωση και φορητότητα των δεδομένων σου. Μπορείς επίσης να αποσύρεις τη συγκατάθεσή σου οποτεδήποτε — από τον σύνδεσμο «Ρυθμίσεις cookies» στο υποσέλιδο, που εμφανίζει ξανά το μήνυμα επιλογής.",
            "Αν θεωρείς ότι κάτι γίνεται λάθος, μπορείς να προσφύγεις στο Γραφείο Επιτρόπου Προστασίας Δεδομένων Προσωπικού Χαρακτήρα Κύπρου.",
          ],
        },
        {
          h: "Παιδιά",
          p: [
            "Κουρεύουμε και παιδιά, αλλά ο ιστότοπος δεν ζητά και δεν αποθηκεύει στοιχεία ανηλίκων. Το ραντεβού για παιδί το κλείνει ο γονέας ή ο κηδεμόνας.",
          ],
        },
        {
          h: "Αλλαγές",
          p: [
            "Αν αλλάξει κάτι στα εργαλεία μέτρησης ή στους συνεργάτες, αλλάζει και αυτή η σελίδα, και η ημερομηνία πιο πάνω δείχνει πότε.",
          ],
        },
      ],
    },
    // The sticky bar and the booking sheet. The bar's armed label ("Fade · 30 λεπτά · €18")
    // is assembled in main.js from the picked rows, so the unit and the joiners live here
    // and travel to the browser on data-* attributes rather than being hardcoded in JS.
    booking: {
      title: "Κλείσε ραντεβού",
      intro: "Διάλεξε υπηρεσία και ώρα — online κράτηση μέσω Fresha.",
      cta: "Συνέχεια στο Fresha",
      via: "Ασφαλής online κράτηση μέσω Fresha",
      close: "Κλείσιμο",
      open: "Κλείσε ραντεβού",
      serviceLabel: "Υπηρεσία",
      durLabel: "Χρόνος στην καρέκλα",
      totalLabel: "Σύνολο",
      // Shown while nothing is ticked: honest about what the hand-off will and won't carry.
      anyService: "Οποιαδήποτε υπηρεσία",
      chooseOnFresha: "Διάλεξε στη Fresha",
      whatsappAlt: "Στείλε μήνυμα στο WhatsApp",
      // Second line of the bar: barVia at rest, barSub once a service is held.
      // Both are kept short — the bar truncates rather than wraps, because
      // --bar-h is what lifts the consent banner and pads the hero.
      barVia: "Online κράτηση μέσω Fresha",
      barSub: "Συνέχεια στο Fresha",
      // {n} services, when more than one row is ticked.
      manyServices: "{n} υπηρεσίες",
    },
    consent: {
      text: "Χρησιμοποιούμε cookies για ανώνυμα στατιστικά επισκεψιμότητας (Google Analytics) και για τη μέτρηση της απόδοσης των διαφημίσεών μας (Google Ads). Μπορείς να τα αποδεχτείς ή να τα απορρίψεις.",
      accept: "Αποδοχή",
      decline: "Απόρριψη",
      aria: "Ειδοποίηση για cookies",
    },
    notFound: {
      title: "Η σελίδα δεν βρέθηκε",
      code: "404",
      heading: "Έχασες το ραντεβού;",
      text: "Η σελίδα που ζήτησες δεν υπάρχει ή μετακινήθηκε. Γύρνα στην αρχική ή κλείσε απευθείας το ραντεβού σου.",
      home: "Αρχική σελίδα",
      book: "Κλείσε ραντεβού",
    },
  },

  en: {
    htmlLang: "en",
    ogLocale: "en_GB",
    label: "English",
    dir: "ltr",
    meta: {
      // This is the page that earns: 1820 of 1852 impressions and 35 of 37 clicks
      // (Search Console, 90d). Every query behind them is English — "barber paphos",
      // "barber shop paphos", "barbers near me" — so the title leads with the category
      // and the district, and the brand follows. Same phrasing as the top-performing
      // Google Ads headline, which also drags Quality Score along with it.
      title: "Barber Shop in Kato Paphos — Marino Barbero | Fades",
      description:
        "Men's barber shop in Kato Paphos — fades, classic cuts and beard care, rated 5.0★ by 128 clients. Styling wax and beard oil sold in shop. Book online.",
      ogAlt: "Marino Barbero — barber shop in Kato Paphos",
    },
    nav: {
      services: "Services", about: "The shop", gallery: "Gallery",
      visit: "Visit", book: "Book now",
      fade: "The fade", products: "Products", faq: "FAQ",
      sections: "Page sections",
    },
    hero: {
      eyebrow: "Men's Barber Shop · Kato Paphos",
      titleLead: "Time for the perfect",
      titleAccent: "cut.",
      // "barber shop" as two words, matching the query that actually earns here
      // ("barber shop paphos", "barber paphos"), plus the district.
      subtitle:
        "The barber shop in Kato Paphos that takes its time — fades, classic cuts and beard care, rated 5.0★ by 128 clients.",
      book: "Book now",
      whatsapp: "WhatsApp",
      pill: "from €18",
      pillWide: "From €18 · 30 min",
    },
    proof: {
      rating: "5.0",
      of: "out of 5.0",
      count: "128 Google reviews",
      quote: "“He takes his time for a flawless cut.”",
      cta: "Read the reviews on Google",
    },
    fade: {
      label: "The fade · 30 min · €18",
      headingLead: "A fade, done in",
      headingAccent: "thirty minutes",
      body:
        "Skin, low, mid or high — tell the barber how high you want the blend to sit. Booked as {svc} on Fresha, same price as the classic cut.",
      specs: [
        ["Time", "30 min"],
        ["Price", "€18"],
        ["On Fresha", "Fade"],
      ],
      caption: "A finished fade",
    },
    services: {
      label: "Price list",
      heading: "Services & prices",
      pickHint: "Pick a service. The bar below arms with it and Fresha opens on that one.",
      totalEmpty: "Nothing ticked yet",
      note: "Prices in euros. Payment in-shop (cash / card). Walk in if a chair is free — booking just holds the time.",
      groups: [
        { cat: "cut", name: "Haircuts" },
        { cat: "beard", name: "Beard & wash" },
        { cat: "treatment", name: "Treatments" },
      ],
      names: {
        haircut: "Haircut", fade: "Fade", beard: "Beard", wash: "Hair wash",
        massage: "Head massage", scalp: "Scalp treatment", mask: "Face mask",
      },
      min: "min",
      book: "Book now",
    },
    products: {
      label: "Products",
      heading: "What we work with in the chair",
      intro:
        "The styling waxes and beard care we use every day in the shop. Take one home with you after the cut.",
      introShop: "Available in the shop — there is no basket here and nothing ships.",
      from: "from",
      inShop: "Available in the shop",
      note: "Prices start at €10 per item. Sold in-shop (cash / card). Ask the barber which one suits your hair.",
      noteCodes: "The Bio Wax codes differ by colour only — nothing about hold is claimed until the manufacturer confirms it.",
      cta: "See the products",
      names: {
        biowax_1: "Bio Wax №1", biowax_2: "Bio Wax №2", biowax_3: "Bio Wax №3", biowax_4: "Bio Wax №4",
        funkyhead: "Funky Head", minotaur: "Minotaur",
      },
      types: {
        biowax_1: "Hair wax", biowax_2: "Hair wax", biowax_3: "Hair wax", biowax_4: "Hair wax",
        funkyhead: "Matte forming paste", minotaur: "Beard oil",
      },
      variants: {
        biowax_1: "Amber", biowax_2: "Matte black", biowax_3: "Red", biowax_4: "Blue",
      },
      desc: {
        biowax_1: "The amber №1 from The Original line. Worked into dry hair at the end of the cut.",
        biowax_2: "The matte black №2 from the same line. Ask us which code suits your hair.",
        biowax_3: "The red №3 from The Original line — the same tin you see on the counter.",
        biowax_4: "The blue №4 closes out the set of four codes.",
        funkyhead:
          "Water-based paste for texture and a matte finish. Light to medium hold on dry hair, softer on towel-dried. Vegan.",
        minotaur:
          "A conditioning oil serum for the beard. Nourishes and tames without a greasy residue — plant-origin ingredients.",
      },
    },
    about: {
      label: "The shop",
      heading: "A Cypriot barber shop built around the details",
      body: [
        "Marino Barbero sits in the heart of Kato Paphos — a men's barber shop where every cut is done with time and care, never rushed.",
        "Local barber, clean lines, a warm room. Whether you live here or you're passing through Paphos, you leave with a cut that holds.",
      ],
      quote: "“He takes his time for a flawless cut.”",
      quoteAuthor: "— from a client's Google review",
    },
    gallery: {
      label: "Gallery",
      heading: "Inside the shop",
      intro: "The room in daylight and in the evening, when the hexagon lamps are lit.",
      alt: "Marino Barbero — barber shop in Kato Paphos",
      captions: {
        interior: "The room in daylight",
        evening: "Evening light · hexagon lamps lit",
      },
    },
    visit: {
      label: "Visit",
      heading: "Kato Paphos",
      intro: "Open every day: Monday to Saturday from 09:30, Sunday from 11:00.",
      addressLabel: "Address",
      hoursLabel: "Opening hours",
      contactLabel: "Contact",
      book: "Book now",
      hours: [
        ["Monday – Saturday", "09:30 – 20:00"],
        ["Sunday", "11:00 – 17:00"],
      ],
    },
    footer: {
      tagline: "Men's Barber Shop · Kato Paphos, Cyprus",
      rights: "All rights reserved.",
      reviews: "Google reviews",
      privacy: "Privacy policy",
      cookies: "Cookie settings",
      updated: "Updated",
    },
    breadcrumb: { home: "Home", label: "Breadcrumb" },
    faq: {
      label: "FAQ",
      heading: "What people ask before booking",
      items: [
        {
          q: "Do I need an appointment or can I walk in?",
          a: "Booking online takes a few seconds and holds your slot. If you walk in, we will take you as soon as a chair is free.",
        },
        {
          q: "Are you open on Sunday?",
          a: "Yes. Monday to Saturday 09:30–20:00, Sunday 11:00–17:00.",
        },
        {
          q: "How long does a haircut or a fade take?",
          a: "About 30 minutes for a cut or a fade, 10 for beard care. Time in the chair is not cut short to keep the schedule moving.",
        },
        {
          q: "What languages do you speak?",
          a: "Greek and English.",
        },
        {
          q: "What does it cost and how do I pay?",
          a: "Haircut and fade €18, beard €7 — the full price list is above. Cash and card accepted in the shop.",
        },
        {
          q: "Do you sell the products you use?",
          a: "Yes, over the counter. There is no online store and nothing ships — ask in the chair which code suits your hair.",
        },
      ],
    },
    privacy: {
      metaTitle: "Privacy policy — Marino Barbero",
      metaDescription:
        "What the Marino Barbero barber shop website collects in Kato Paphos, who receives it, the legal basis for each purpose, and how to withdraw your consent.",
      title: "Privacy policy",
      updatedLabel: "Last updated",
      glanceLabel: "In short",
      glance: [
        ["What does the site collect on its own?", "Nothing. There are no forms, no accounts and no payments."],
        ["Are there cookies before I answer the banner?", "No. No measurement cookie loads before you press Accept."],
        ["Who receives data if I accept?", "Google Analytics 4 and Google Ads, for traffic and ad performance."],
        ["Where do my booking details go?", "To Fresha, an independent controller with its own policy."],
        ["How do I withdraw consent?", "Through the Cookie settings link in the footer, at any time."],
      ],
      intro:
        "This site has no forms, no accounts and no payments. We ask you for nothing here: bookings happen on Fresha and conversations happen on WhatsApp. Below is everything that passes through this page, named and explained.",
      sections: [
        {
          h: "Who is responsible",
          p: [
            "Marino Barbero — The Barber Shop, Pafias Afroditis 18A, Kato Paphos, 8041 Paphos, Cyprus.",
            "For anything about your data: +357 95 900930, by phone or on WhatsApp at the same number.",
          ],
        },
        {
          h: "What is collected without your consent",
          p: [
            "Only the server logs kept by the host (Netlify): IP address, browser type and which page was requested. They exist for security and debugging, are not tied to a name, and are never used for advertising.",
            "Before you press \u201CAccept\u201D, no measurement cookie is loaded at all. Your choice is stored locally in your own browser (localStorage, key \u201Cmb-consent\u201D) and is not sent anywhere.",
          ],
        },
        {
          h: "What is collected if you consent",
          p: [
            "Google Analytics 4: pseudonymous identifiers, which sections you viewed, whether you tapped Book, WhatsApp or the phone number, approximate area from your IP, device type. Retained for 14 months.",
            "Google Ads: whether a visit came from an ad and whether it ended in a booking click. Without it we cannot tell which ad is worth its money.",
            "Both run in consent mode: while the answer is \u201CDecline\u201D, the related cookies stay off.",
          ],
        },
        {
          h: "Where this page hands you on",
          p: [
            "Fresha — online booking. Whatever you enter there (name, phone, email) goes to Fresha as an independent controller, under its own policy.",
            "WhatsApp (Meta) — only if you choose to write. WhatsApp's own terms apply.",
            "Instagram (Meta) and our Google profile — plain external links.",
            "The embedded Google Maps frame: once it loads, Google receives your IP address. It is there so you can find the shop.",
          ],
        },
        {
          h: "Legal bases",
          p: [
            "Consent for measurement and advertising (GDPR Art. 6(1)(a)). Legitimate interest for server security logs (Art. 6(1)(f)). Performance of a contract when you book (Art. 6(1)(b)) — which happens on Fresha.",
          ],
        },
        {
          h: "Your rights",
          p: [
            "Access, rectification, erasure, restriction, objection and portability. You can also withdraw consent at any time through the \u201CCookie settings\u201D link in the footer, which brings the choice banner back.",
            "If you believe something is being handled wrongly, you can complain to the Office of the Commissioner for Personal Data Protection in Cyprus.",
          ],
        },
        {
          h: "Children",
          p: [
            "We cut children's hair, but the website neither asks for nor stores any details about minors. A booking for a child is made by the parent or guardian.",
          ],
        },
        {
          h: "Changes",
          p: [
            "If the measurement tools or the partners change, this page changes with them, and the date above says when.",
          ],
        },
      ],
    },
    booking: {
      title: "Book now",
      intro: "Pick a service and time — book online via Fresha.",
      cta: "Continue on Fresha",
      via: "Secure online booking via Fresha",
      close: "Close",
      open: "Book now",
      serviceLabel: "Service",
      durLabel: "Chair time",
      totalLabel: "Total",
      anyService: "Any service",
      chooseOnFresha: "Choose on Fresha",
      whatsappAlt: "Message on WhatsApp instead",
      barVia: "Book online via Fresha",
      barSub: "Continue on Fresha",
      manyServices: "{n} services",
    },
    consent: {
      text: "We use cookies for anonymous traffic statistics (Google Analytics) and to measure how our ads perform (Google Ads). You can accept or decline.",
      accept: "Accept",
      decline: "Decline",
      aria: "Cookie notice",
    },
    notFound: {
      title: "Page not found",
      code: "404",
      heading: "Lost the thread?",
      text: "The page you asked for doesn't exist or has moved. Head back home or book your next appointment.",
      home: "Back home",
      book: "Book now",
    },
  },
};

module.exports = { SITE, HOURS, SERVICES, PRODUCTS, GALLERY, L };
