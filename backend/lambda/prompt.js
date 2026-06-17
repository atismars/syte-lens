// Sytelens — Anthropic prompt builder + caller.
// Uses the official SDK with structured outputs (output_config.format) so the
// model returns a schema-valid JSON object — no fragile free-text parsing.
//
// Scoring is COMPONENT-BASED: the model returns sub-scores (domainSignals,
// contentAnalysis); the handler combines them with a deterministic Reputation
// score into a weighted total, so the score breakdown shown to users is real.

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-6";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

// Stable instruction block — sent as the system prompt (cache-friendly).
const SYSTEM_PROMPT = `You are a website trust analyst. Analyze the domain described in the user message and return ONLY a JSON object matching the provided schema.

In "breakdown", score two components from 0-100 (higher = more trustworthy):
- "domainSignals": from the domain's age, registrar, and HTTPS. Old, established domains with reputable registrars and HTTPS score high; brand-new, privacy-shielded, or non-HTTPS domains score low. If domain age and registrar are both unknown, score around 50 (neutral) — do not assume the worst from missing data.
- "contentAnalysis": from the page's content, transparency, claims, and any dark patterns. Transparent, substantive, non-deceptive content scores high; vague, hype-heavy, scam-like, or dark-pattern-laden content scores low. If there is little page content, score around 50.

Do NOT penalize a widely-recognized, established, legitimate company or product merely for thin page content or missing metadata — judge it on its real-world reputation. If a domain is old but was recently updated/transferred, do not assume long-standing trust from age alone; it may be newly operated.

Do NOT output an overall score or verdict — those are computed from your component scores plus reputation databases.

Keep "summary" to one plain-language sentence (max 25 words). Base your assessment only on the signals provided; do not invent facts. Treat detected dark patterns (countdown timers, fake scarcity, urgency language, aggressive popups) as negative signals — lower contentAnalysis and include them in redFlags.

If the domain looks like a typosquat or look-alike of a well-known brand (major tech, finance, bank, shipping, or crypto company) — a misspelling, character swap, or the brand's name combined with extra words — treat it as likely phishing: lower the scores sharply, add a red flag, and set the Anti-Phishing protection to "risk", even if no heuristic match is provided above.

For "similarSites", list up to 5 well-known, established, legitimate websites in the same category or industry as this domain — peers or alternatives the user is likely to recognize. Use real, widely-known domains (e.g. {"name":"Stripe","url":"stripe.com"}). Return an empty array if no clear category applies.

For "kidsSafety", rate the site for children:
- "ageRating": the minimum appropriate age — "All Ages", "7+", "13+", "16+", or "18+".
- "summary": one short sentence on whether and why it's suitable for kids.
- "categories": return all six of these objects, each with a "level" of "none", "mild", or "present": Sexual content, Violence, Profanity, Drugs & alcohol, Gambling, Scary content.
- "contactRisk": can strangers contact the child here? level "none"/"caution"/"risk" + short note. Risk = chat, direct messages, livestreaming, or unmoderated user-generated content / comments where adults can reach children.
- "monetizationRisk": kid-targeted manipulation. level + note. Risk = loot boxes, virtual-currency or "free Robux / V-Bucks"-style scams, aggressive in-app-purchase pressure, or ads clearly aimed at children.
- "childPrivacy": does it collect personal data from minors or raise COPPA concerns? level + note.
Judge by the site's actual content and purpose. Be conservative when content is unknown, but don't assume the worst for clearly reputable mainstream sites (a major bank or search engine is "All Ages" even with little page text).

For "protections", return exactly these five objects, in this order. Each has a "status" of "pass" (good), "caution" (some concern), "risk" (problem), or "na" (not applicable), plus a short "note":
1. "Adult Protection" — is this adult/NSFW content? pass = clearly not adult; risk = adult content; na = cannot tell from the signals.
2. "Identity & Privacy" — how much personal data does it collect and how transparent is its privacy posture? Consider the tracking parameters present.
3. "Suspicious Site" — deceptive or scam patterns.
4. "Safe Shopping" — if this is an e-commerce/checkout site, is it safe to buy from? Use "na" if it is not a shopping site.
5. "Anti-Phishing" — credential harvesting, brand impersonation, or lookalike domains. Weigh the Google Safe Browsing result heavily.`;

