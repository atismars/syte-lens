# Chrome Web Store — Submission Guide

## Package

Build + zip (the `.zip` is git-ignored):

```bash
cd extension
npm run build
zip -rq syte-lens-<version>.zip manifest.json background.js content.js config.js \
  options.html options.js sidepanel/index.html sidepanel/index.js icons fonts -x "*.DS_Store"
```

Upload the zip at the [Developer Dashboard](https://chrome.google.com/webstore/devconsole)
($5 one-time developer registration required).

> ⚠️ The package **includes `config.js`** (your endpoint + API key) — that's
> intentional for the hosted-backend model. Make sure the backend has usage-plan
> throttling + a budget cap (it does) since the key is extractable from any
> published client.

## Listing fields

| Field | Value |
|---|---|
| **Name** | Syte.Lens |
| **Summary** (≤132 chars) | AI website trust & kids-safety ratings. A color-coded verdict with the reasoning, right in your side panel. |
| **Category** | Productivity (or "Tools") |
| **Language** | English |
| **Homepage** | https://sytelens.com |
| **Support / privacy** | https://sytelens.com + privacy URL below |

**Description** (long): reuse the README intro — what it does (trust verdict,
kids safety, threat checks, domain signals), privacy stance, open source.

**Single purpose** (required statement):
> Syte.Lens analyzes the website in the active tab and shows a trustworthiness
> and kids-safety rating in the side panel.

## Permission justifications (reviewers read these)

- **`tabs`** — detect the active tab's domain to rate the current site.
- **`storage`** — store user settings and a per-session verdict cache locally.
- **`sidePanel`** — render the analysis in Chrome's side panel.
- **`host_permissions: <all_urls>`** — the content script reads minimal page
  signals (title, meta, a short text sample) on the site being analyzed, and the
  worker calls our analysis API. No browsing history is collected.

## Privacy / data disclosure (required form)

- **Does it collect user data?** Yes.
- **What:** "Website content" (page title, meta description, a ~500-char text
  sample of the analyzed page) and the **root domain** of sites checked.
- **Purpose:** App functionality (generating the trust/kids-safety rating).
- **NOT collected:** full URLs, form input, credentials, personal identifiers,
  cross-site browsing-history profile. No data sold or used for ads.
- **Privacy policy URL:** `https://sytelens.com/privacy.html` — host a privacy page
  at that URL before submitting (source policy: [PRIVACY.md](../PRIVACY.md)). This is
  the same URL the extension's options page links to; it must be live and reachable
  for the store review to pass.

## Assets needed before submit

- [x] **Icon 128×128** — `extension/icons/grey-128.png` (and the colored set).
- [ ] **Screenshots** — 1–5 at **1280×800** or 640×400. Capture the real side
  panel on a few sites (a SAFE site, a CAUTION/kids site like a game platform,
  and the Kids Safety section expanded).
- [ ] **Small promo tile** — 440×280 (optional but recommended).
- [ ] **Privacy policy URL** live and reachable.

## Pre-submit checklist

- [ ] `version` bumped in `manifest.json` for each upload (e.g. 1.0.0 for launch).
- [ ] Backend deployed and reachable; throttling + budget alarm active.
- [ ] Tested the packaged build via "Load unpacked" on the unzipped folder.
- [ ] No remote code (all JS bundled, fonts self-hosted) — MV3 requirement ✓.
