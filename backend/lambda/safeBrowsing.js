// Sytelens — Google Safe Browsing lookup (authoritative phishing/malware feed).
// Free API: enable "Safe Browsing API" in Google Cloud and create an API key.
// Docs: https://developers.google.com/safe-browsing/v4/lookup-api

const SB_KEY = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
const SB_ENDPOINT = "https://safebrowsing.googleapis.com/v4/threatMatches:find";

const THREAT_TYPES = [
  "MALWARE",
  "SOCIAL_ENGINEERING", // phishing / deceptive
  "UNWANTED_SOFTWARE",
  "POTENTIALLY_HARMFUL_APPLICATION",
];

/**
 * Check a URL against Google Safe Browsing.
 * Returns { checked, threats } — `checked:false` if no key or on failure
 * (analysis proceeds; the AI assessment stands alone in that case).
 */
export async function checkSafeBrowsing(url) {
  if (!SB_KEY || !url) return { checked: false, threats: [] };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000); // don't let a slow lookup eat the budget
  try {
    const res = await fetch(`${SB_ENDPOINT}?key=${SB_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        client: { clientId: "sytelens", clientVersion: "0.1.0" },
        threatInfo: {
          threatTypes: THREAT_TYPES,
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: [{ url }],
        },
      }),
    });
    if (!res.ok) {
      console.warn("[safeBrowsing] HTTP", res.status);
      return { checked: false, threats: [] };
    }
    const data = await res.json();
    const threats = [...new Set((data.matches || []).map((m) => m.threatType))];
    return { checked: true, threats };
  } catch (err) {
    console.warn("[safeBrowsing] lookup failed/timed out:", String(err));
    return { checked: false, threats: [] };
  } finally {
    clearTimeout(timer);
  }
}