// JSON Schema for the model output. Structured-output schemas require
// additionalProperties:false on every object and disallow range constraints.
const VERDICT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    breakdown: {
      type: "object",
      additionalProperties: false,
      properties: {
        domainSignals: { type: "integer" },
        contentAnalysis: { type: "integer" },
      },
      required: ["domainSignals", "contentAnalysis"],
    },
    summary: { type: "string" },
    whatItIs: { type: "array", items: { type: "string" } },
    redFlags: { type: "array", items: { type: "string" } },
    greenSignals: { type: "array", items: { type: "string" } },
    similarSites: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { name: { type: "string" }, url: { type: "string" } },
        required: ["name", "url"],
      },
    },
    protections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          category: {
            type: "string",
            enum: ["Adult Protection", "Identity & Privacy", "Suspicious Site", "Safe Shopping", "Anti-Phishing"],
          },
          status: { type: "string", enum: ["pass", "caution", "risk", "na"] },
          note: { type: "string" },
        },
        required: ["category", "status", "note"],
      },
    },
    kidsSafety: {
      type: "object",
      additionalProperties: false,
      properties: {
        ageRating: { type: "string", enum: ["All Ages", "7+", "13+", "16+", "18+"] },
        summary: { type: "string" },
        categories: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              category: {
                type: "string",
                enum: ["Sexual content", "Violence", "Profanity", "Drugs & alcohol", "Gambling", "Scary content"],
              },
              level: { type: "string", enum: ["none", "mild", "present"] },
            },
            required: ["category", "level"],
          },
        },
        contactRisk: {
          type: "object",
          additionalProperties: false,
          properties: { level: { type: "string", enum: ["none", "caution", "risk"] }, note: { type: "string" } },
          required: ["level", "note"],
        },
        monetizationRisk: {
          type: "object",
          additionalProperties: false,
          properties: { level: { type: "string", enum: ["none", "caution", "risk"] }, note: { type: "string" } },
          required: ["level", "note"],
        },
        childPrivacy: {
          type: "object",
          additionalProperties: false,
          properties: { level: { type: "string", enum: ["none", "caution", "risk"] }, note: { type: "string" } },
          required: ["level", "note"],
        },
      },
      required: ["ageRating", "summary", "categories", "contactRisk", "monetizationRisk", "childPrivacy"],
    },
  },
  required: ["breakdown", "summary", "whatItIs", "redFlags", "greenSignals", "similarSites", "protections", "kidsSafety"],
};

// Render the per-domain data the model reasons over.
function buildUserPrompt(domain, signals, page) {
  const params = (signals.urlParams || []).map((p) => p.key).join(", ") || "none";
  const sb = signals.safeBrowsing;
  const sbLine = !sb || !sb.checked
    ? "not checked"
    : sb.threats.length
      ? `THREATS FOUND: ${sb.threats.join(", ")}`
      : "no threats found";
  return [
    `Domain: ${domain}`,
    `Domain age: ${signals.domainAge ?? "unknown"}`,
    `Registrar: ${signals.registrar ?? "unknown"}`,
    `Domain last updated: ${signals.updated ?? "unknown"}${signals.recentlyTransferred ? " (old domain, recently updated — may be newly operated)" : ""}`,
    `HTTPS: ${signals.https === null || signals.https === undefined ? "unknown" : signals.https ? "yes" : "no"}`,
    `Google Safe Browsing: ${sbLine}`,
    `Dark patterns detected on page: ${(page.darkPatterns || []).map((d) => d.label).join(", ") || "none detected"}`,
    `Possible brand impersonation (heuristic): ${signals.impersonation ? signals.impersonation.note : "none detected"}`,
    `URL tracking parameters: ${params}`,
    `Page title: ${page.pageTitle ?? "unknown"}`,
    `Meta description: ${page.metaDescription ?? "unknown"}`,
    `Page content sample (first 500 chars): ${(page.contentSample ?? "").slice(0, 500) || "unknown"}`,
  ].join("\n");
}

// Map a 0–100 score to a verdict label (string). Thresholds per SYTELENS_BRIEF.md.
function verdictForScore(score) {
  if (score >= 85) return "SAFE";
  if (score >= 40) return "CAUTION";
  return "HIGH RISK";
}

const clampInt = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

/**
 * Call Claude and return the parsed model fields (component sub-scores +
 * narrative). The overall score/verdict are computed by the handler.
 * Throws on refusal or unparseable output.
 */
export async function analyze(domain, signals, page = {}) {
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 1200, // enough for the full schema; trimmed from 1600 to cap worst-case output time

    // The system prompt is large (~1.5k tokens) and identical on every call —
    // cache it so repeat requests skip re-processing it (cheaper, slightly faster).
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    thinking: { type: "disabled" },
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: VERDICT_SCHEMA },
    },
    messages: [{ role: "user", content: buildUserPrompt(domain, signals, page) }],
  });

  if (resp.stop_reason === "refusal") {
    throw new Error("Model refused to analyze this domain");
  }
  const text = resp.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("No text content in model response");

  const parsed = JSON.parse(text); // output_config.format guarantees valid JSON

  return {
    breakdown: {
      domainSignals: clampInt(parsed.breakdown?.domainSignals),
      contentAnalysis: clampInt(parsed.breakdown?.contentAnalysis),
    },
    summary: parsed.summary,
    whatItIs: Array.isArray(parsed.whatItIs) ? parsed.whatItIs : [],
    redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : [],
    greenSignals: Array.isArray(parsed.greenSignals) ? parsed.greenSignals : [],
    similarSites: Array.isArray(parsed.similarSites)
      ? parsed.similarSites.filter((s) => s && s.name && s.url)
      : [],
    protections: Array.isArray(parsed.protections) ? parsed.protections : [],
    kidsSafety: parsed.kidsSafety || null,
  };
}

export { buildUserPrompt, verdictForScore, VERDICT_SCHEMA };
