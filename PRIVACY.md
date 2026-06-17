# Sytelens Privacy Policy

**Plain-language summary:** Sytelens analyzes a website **only when you click the
Sytelens icon**. We never build a record of your browsing, we have no user
accounts, and we never sell or share your data. The entire client is open source
so you can verify exactly what runs in your browser.

---

## When analysis happens

- **Full analysis (click):** a complete AI analysis runs when **you open the side
  panel** by clicking the toolbar icon. It analyzes only the tab you're looking at.
- **Known-site coloring (on by default):** to color the toolbar icon for sites
  that have already been rated, Sytelens does a lightweight, anonymous
  **domain-only lookup** against the shared ratings cache on each visit — **no
  page content is sent and no new analysis runs** (it's a cache read). If the
  site isn't already rated, the icon stays neutral. Toggle it off in Settings
  ("Show ratings for already-rated sites").
- **Optional auto-scan (off by default):** "Auto-scan sites as I browse" runs a
  full analysis of every site you visit so the icon pre-colors. Opt-in, clearly
  labeled.

## What we send

On each visit (for known-site coloring), we send **only the root domain** to look
it up in the ratings cache — nothing else. When a **full analysis** runs (you
click, or auto-scan is on), we additionally send:

- The site's **root domain** (e.g. `example.com`).
- For the page you're actively checking: its **title**, **meta description**, and
  a **short sample of visible text** (~500 characters).
- The **names** of any ad-tracking parameters in the URL (e.g. `utm_source`) —
  used to flag ad funnels.
- Whether the connection is **HTTPS**.

## What we never send or store

- ❌ The full URL, path, or query-string **values**.
- ❌ Form inputs, passwords, or anything you type.
- ❌ Cookies, user IDs, accounts, or any identifier that ties activity to you.
- ❌ A history or log of the sites you visit.

## No identity, shared cache

Verdicts are cached by **domain only**, in a single cache shared by all users.
There is no per-user data, so a cached verdict cannot be traced back to any
individual. We do not use cookies or analytics in the extension.

## Third parties that process a request

When you analyze a site, the minimal signals above are processed by:

| Service | Purpose | Receives |
|---|---|---|
| Our backend (AWS, your/our account) | Orchestration + cache | domain + page signals above |
| Anthropic (Claude) | Generates the trust analysis | domain + page signals above |
| apilayer.com | Domain age & registrar (WHOIS) | domain only |
| Google Safe Browsing | Phishing/malware check | domain only |

We send these providers only what's listed — never your identity or browsing
history.

## Open source & audits

- The extension (client) source is public on GitHub — read every line that runs
  in your browser.
- An **independent third-party security audit** is planned once the project
  reaches meaningful adoption; the result will be published here.

## Contact

Questions or a concern? Open an issue on the GitHub repository.

_Last updated: 2026-06-15._
