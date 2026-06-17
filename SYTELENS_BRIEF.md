# Sytelens — Claude Code Project Brief

## What We're Building
A Chrome extension that analyzes website legitimacy using AI and displays a color-coded verdict
(GREEN / YELLOW / RED) with detailed reasoning in a Chrome Side Panel.

Open source. No monetization. Brand project for ATIS MARS (atismars.co).

---

## Core Behavior
1. User navigates to any URL
2. Extension extracts the **root domain** (not full URL)
3. Checks **shared DynamoDB cache** by domain key
4. **Cache hit** → return stored verdict instantly, zero API cost
5. **Cache miss** → aggregate signals → call Anthropic API → store result → return to extension
6. Extension icon in toolbar updates color based on verdict
7. User clicks icon → Chrome Side Panel opens from right with full analysis

---

## Architecture

```
Chrome Extension (Manifest V3)
  └── Background Service Worker  ← detects new domain on tab update
  └── Side Panel (React)         ← renders verdict on user click
  └── Content Script             ← extracts page signals (title, meta, visible text sample)
         │
         ▼
AWS API Gateway (HTTPS endpoint, API key auth)
         │
         ▼
AWS Lambda (Node.js 20)
  ├── 1. Check DynamoDB cache (key: domain, TTL: 30 days)
  ├── 2. If miss: fetch WHOIS data + parse URL params + receive page signals
  ├── 3. Build prompt → call Anthropic API
  ├── 4. Parse structured JSON response
  └── 5. Write to DynamoDB + return verdict
         │
         ▼
DynamoDB Table: sytelens-cache
  PK: domain (string)
  TTL: 30-day epoch timestamp
  Fields: score, verdict, summary, whatItIs[], redFlags[], greenSignals[], urlParams[], domainAge, registrar, hosting, analyzedAt
         │
         ▼
Anthropic API (claude-sonnet-4-6)
  Input:  ~1,000 tokens (domain + signals)
  Output: ~500 tokens (structured JSON verdict)
  Cost:   ~$0.01 per unique domain
```

---

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Extension | Manifest V3, React (side panel) | Vanilla JS for background worker |
| Backend | AWS Lambda, Node.js 20 | Existing AWS account |
| Cache | AWS DynamoDB | TTL native, shared across all users |
| AI | Anthropic claude-sonnet-4-6 | Structured JSON output |
| Domain signals | whoisjsonapi.com | Domain age, registrar |
| Auth | API Gateway API key | Simple, no user accounts |
| Source | GitHub, MIT license | Open source |

---

## Project Structure

```
sytelens/
├── extension/
│   ├── manifest.json
│   ├── background.js          # Service worker — tab listener, cache check, API call
│   ├── sidepanel/
│   │   ├── index.html
│   │   ├── index.jsx          # React side panel UI
│   │   └── components/
│   │       ├── ScoreRing.jsx
│   │       ├── Section.jsx
│   │       └── ToolbarBadge.jsx
│   ├── content.js             # Page signal extractor
│   └── icons/                 # 16, 32, 48, 128px shield icons (green/yellow/red/grey)
│
├── backend/
│   ├── lambda/
│   │   ├── handler.js         # Main Lambda entry point
│   │   ├── cache.js           # DynamoDB get/set
│   │   ├── signals.js         # WHOIS fetch + URL param parser
│   │   └── prompt.js          # Anthropic prompt builder + caller
│   ├── template.yaml          # AWS SAM template
│   └── package.json
│
├── docs/
│   ├── architecture.md
│   └── prompt-design.md
│
└── README.md
```

---

## Anthropic Prompt Design

### Input (built in `prompt.js`)
```
You are a website trust analyst. Analyze the following domain and return ONLY a JSON object.

Domain: {domain}
Domain age: {domainAge}
Registrar: {registrar}
Hosting: {hosting}
HTTPS: {https}
URL tracking parameters: {urlParams}
Page title: {pageTitle}
Meta description: {metaDescription}
Page content sample (first 500 chars): {contentSample}

Return this exact JSON structure, no other text:
{
  "score": <0-100 integer>,
  "verdict": <"SAFE" | "CAUTION" | "HIGH RISK">,
  "summary": <one sentence, plain language, max 25 words>,
  "whatItIs": [<3-5 bullet strings describing what this site actually is and does>],
  "redFlags": [<0-8 specific concern strings, empty array if none>],
  "greenSignals": [<1-6 positive indicator strings>],
  "urlParams": [<{key, note} objects for any tracking params detected>],
  "domainAge": <string>,
  "registrar": <string>,
  "hosting": <string>
}

Scoring guide:
85-100: Established, transparent, no deceptive patterns
40-84:  Some signals unclear — new domain, ad funnel, limited transparency
0-39:   Known scam patterns, no operator identity, deceptive claims
```

---

## Verdict Color Logic

| Score | Verdict | Icon Color | Side Panel Accent |
|---|---|---|---|
| 85–100 | SAFE | #22C55E (green) | Green left border |
| 40–84 | CAUTION | #F59E0B (amber) | Amber left border |
| 0–39 | HIGH RISK | #EF4444 (red) | Red left border |
| pending | ANALYZING | #64748B (grey) | Pulsing grey |

---

## Side Panel Information Hierarchy

1. **Header** — Sytelens logo + "by ATIS MARS" + close button
2. **Site identity** — favicon, domain (monospace), verdict badge, cached/live indicator
3. **Score ring** — circular arc 0–100, colored by verdict
4. **Summary** — one-sentence plain English verdict, left-bordered card
5. **What It Actually Is** — 3–5 bullets, factual breakdown (▸ prefix, blue)
6. **Domain Signals** — age, registrar, hosting, HTTPS (key-value grid)
7. **Ad Tracking Detected** — URL params table with amber badge count (hidden if none)
8. **Red Flags** — ✕ bullets in subtle red (hidden if none)
9. **Positive Signals** — ✓ bullets in green
10. **Footer** — "Report incorrect verdict" + GitHub link

---

## Key Constraints

- **Cache key is root domain only** — `getfractionalfreedom.com`, not the full URL
- **Trigger on tab update**, not every page load event — avoids firing on fragment changes
- **User click opens side panel** — do not auto-open
- **Shared cache across all users** — one DynamoDB table, no user identity stored
- **No PII collected** — domain strings only, no user data, no browsing history stored
- **API key in extension storage** — not hardcoded; loaded from `chrome.storage.local`
- **Manifest V3** — use service worker, not background page

---

## Environment Variables (Lambda)

```
ANTHROPIC_API_KEY=
DYNAMODB_TABLE=sytelens-cache
WHOIS_API_KEY=
AWS_REGION=us-east-1
```

---

## Build Order

1. `extension/manifest.json` + `background.js` skeleton (tab listener, domain extraction)
2. `extension/sidepanel/` — React UI with mock data (use sytelens-ui-mock.jsx as reference)
3. `backend/lambda/cache.js` — DynamoDB get/set with TTL
4. `backend/lambda/signals.js` — WHOIS fetch + URL param parser
5. `backend/lambda/prompt.js` — Anthropic call + JSON parse
6. `backend/lambda/handler.js` — orchestrate cache → signals → prompt → store → return
7. `backend/template.yaml` — SAM deploy config
8. Wire extension background.js → API Gateway endpoint
9. Icon badge color update logic
10. README + open source prep

---

## Start Here

**First task:** Scaffold the full project structure and implement Step 1 —
`manifest.json` and `background.js` with tab update listener that extracts
the root domain and logs it to the console. No API calls yet.
