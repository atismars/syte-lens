// Sytelens — background service worker (Manifest V3)
//
// Detects when a tab settles on a new root domain, fetches a trust verdict from
// the backend (with a per-session cache), colors the toolbar icon, and serves
// verdicts to the side panel.

import { CONFIG } from "./config.js";

// A small public-suffix list covering the common multi-label TLDs. The full
// Public Suffix List is large; this handles the cases a naive "last two labels"
// split would get wrong (e.g. example.co.uk -> co.uk, not co.uk's parent).
const MULTI_PART_SUFFIXES = new Set([
  "co.uk", "org.uk", "me.uk", "gov.uk", "ac.uk", "ltd.uk", "plc.uk", "net.uk",
  "com.au", "net.au", "org.au", "edu.au", "gov.au", "id.au",
  "co.nz", "net.nz", "org.nz", "govt.nz",
  "co.za", "org.za",
  "co.jp", "or.jp", "ne.jp", "ac.jp", "go.jp",
  "com.br", "net.br", "org.br", "gov.br",
  "com.cn", "net.cn", "org.cn", "gov.cn",
  "co.in", "net.in", "org.in", "gov.in",
  "com.mx", "com.sg", "com.hk", "com.tr", "com.tw", "com.ar", "com.co",
]);

/**
 * Extract the root (registrable) domain from a URL, or null for non-web URLs
 * (chrome://, about:, file://, extensions) and bare IPs/single-label hosts.
 */
export function getRootDomain(url) {
  let host;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    host = parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
  if (!host) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) return host;

  const labels = host.split(".");
  if (labels.length <= 2) return host;
  const lastTwo = labels.slice(-2).join(".");
  const lastThree = labels.slice(-3).join(".");
  return MULTI_PART_SUFFIXES.has(lastTwo) ? lastThree : lastTwo;
}

const configured = () => Boolean(CONFIG.endpoint && CONFIG.apiKey);

// Known tracking-param names. We extract only the KEYS present in a URL (never
// values, never the URL itself) so the backend can flag ad/funnel tracking.
const TRACKER_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id",
  "fbclid", "fbc_id", "gclid", "gbraid", "wbraid", "msclkid", "ttclid", "twclid",
  "li_fat_id", "mc_eid", "igshid", "ref", "aff_id", "affid", "lp",
]);

function extractTrackerKeys(url) {
  if (!url) return [];
  try {
    const out = [];
    for (const k of new URL(url).searchParams.keys()) {
      if (TRACKER_PARAMS.has(k.toLowerCase())) out.push(k);
    }
    return [...new Set(out)];
  } catch {
    return [];
  }
}

// ── per-session verdict cache (chrome.storage.session) ──────────────
const cacheKey = (domain) => `verdict:${domain}`;

async function getSessionVerdict(domain) {
  const key = cacheKey(domain);
  const got = await chrome.storage.session.get(key);
  return got[key] || null;
}

async function setSessionVerdict(domain, verdict) {
  await chrome.storage.session.set({ [cacheKey(domain)]: verdict });
}

// ── toolbar icon ────────────────────────────────────────────────────
const COLOR_FOR_VERDICT = { SAFE: "green", CAUTION: "yellow", "HIGH RISK": "red" };

function applyIcon(tabId, verdict) {
  if (typeof tabId !== "number") return;
  const color = COLOR_FOR_VERDICT[verdict] || "grey"; // grey = analyzing / unknown
  const path = {
    16: `icons/${color}-16.png`,
    32: `icons/${color}-32.png`,
    48: `icons/${color}-48.png`,
    128: `icons/${color}-128.png`,
  };
  try {
    // Callback form + reading lastError: the tab can be closed or navigated
    // away while a slow analysis is in flight, and setIcon then reports
    // "No tab with id". Reading lastError marks it handled (no console spam).
    chrome.action.setIcon({ tabId, path }, () => void chrome.runtime.lastError);
  } catch {
    /* tab gone */
  }
}

// ── analysis ────────────────────────────────────────────────────────
const inFlight = new Set(); // domains currently being analyzed

