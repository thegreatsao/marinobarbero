// Marino Barbero — The Barber Shop · content model (EL primary, EN; RU can be added later)
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
  freshaUrl: "https://www.fresha.com/en-GB/a/marino-barbero-pafos-paphos-pafias-afroditis-18a-udlx19uz",
  phone: "+357 95 900930",
  phoneRaw: "+35795900930",
  whatsapp: "https://wa.me/35795900930",
  whatsappMsg: {
    el: "Γεια σας! Θα ήθελα να κλείσω ραντεβού στο Marino Barbero.",
    en: "Hi! I'd like to book an appointment at Marino Barbero.",
  },

  instagram: "https://instagram.com/marino_barbero",
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
  langs: ["el", "en"], // first is the document root (primary = Greek)

  // Google Analytics 4 Measurement ID (format: G-XXXXXXXXXX). Leave "" to disable
  // analytics entirely — build.js then emits no gtag snippet and no GA CSP entries.
  ga4: "G-G29D979G0Z",
};

// Opening hours — used by schema + contact block.
// Mon–Sat 09:30–20:00, Sun 11:00–17:00.
const HOURS = [
  { d: ["Mo", "Tu", "We", "Th", "Fr", "Sa"], open: "09:30", close: "20:00" },
  { d: ["Su"], open: "11:00", close: "17:00" },
];

// Flat service list (used for schema Offers). Grouped for display via `cat`.
// cat: cut | beard | treatment | combo
const SERVICES = [
  { key: "haircut", cat: "cut", price: 15, dur: 30 },
  { key: "fade", cat: "cut", price: 18, dur: 40, hero: true },
  { key: "beard", cat: "beard", price: 7, dur: 15 },
  { key: "wash", cat: "beard", price: 10, dur: 15 },
  { key: "massage", cat: "treatment", price: 20, dur: 20 },
  { key: "scalp", cat: "treatment", price: 20, dur: 30 },
  { key: "mask", cat: "treatment", price: 15, dur: 20 },
  { key: "combo_hb", cat: "combo", price: 22, dur: 45 },
  { key: "combo_fb", cat: "combo", price: 25, dur: 55 },
  { key: "combo_full", cat: "combo", price: 55, dur: 90 },
];

