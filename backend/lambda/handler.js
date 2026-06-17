// Sytelens — Lambda entry point (Step 6).
// Orchestrates: cache check -> gather signals -> Anthropic analysis -> store -> return.
// Fronted by API Gateway (proxy integration, API-key auth handled at the gateway).

import { getCached, setCached } from "./cache.js";
import { gatherSignals } from "./signals.js";
import { checkSafeBrowsing } from "./safeBrowsing.js";
import { detectImpersonation, isKnownBrandDomain } from "./impersonation.js";
import { analyze, verdictForScore } from "./prompt.js";

// Canonical order/identity of the five protection checks shown in the panel.
const PROTECTION_ORDER = [
  "Adult Protection",
  "Identity & Privacy",
  "Suspicious Site",
  "Safe Shopping",
  "Anti-Phishing",
];

// Merge the model's protection assessments with the authoritative Safe Browsing
// feed. Safe Browsing can only ESCALATE to "risk" — it never weakens the AI read.
function reconcileProtections(aiProtections, sb) {
  const byCat = new Map(
    (aiProtections || [])
      .filter((p) => p && p.category)
      .map((p) => [p.category, { category: p.category, status: p.status || "na", note: p.note || "" }])
  );
  const out = PROTECTION_ORDER.map((cat) => byCat.get(cat) || { category: cat, status: "na", note: "Not assessed." });
  if (sb?.checked) {
    const find = (cat) => out.find((p) => p.category === cat);
    if (sb.threats.includes("SOCIAL_ENGINEERING")) {
      Object.assign(find("Anti-Phishing"), { status: "risk", note: "Flagged by Google Safe Browsing as phishing / social engineering." });
    } else {
      const ap = find("Anti-Phishing");
      ap.note = `${ap.note ? ap.note + " " : ""}(Google Safe Browsing: clean)`;
    }
    if (sb.threats.some((t) => ["MALWARE", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"].includes(t))) {
      Object.assign(find("Suspicious Site"), { status: "risk", note: "Flagged by Google Safe Browsing (malware / unwanted software)." });
    }
  }
  return out;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const reply = (statusCode, body) => ({ statusCode, headers: CORS, body: JSON.stringify(body) });

// Transparent scoring weights. Community Signals has no data source yet (0).
const WEIGHTS = { reputation: 0.4, domainSignals: 0.25, contentAnalysis: 0.35, community: 0 };

// Deterministic Reputation score from authoritative checks (Safe Browsing + impersonation).
function reputationScore(safeBrowsing, impersonation) {
  if (safeBrowsing?.checked && safeBrowsing.threats.length) return 0; // known threat
  if (impersonation?.confidence === "high") return 5; // homoglyph/IDN look-alike
  if (impersonation?.confidence === "medium") return 45; // combosquat
  return safeBrowsing?.checked ? 92 : 70; // clean-and-checked vs not checked
}

// Client-detected dark patterns are heuristic — clamp and trim before trusting them.
function sanitizeDarkPatterns(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .slice(0, 8)
    .map((d) => ({
      type: String(d?.type || "other").slice(0, 20),
      label: String(d?.label || "").slice(0, 60),
      evidence: String(d?.evidence || "").slice(0, 80),
    }))
    .filter((d) => d.label);
}

// Normalize a hostname to its registrable root (mirrors the extension, and
// guards against callers that send a full host or URL instead of a root domain).
function rootDomain(input) {
  if (!input) return null;
  let host = String(input).trim().toLowerCase();
  try {
    if (host.includes("://")) host = new URL(host).hostname;
  } catch {
    /* not a URL — treat as a bare host */
  }
  host = host.replace(/^www\./, "").split("/")[0].split(":")[0];
  return host || null;
}

export async function handler(event) {
  // CORS preflight.
  if (event?.requestContext?.http?.method === "OPTIONS" || event?.httpMethod === "OPTIONS") {
    return reply(204, {});
  }

  let payload;
  try {
    payload = typeof event.body === "string" ? JSON.parse(event.body) : event.body || {};
  } catch {
    return reply(400, { error: "Invalid JSON body" });
  }

  const domain = rootDomain(payload.domain);
  if (!domain) return reply(400, { error: "Missing or invalid 'domain'" });

  // Privacy: we accept only the root domain + minimal page signals — never a full
  // URL. Tracking parameters arrive as names only (no values).
  const page = {
    https: payload.https,
    trackerKeys: Array.isArray(payload.trackerKeys) ? payload.trackerKeys : [],
    pageTitle: payload.pageTitle || null,
    metaDescription: payload.metaDescription || null,
    contentSample: payload.contentSample || null,
    darkPatterns: sanitizeDarkPatterns(payload.darkPatterns),
  };

  const cacheOnly = payload.cacheOnly === true;       // lookup only — never analyze
  const forceRefresh = payload.forceRefresh === true; // re-analyze even if cached

  // 1. Cache read (skipped when forcing a refresh).
  if (!forceRefresh) {
    const cached = await getCached(domain);
    if (cached) return reply(200, { ...cached, found: true });
    if (cacheOnly) return reply(200, { found: false, domain }); // not yet rated — don't analyze
  }

  // 2-4. Gather signals → analyze → assemble verdict (cache miss or forced refresh).
  let verdict;
  try {
    // WHOIS and Safe Browsing are independent network calls — run them in
    // parallel so the slower of the two (not their sum) gates the AI step.
    // (We never receive the full URL/path; the SB check is domain-level.)
    const [signals, safeBrowsing] = await Promise.all([
      gatherSignals(domain, page),
      checkSafeBrowsing(`https://${domain}`),
    ]);
    const impersonation = detectImpersonation(domain);
    const knownBrand = isKnownBrandDomain(domain); // verified-legitimate official domain
    const ai = await analyze(domain, { ...signals, safeBrowsing, impersonation }, page);

    // --- Component scores → weighted total (the breakdown is the real math) ---
    const reputation = knownBrand ? 96 : reputationScore(safeBrowsing, impersonation);
    const domainSignals = ai.breakdown.domainSignals;
    const contentAnalysis = ai.breakdown.contentAnalysis;
    let score = Math.round(
      reputation * WEIGHTS.reputation +
        domainSignals * WEIGHTS.domainSignals +
        contentAnalysis * WEIGHTS.contentAnalysis
    );

    let redFlags = Array.isArray(ai.redFlags) ? [...ai.redFlags] : [];
    let greenSignals = Array.isArray(ai.greenSignals) ? [...ai.greenSignals] : [];
    const protections = reconcileProtections(ai.protections, safeBrowsing);
    const threatFlagged = safeBrowsing.checked && safeBrowsing.threats.length > 0;

    // Authoritative escalations force HIGH RISK regardless of the weighted total.
    if (threatFlagged) score = Math.min(score, 20);
    if (impersonation) {
      redFlags = [impersonation.note, ...redFlags.filter((f) => f !== impersonation.note)];
      const ap = protections.find((p) => p.category === "Anti-Phishing");
      if (impersonation.confidence === "high") {
        score = Math.min(score, 25);
        if (ap) Object.assign(ap, { status: "risk", note: impersonation.note });
      } else if (ap && ap.status === "pass") {
        ap.status = "caution";
        ap.note = impersonation.note;
      }
    }

    // --- Data confidence: how many signal sources actually had data ---
    const hasWhois = Boolean(signals.domainAge || signals.registrar);
    const hasContent = Boolean(page.pageTitle || page.metaDescription || page.contentSample);
    const present = [hasWhois, safeBrowsing.checked, hasContent].filter(Boolean).length;
    const missing = [];
    if (!hasWhois) missing.push("domain registration data");
    if (!safeBrowsing.checked) missing.push("Safe Browsing");
    if (!hasContent) missing.push("page content");
    const confidence = {
      level: present >= 3 ? "high" : present === 2 ? "medium" : "low",
      missing,
    };

    // Verified legitimate brand (and not actively flagged) → don't falsely caution.
    if (knownBrand && !threatFlagged) {
      score = Math.max(score, 90);
      greenSignals = [`Verified domain of ${knownBrand.display} — a recognized, established organization.`, ...greenSignals];
      const ap = protections.find((p) => p.category === "Anti-Phishing");
      if (ap && ap.status !== "risk") Object.assign(ap, { status: "pass", note: `Official ${knownBrand.display} domain.` });
      confidence.level = "high";
      confidence.missing = [];
    }

    const breakdown = [
      { label: "Reputation & Threats", weight: WEIGHTS.reputation, score: reputation, note: "Safe Browsing + impersonation checks" },
      { label: "Domain Signals", weight: WEIGHTS.domainSignals, score: domainSignals, note: "Age, registrar, HTTPS" },
      { label: "Content & Transparency", weight: WEIGHTS.contentAnalysis, score: contentAnalysis, note: "AI read of the page" },
      { label: "Community Signals", weight: WEIGHTS.community, score: null, note: "Coming soon" },
    ];

    verdict = {
      domain,
      score,
      verdict: verdictForScore(score),
      confidence,
      breakdown,
      summary: ai.summary,
      whatItIs: ai.whatItIs,
      redFlags,
      greenSignals,
      similarSites: ai.similarSites,
      protections,
      kidsSafety: ai.kidsSafety,
      safeBrowsing: safeBrowsing.checked ? safeBrowsing.threats : null,
      darkPatterns: page.darkPatterns,
      impersonation: impersonation || null,
      urlParams: signals.urlParams,
      https: signals.https,
      domainAge: signals.domainAge,
      registrar: signals.registrar,
      recentlyTransferred: signals.recentlyTransferred,
      analyzedAt: new Date().toISOString(),
      cached: false,
      found: true,
    };
  } catch (err) {
    console.error("[handler] analysis failed for", domain, err);
    return reply(502, { error: "Analysis failed", domain });
  }

  // 5. Store (non-fatal on failure) and return.
  await setCached(domain, verdict);
  return reply(200, verdict);
}
