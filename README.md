# Syte.Lens

**See through any website.** An AI-powered Chrome extension that rates a site's
trustworthiness *and* its safety for kids — a color-coded verdict with detailed
reasoning, right in the Chrome side panel.

By [ATIS MARS](https://atismars.co) · [sytelens.com](https://sytelens.com) · MIT licensed · open source.

---

## What it does

Click the toolbar icon on any site and Syte.Lens shows a side-panel report:

- **Trust verdict** — SAFE / CAUTION / HIGH RISK with a 0–100 score and an
  **explainable breakdown** (Reputation, Domain Signals, Content & Transparency).
- **Kids safety** — an **age rating** (All Ages → 18+), content-category flags
  (sexual content, violence, profanity, drugs, gambling, scary), plus
  **stranger-contact / UGC risk**, **in-app monetization** risk, and
  **child-privacy (COPPA)** signals.
- **Threat checks** — Google Safe Browsing (phishing/malware), **typosquat /
  brand-impersonation** detection, and **dark-pattern** detection (countdown
  timers, fake scarcity, urgency, pop-ups).
- **Domain signals** — age + registrar (WHOIS), HTTPS, ad-tracking parameters.
- **Data confidence** + **similar sites**.

The toolbar icon colors green / amber / red for sites already rated (a
lightweight cache lookup), and stays neutral otherwise.

## Architecture

```
Chrome Extension (Manifest V3)
  ├─ background.js  — tab detection, cache lookup, API calls, icon color
  ├─ content.js     — minimal page signals (title, meta, text sample)
  └─ side panel     — React UI (built with esbuild)
        │  POST { domain, signals }   (x-api-key)
        ▼
AWS API Gateway → Lambda (Node) → DynamoDB cache (30-day TTL)
        │
        ├─ Anthropic Claude  — structured trust + kids-safety analysis
        ├─ apilayer WHOIS     — domain age / registrar
        └─ Google Safe Browsing — phishing / malware
```

See [backend/template.yaml](backend/template.yaml) for the full stack.

## Privacy

A full analysis runs **only when you click** (or if you opt into auto-scan).
Icon coloring uses an anonymous **domain-only** cache lookup — no page content,
no accounts, no browsing-history profile. Full policy: [PRIVACY.md](PRIVACY.md).

## Install

- **Chrome Web Store:** _(coming soon)_
- **From source:** build the extension (below) and load `extension/` unpacked at
  `chrome://extensions` (Developer mode).

## Build & run (self-host)

Syte.Lens is "bring your own backend" — the extension talks to an endpoint you deploy.

### 1. Backend (AWS)

```bash
cd backend
sam build && sam deploy --guided   # provisions Lambda + DynamoDB + API Gateway
```

You'll supply an **Anthropic API key** (required) and optionally **apilayer
WHOIS** and **Google Safe Browsing** keys. Full guide: [backend/README.md](backend/README.md).
It outputs an API endpoint + key.

### 2. Extension

```bash
cd extension
npm install
cp config.example.js config.js     # then paste your endpoint + API key
npm run build                       # bundles the React side panel
```

Load `extension/` unpacked at `chrome://extensions`. `config.js` is git-ignored —
your endpoint/key never reach the repo.

## Tech stack

| Layer | Choice |
|---|---|
| Extension | Manifest V3, React side panel (esbuild), vanilla service worker |
| Backend | AWS Lambda (Node), API Gateway, DynamoDB |
| AI | Anthropic `claude-sonnet-4-6` (structured outputs) |
| Signals | apilayer WHOIS, Google Safe Browsing |
| Fonts | Space Grotesk + Inter (self-hosted) |

## License

MIT © ATIS MARS
