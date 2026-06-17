// Sytelens — deterministic typosquat / brand-impersonation detection.
// High-confidence only (punycode/IDN homographs, digit/look-alike substitutions,
// and delimited brand-name combosquats). Subtler typos are left to the model.

// Brand name (the token we match) + its official registrable domains (allowlist
// so we never flag the real brand or its known properties).
const BRANDS = [
  { name: "amazon", display: "Amazon", domains: ["amazon.com", "amazon.co.uk", "amazon.de", "amazon.co.jp", "amazon.in", "amazon.ca", "amazon.fr", "amazon.it", "amazon.es", "amazon.com.br", "amazon.com.au", "amazonaws.com", "amzn.to"] },
  { name: "paypal", display: "PayPal", domains: ["paypal.com", "paypal.me"] },
  { name: "apple", display: "Apple", domains: ["apple.com", "icloud.com", "me.com"] },
  { name: "google", display: "Google", domains: ["google.com", "google.co.uk", "goo.gl", "youtube.com", "gmail.com"] },
  { name: "microsoft", display: "Microsoft", domains: ["microsoft.com", "live.com", "office.com", "outlook.com", "microsoftonline.com", "msn.com"] },
  { name: "netflix", display: "Netflix", domains: ["netflix.com"] },
  { name: "facebook", display: "Facebook", domains: ["facebook.com", "fb.com"] },
  { name: "instagram", display: "Instagram", domains: ["instagram.com"] },
  { name: "whatsapp", display: "WhatsApp", domains: ["whatsapp.com"] },
  { name: "openai", display: "OpenAI", domains: ["openai.com", "chatgpt.com"] },
  { name: "grok", display: "Grok / xAI", domains: ["grok.com", "x.ai"] },
  { name: "coinbase", display: "Coinbase", domains: ["coinbase.com"] },
  { name: "binance", display: "Binance", domains: ["binance.com", "binance.us"] },
  { name: "kraken", display: "Kraken", domains: ["kraken.com"] },
  { name: "metamask", display: "MetaMask", domains: ["metamask.io"] },
  { name: "ledger", display: "Ledger", domains: ["ledger.com"] },
  { name: "chase", display: "Chase", domains: ["chase.com"] },
  { name: "wellsfargo", display: "Wells Fargo", domains: ["wellsfargo.com"] },
  { name: "bankofamerica", display: "Bank of America", domains: ["bankofamerica.com", "bofa.com"] },
  { name: "citibank", display: "Citibank", domains: ["citi.com", "citibank.com"] },
  { name: "hsbc", display: "HSBC", domains: ["hsbc.com"] },
  { name: "stripe", display: "Stripe", domains: ["stripe.com"] },
  { name: "dhl", display: "DHL", domains: ["dhl.com"] },
  { name: "fedex", display: "FedEx", domains: ["fedex.com"] },
  { name: "ups", display: "UPS", domains: ["ups.com"] },
  { name: "usps", display: "USPS", domains: ["usps.com"] },
];

const OFFICIAL = new Set(BRANDS.flatMap((b) => b.domains));

/**
 * If `domain` is the official domain of a known, established brand, return that
 * brand (used to verify legitimacy and avoid false caution on high-profile sites).
 */
export function isKnownBrandDomain(domain) {
  if (!domain) return null;
  return BRANDS.find((b) => b.domains.includes(domain.toLowerCase())) || null;
}

// Normalize common digit/symbol look-alikes back to letters (0→o, 1→l, rn→m …).
function homoglyph(s) {
  return s
    .toLowerCase()
    .replace(/rn/g, "m")
    .replace(/vv/g, "w")
    .replace(/0/g, "o")
    .replace(/1/g, "l")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/\$/g, "s")
    .replace(/@/g, "a");
}

/**
 * Detect likely impersonation of a known brand by the registrable domain.
 * Returns { brand, display, official, technique, confidence, note } or null.
 */
export function detectImpersonation(domain) {
  if (!domain) return null;
  domain = domain.toLowerCase();
  if (OFFICIAL.has(domain)) return null; // it IS the real brand

  const labels = domain.split(".");
  const sld = labels[0]; // brand-bearing label

  // Internationalized (punycode) domain — classic homograph vector.
  if (labels.some((l) => l.startsWith("xn--"))) {
    return {
      brand: null, display: null, official: null,
      technique: "idn", confidence: "high",
      note: "Internationalized (punycode) domain — can disguise a look-alike of a real site.",
    };
  }

  const norm = homoglyph(sld);
  // "1" reads as either "l" (paypa1→paypal) or "i" (b1nance→binance) — try both.
  const normAlt = norm.replace(/l/g, "i");
  for (const b of BRANDS) {
    if (b.name.length < 4) continue;

    // Look-alike: normalizes exactly to the brand via a digit/glyph swap.
    if ((norm === b.name || normAlt === b.name) && sld !== b.name) {
      return {
        brand: b.name, display: b.display, official: b.domains[0],
        technique: "lookalike", confidence: "high",
        note: `Look-alike of ${b.display} (${b.domains[0]}) — likely impersonation.`,
      };
    }

    // Combosquat: brand name as a delimited token (paypal-login, secure-coinbase).
    const parts = sld.split(/[^a-z0-9]+/).filter(Boolean);
    if (parts.includes(b.name)) {
      return {
        brand: b.name, display: b.display, official: b.domains[0],
        technique: "combosquat", confidence: "medium",
        note: `Uses the ${b.display} name but isn't ${b.domains[0]} — possible impersonation.`,
      };
    }
  }
  return null;
}