// Collect minimal page signals by injecting into the active tab. Needs the
// activeTab grant (from the user clicking the toolbar icon), so page content is
// read only for the tab the user explicitly analyzes. Self-contained on purpose:
// executeScript serializes this function, so it cannot reference outer scope.
function collectPageSignals() {
  function detectDarkPatterns() {
    const out = [];
    const add = (type, label, evidence) => {
      if (out.length < 8) out.push({ type, label, evidence: String(evidence).slice(0, 80) });
    };
    try {
      const text = (document.body?.innerText || "").replace(/\s+/g, " ");
      const urgency = text.match(/\b(limited[- ]time|act now|hurry|don'?t miss|last chance|offer ends|ends (soon|today|tonight)|today only|flash sale|while supplies last|expires? (soon|today))\b/i);
      if (urgency) add("urgency", "Urgency language", urgency[0]);
      const scarcity = text.match(/\b(only \d+ (left|remaining|in stock)|\d+ (people|others|shoppers) (viewing|watching|bought|are looking)|selling (fast|out)|low stock|almost (gone|sold out)|\d+ left at this price)\b/i);
      if (scarcity) add("scarcity", "Fake scarcity / stock pressure", scarcity[0]);
      const timer = text.match(/\b\d{1,2}:\d{2}(:\d{2})?\b/);
      if (timer && (urgency || /count\s?down|timer|deal ends|sale ends/i.test(text))) add("timer", "Countdown timer", timer[0]);
      const overlays = [...document.querySelectorAll('[role="dialog"], [class*="modal" i], [class*="popup" i], [class*="overlay" i], [id*="modal" i], [id*="popup" i]')].filter((el) => {
        const s = getComputedStyle(el);
        if (s.display === "none" || s.visibility === "hidden" || parseFloat(s.opacity) === 0) return false;
        const r = el.getBoundingClientRect();
        return r.width > 200 && r.height > 150 && (s.position === "fixed" || s.position === "absolute");
      });
      if (overlays.length > 0) add("popup", "Popup / modal overlay", `${overlays.length} overlay${overlays.length > 1 ? "s" : ""} on load`);
    } catch {
      /* never let detection break the page */
    }
    return out;
  }
  const metaDescription =
    document.querySelector('meta[name="description"]')?.content ||
    document.querySelector('meta[property="og:description"]')?.content ||
    "";
  const contentSample = (document.body?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 500);
  return { pageTitle: document.title || "", metaDescription, contentSample, darkPatterns: detectDarkPatterns() };
}

async function getPageSignals(tabId) {
  try {
    const [injection] = await chrome.scripting.executeScript({ target: { tabId }, func: collectPageSignals });
    return injection?.result || {};
  } catch {
    return {}; // no activeTab grant (tab not user-invoked) or a restricted page
  }
}

function broadcast(message) {
  chrome.runtime.sendMessage(message).catch(() => {}); // no listener (panel closed) is fine
}

// POST to the backend with a hard timeout so a hung/slow request fails
// deterministically (rather than leaving the icon grey forever). The API
// Gateway itself returns a 504 at ~29s; we abort a touch later as a backstop.
async function postBackend(body, timeoutMs = 30000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(CONFIG.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": CONFIG.apiKey },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function analyzeDomain(tabId, domain, { force = false } = {}) {
  if (inFlight.has(domain)) return;
  inFlight.add(domain);
  try {
    // Derive HTTPS + tracker keys from the tab URL in the worker — the URL itself
    // never leaves the browser; only the root domain + tracker names are sent.
    let tabUrl = null;
    try {
      tabUrl = (await chrome.tabs.get(tabId))?.url || null;
    } catch {
      /* tab closed */
    }
    const https = tabUrl ? tabUrl.startsWith("https:") : null;
    const trackerKeys = extractTrackerKeys(tabUrl);
    const page = await getPageSignals(tabId); // { pageTitle, metaDescription, contentSample }

    const res = await postBackend({ domain, https, trackerKeys, ...page, forceRefresh: force });
    if (!res.ok) throw new Error(`backend ${res.status}`);
    const verdict = await res.json();
    await setSessionVerdict(domain, verdict);
    applyIcon(tabId, verdict.verdict);
    broadcast({ type: "SYTELENS_VERDICT", status: "ready", tabId, domain, verdict });
  } catch (err) {
    // Backend latency/timeouts (e.g. a 504) and aborts are expected and
    // recoverable, so log as a warning rather than a hard error. The panel
    // still gets an error status to show.
    console.warn("[Sytelens] analysis failed for", domain, String(err));
    applyIcon(tabId, null);
    broadcast({ type: "SYTELENS_VERDICT", status: "error", tabId, domain, error: String(err) });
  } finally {
    inFlight.delete(domain);
  }
}

// "Show ratings for already-rated sites" — default ON. A cache-only lookup on
// visit, never a full analysis.
async function getKnownSiteCheck() {
  try {
    return (await chrome.storage.local.get("knownSiteCheck")).knownSiteCheck !== false;
  } catch {
    return true;
  }
}

const STALE_MS = 7 * 24 * 60 * 60 * 1000; // re-analyze a record older than 7 days
const isStale = (v) => !v?.analyzedAt || Date.now() - new Date(v.analyzedAt).getTime() > STALE_MS;

// Cache-only backend lookup: sends the domain only (no page data), never runs an
// analysis. Returns the stored verdict if the site was already rated, else null.
async function cacheCheck(domain) {
  if (!configured()) return null;
  try {
    // Cache-only lookup is a quick DynamoDB read; keep its timeout short.
    const res = await postBackend({ domain, cacheOnly: true }, 10000);
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.found ? data : null;
  } catch {
    return null;
  }
}

// Color the icon for an already-rated site (cache only). Grey if not yet rated.
async function passiveColor(tabId, domain) {
  const session = await getSessionVerdict(domain);
  if (session) {
    applyIcon(tabId, session.verdict);
    return;
  }
  const found = await cacheCheck(domain);
  if (found) {
    await setSessionVerdict(domain, found);
    applyIcon(tabId, found.verdict);
  } else {
    applyIcon(tabId, null); // grey — not yet rated
  }
}

// Remember the last domain reported per tab to skip redundant work on repeated
// "complete" events and in-page (hash) navigation.
const lastDomainByTab = new Map();

// On each visit, the default "known-site check" colors the icon from the shared
// cache only (a domain-only lookup, no page access, no analysis). A full analysis
// runs only when the user clicks the toolbar icon. Skippable in settings.
async function onVisit(tabId, url) {
  const domain = getRootDomain(url);
  if (!domain) {
    lastDomainByTab.delete(tabId);
    applyIcon(tabId, null);
    return;
  }
  if (lastDomainByTab.get(tabId) === domain) return;
  lastDomainByTab.set(tabId, domain);

  if (await getKnownSiteCheck()) {
    passiveColor(tabId, domain).catch(() => {}); // cache-only color (no analysis)
  } else {
    applyIcon(tabId, null);
  }
}

// ── current verdict for a tab (used by the side panel) ──────────────
async function verdictForTab(tabId) {
  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    return { status: "unsupported" };
  }
  const domain = getRootDomain(tab.url);
  if (!domain) return { status: "unsupported" };
  if (!configured()) return { status: "unconfigured", domain };

  // Prefer the session, then a cache-only backend lookup, before any analysis.
  let cached = await getSessionVerdict(domain);
  if (!cached) {
    const found = await cacheCheck(domain);
    if (found) {
      cached = found;
      await setSessionVerdict(domain, found);
    }
  }
  if (cached) {
    applyIcon(tabId, cached.verdict);
    // Refresh in the background only if the record is stale (older than 7 days).
    if (isStale(cached)) analyzeDomain(tabId, domain, { force: true }).catch(() => {});
    return { status: "ready", domain, verdict: cached };
  }

  // Not rated yet → run a full analysis now (the panel was opened).
  applyIcon(tabId, null);
  analyzeDomain(tabId, domain).catch(() => {});
  return { status: "analyzing", domain };
}

// ── event wiring ────────────────────────────────────────────────────
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) onVisit(tabId, changeInfo.url);
  else if (changeInfo.status === "complete" && tab.url) onVisit(tabId, tab.url);
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url) onVisit(tabId, tab.url);
  } catch {
    /* tab closed */
  }
});

chrome.tabs.onRemoved.addListener((tabId) => lastDomainByTab.delete(tabId));

// Side panel asks for the active tab's verdict.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "SYTELENS_GET_VERDICT" && typeof msg.tabId === "number") {
    verdictForTab(msg.tabId).then(sendResponse);
    return true; // async response
  }
});

// Toolbar click opens the side panel for the active tab. Handling the click
// ourselves (rather than openPanelOnActionClick) ensures it counts as a user
// invocation, which grants the activeTab access we use to read that tab's page
// content for a full analysis.
chrome.action.onClicked.addListener((tab) => {
  if (typeof tab?.id !== "number") return;
  chrome.sidePanel
    .open({ tabId: tab.id })
    .catch((err) => console.warn("[Sytelens] sidePanel open failed:", err));
});

console.log("[Sytelens] service worker started", configured() ? "(configured)" : "(NOT configured)");