const L = {
  el: {
    htmlLang: "el",
    ogLocale: "el_GR",
    label: "Ελληνικά",
    dir: "ltr",
    meta: {
      title: "Marino Barbero — Κουρείο στην Πάφο (Κάτω Πάφος) | Fade, Κούρεμα, Γένια",
      description:
        "Ανδρικό κουρείο στην Κάτω Πάφο. Fade, κλασικό κούρεμα, περιποίηση γενιών και θεραπείες — βαθμολογία 5.0★ από 128 πελάτες. Κλείσε ραντεβού online ή μέσω WhatsApp.",
      ogAlt: "Marino Barbero — κουρείο στην Κάτω Πάφο",
    },
    nav: { services: "Υπηρεσίες", about: "Το κουρείο", gallery: "Gallery", visit: "Πού θα μας βρεις", book: "Κλείσε ραντεβού" },
    hero: {
      eyebrow: "Ανδρικό Κουρείο · Κάτω Πάφος",
      titleLines: ["Χρόνος", "για το τέλειο", "κούρεμα."],
      subtitle:
        "Το μπαρμπέρικο που αφιερώνει χρόνο σε κάθε κούρεμα. Fade, κλασικά κουρέματα και περιποίηση γενιών — με βαθμολογία 5.0★ από 128 πελάτες.",
      book: "Κλείσε ραντεβού",
      whatsapp: "WhatsApp",
      scroll: "Κύλισε",
    },
    proof: {
      rating: "5.0",
      of: "στα 5.0",
      count: "128 κριτικές Google",
      quote: "«Παίρνει τον χρόνο του για ένα τέλειο κούρεμα.»",
      cta: "Δες τις κριτικές στο Google",
    },
    marquee: ["Fade", "Κλασικό κούρεμα", "Περιποίηση γενιών", "Head massage", "Scalp treatment", "5.0★ · 128 κριτικές"],
    services: {
      label: "Τιμοκατάλογος",
      heading: "Υπηρεσίες & τιμές",
      note: "Οι τιμές είναι σε ευρώ. Πληρωμή στο κατάστημα (μετρητά / κάρτα).",
      groups: [
        { cat: "cut", name: "Κουρέματα" },
        { cat: "beard", name: "Γένια & πλύσιμο" },
        { cat: "treatment", name: "Θεραπείες" },
        { cat: "combo", name: "Πακέτα" },
      ],
      names: {
        haircut: "Κούρεμα", fade: "Fade", beard: "Γένια", wash: "Λούσιμο μαλλιών",
        massage: "Μασάζ κεφαλής", scalp: "Θεραπεία τριχωτού", mask: "Μάσκα προσώπου",
        combo_hb: "Κούρεμα + Γένια", combo_fb: "Fade + Γένια", combo_full: "Full grooming (Fade + Γένια + Λούσιμο + Μάσκα)",
      },
      min: "λεπτά",
      book: "Κλείσε ραντεβού",
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
    gallery: { label: "Gallery", heading: "Μέσα στο κουρείο", alt: "Marino Barbero — κουρείο στην Κάτω Πάφο" },
    visit: {
      label: "Πού θα μας βρεις",
      heading: "Κάτω Πάφος",
      addressLabel: "Διεύθυνση",
      hoursLabel: "Ώρες λειτουργίας",
      contactLabel: "Επικοινωνία",
      book: "Κλείσε ραντεβού",
      hours: [
        ["Δευτέρα – Σάββατο", "09:30 – 20:00"],
        ["Κυριακή", "11:00 – 17:00"],
      ],
    },
    footer: { tagline: "Ανδρικό Κουρείο · Κάτω Πάφος, Κύπρος", rights: "Με την επιφύλαξη παντός δικαιώματος.", reviews: "Κριτικές Google" },
    booking: {
      title: "Κλείσε ραντεβού",
      intro: "Διάλεξε υπηρεσία και ώρα — online κράτηση μέσω Fresha.",
      cta: "Συνέχεια στο Fresha",
      via: "Ασφαλής online κράτηση μέσω Fresha",
      close: "Κλείσιμο",
      open: "Κλείσε ραντεβού",
    },
    consent: {
      text: "Χρησιμοποιούμε cookies για ανώνυμα στατιστικά επισκεψιμότητας (Google Analytics). Μπορείς να τα αποδεχτείς ή να τα απορρίψεις.",
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
      title: "Marino Barbero — Barber Shop in Kato Paphos | Fades, Cuts & Beard Care",
      description:
        "Men's barber shop in Kato Paphos. Fades, classic cuts, beard care and treatments — rated 5.0★ by 128 clients. Book online or via WhatsApp.",
      ogAlt: "Marino Barbero — barber shop in Kato Paphos",
    },
    nav: { services: "Services", about: "The shop", gallery: "Gallery", visit: "Visit", book: "Book now" },
    hero: {
      eyebrow: "Men's Barber Shop · Kato Paphos",
      titleLines: ["Time", "for the perfect", "cut."],
      subtitle:
        "The Paphos barbershop that takes its time — fades, classic cuts and beard care, rated 5.0★ by 128 clients.",
      book: "Book now",
      whatsapp: "WhatsApp",
      scroll: "Scroll",
    },
    proof: {
      rating: "5.0",
      of: "out of 5.0",
      count: "128 Google reviews",
      quote: "“He takes his time for a flawless cut.”",
      cta: "Read the reviews on Google",
    },
    marquee: ["Fades", "Classic cuts", "Beard care", "Head massage", "Scalp treatment", "5.0★ · 128 reviews"],
    services: {
      label: "Price list",
      heading: "Services & prices",
      note: "Prices in euros. Payment in-shop (cash / card).",
      groups: [
        { cat: "cut", name: "Haircuts" },
        { cat: "beard", name: "Beard & wash" },
        { cat: "treatment", name: "Treatments" },
        { cat: "combo", name: "Packages" },
      ],
      names: {
        haircut: "Haircut", fade: "Fade", beard: "Beard", wash: "Hair wash",
        massage: "Head massage", scalp: "Scalp treatment", mask: "Face mask",
        combo_hb: "Haircut + Beard", combo_fb: "Fade + Beard", combo_full: "Full grooming (Fade + Beard + Wash + Mask)",
      },
      min: "min",
      book: "Book now",
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
    gallery: { label: "Gallery", heading: "Inside the shop", alt: "Marino Barbero — barber shop in Kato Paphos" },
    visit: {
      label: "Visit",
      heading: "Kato Paphos",
      addressLabel: "Address",
      hoursLabel: "Opening hours",
      contactLabel: "Contact",
      book: "Book now",
      hours: [
        ["Monday – Saturday", "09:30 – 20:00"],
        ["Sunday", "11:00 – 17:00"],
      ],
    },
    footer: { tagline: "Men's Barber Shop · Kato Paphos, Cyprus", rights: "All rights reserved.", reviews: "Google reviews" },
    booking: {
      title: "Book now",
      intro: "Pick a service and time — book online via Fresha.",
      cta: "Continue on Fresha",
      via: "Secure online booking via Fresha",
      close: "Close",
      open: "Book now",
    },
    consent: {
      text: "We use cookies for anonymous traffic statistics (Google Analytics). You can accept or decline.",
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

module.exports = { SITE, HOURS, SERVICES, L };
