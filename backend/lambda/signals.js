// Sytelens — signal aggregation: WHOIS lookup (apilayer.com) + URL tracking-param parser.
// Node.js runtime provides a global fetch(), so no HTTP client dependency is needed.

const WHOIS_API_KEY = process.env.WHOIS_API_KEY;
const WHOIS_ENDPOINT = "https://api.apilayer.com/whois/query"; // GET ?domain= (full record)

// Negative cache (module scope → persists across warm invocations). When WHOIS
// fails or times out for a domain, remember it so we don't pay the timeout again
// on every cache miss for that domain for a while (e.g. a slow .ai domain being
// analyzed by several users before the verdict is cached).
const whoisFailures = new Map(); // domain -> epoch ms of last failure
const WHOIS_FAIL_TTL = 6 * 60 * 60 * 1000; // 6 hours

function whoisRecentlyFailed(domain) {
  const at = whoisFailures.get(domain);
  if (!at) return false;
  if (Date.now() - at > WHOIS_FAIL_TTL) {
    whoisFailures.delete(domain);
    return false;
  }
  return true;
}

// Known ad / attribution tracking parameters and what they signify.
const TRACKING_PARAMS = {
  utm_source: "Campaign source",
  utm_medium: "Campaign medium",
  utm_campaign: "Campaign name",
  utm_term: "Paid keyword",
  utm_content: "Ad creative tracking",
  utm_id: "Campaign ID",
  fbclid: "Facebook click attribution",
  fbc_id: "Facebook click ID",
  gclid: "Google Ads click ID",
  gbraid: "Google Ads (iOS) click ID",
  wbraid: "Google Ads (web→app) click ID",
  msclkid: "Microsoft Ads click ID",
  ttclid: "TikTok click ID",
  twclid: "Twitter/X click ID",
  li_fat_id: "LinkedIn click ID",
  mc_eid: "Mailchimp recipient ID",
  igshid: "Instagram share ID",
  ref: "Referral tracking",
  aff_id: "Affiliate ID",
  affid: "Affiliate ID",
  lp: "Landing page variant",
};

/**
 * Map tracking-parameter KEYS (extracted client-side) to display objects.
 * For privacy we receive only the param names, never their values or the full URL.
 * Returns [{ key, note }].
 */
export function trackerKeysToParams(keys) {
  if (!Array.isArray(keys)) return [];
  return keys.map((key) => ({
    key,
    note: TRACKING_PARAMS[String(key).toLowerCase()] || "Tracking parameter",
  }));
}

// WHOIS date fields are sometimes a string, sometimes an array of strings.
function firstDate(v) {
  if (Array.isArray(v)) return v[0] || null;
  return v || null;
}

// Format the span between a date and now as a coarse human string.
function ageFromDate(date) {
  if (!date) return null;
  const created = new Date(date);
  if (Number.isNaN(created.getTime())) return null;
  const days = Math.floor((Date.now() - created.getTime()) / 86400000);
  if (days < 0) return null;
  if (days < 45) return `${days} days`;
  const months = Math.floor(days / 30);
  if (months < 18) return `${months} months`;
  return `${Math.floor(days / 365)} years`;
}

// An old domain updated recently likely changed hands / re-registered — so its
// "age" reflects the domain, not the current operator. Heuristic, phrased softly.
function isRecentTransfer(created, updated) {
  if (!created || !updated) return false;
  const c = new Date(created), u = new Date(updated);
  if (Number.isNaN(c.getTime()) || Number.isNaN(u.getTime())) return false;
  const ageYears = (Date.now() - c.getTime()) / (365 * 86400000);
  const updatedMonths = (Date.now() - u.getTime()) / (30 * 86400000);
  return ageYears > 3 && updatedMonths < 18;
}

/**
 * Fetch domain registration signals from apilayer.com's WHOIS API.
 * Returns { domainAge, registrar, updated, recentlyTransferred }.
 * Network/auth failures resolve to nulls (analysis proceeds without WHOIS).
 */
export async function fetchWhois(domain) {
  const empty = { domainAge: null, registrar: null, updated: null, recentlyTransferred: false };
  if (!WHOIS_API_KEY) {
    console.warn("[signals] WHOIS_API_KEY not set — skipping WHOIS lookup");
    return empty;
  }
  // Skip the call entirely if this domain's WHOIS recently failed/timed out.
  if (whoisRecentlyFailed(domain)) return empty;

  // Hard timeout: apilayer's WHOIS is slow for some TLDs (notably .ai), and a
  // hung lookup is the main cause of the whole request exceeding API Gateway's
  // 29s limit (a 504). Cap it and proceed without WHOIS if it's too slow.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${WHOIS_ENDPOINT}?domain=${encodeURIComponent(domain)}`, {
      headers: { apikey: WHOIS_API_KEY },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      console.warn("[signals] WHOIS HTTP", res.status, "for", domain);
      whoisFailures.set(domain, Date.now());
      return empty;
    }
    const data = await res.json();
    const r = data?.result || data || {};
    const created = firstDate(r.creation_date || r.created_date);
    const updated = firstDate(r.updated_date || r.updated);
    whoisFailures.delete(domain); // success — clear any prior failure mark
    return {
      domainAge: ageFromDate(created),
      registrar: r.registrar || null,
      updated,
      recentlyTransferred: isRecentTransfer(created, updated),
    };
  } catch (err) {
    console.warn("[signals] WHOIS failed/timed out for", domain, String(err));
    whoisFailures.set(domain, Date.now());
    return empty;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Gather all signals for a domain: WHOIS + tracking params + HTTPS.
 * `page` carries client-provided signals: { https, trackerKeys, pageTitle, ... }.
 * No full URL is ever received — only the root domain + tracking-param names.
 */
export async function gatherSignals(domain, page = {}) {
  const whois = await fetchWhois(domain);
  return {
    domainAge: whois.domainAge,
    registrar: whois.registrar,
    updated: whois.updated,
    recentlyTransferred: whois.recentlyTransferred,
    https: page.https ?? null,
    urlParams: trackerKeysToParams(page.trackerKeys),
  };
}
