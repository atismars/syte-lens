// Sytelens — content script (page signal extractor).
//
// Replies to the background worker with the minimum needed to analyze the page
// the user is actively checking: title, meta description, and a short sample of
// visible text. It does NOT send the URL — the worker derives domain/HTTPS from
// the tab itself. Nothing is collected unless the worker asks.

// Heuristic detection of manipulative "dark patterns" in the live page.
// Returns [{ type, label, evidence }] — evidence is a short matched snippet.
function detectDarkPatterns() {
  const out = [];
  const add = (type, label, evidence) => {
    if (out.length < 8) out.push({ type, label, evidence: String(evidence).slice(0, 80) });
  };
  try {
    const text = (document.body?.innerText || "").replace(/\s+/g, " ");

    const urgency = text.match(
      /\b(limited[- ]time|act now|hurry|don'?t miss|last chance|offer ends|ends (soon|today|tonight)|today only|flash sale|while supplies last|expires? (soon|today))\b/i
    );
    if (urgency) add("urgency", "Urgency language", urgency[0]);

    const scarcity = text.match(
      /\b(only \d+ (left|remaining|in stock)|\d+ (people|others|shoppers) (viewing|watching|bought|are looking)|selling (fast|out)|low stock|almost (gone|sold out)|\d+ left at this price)\b/i
    );
    if (scarcity) add("scarcity", "Fake scarcity / stock pressure", scarcity[0]);

    // Countdown timer: HH:MM:SS / MM:SS text alongside an urgency/sale context.
    const timer = text.match(/\b\d{1,2}:\d{2}(:\d{2})?\b/);
    if (timer && (urgency || /count\s?down|timer|deal ends|sale ends/i.test(text))) {
      add("timer", "Countdown timer", timer[0]);
    }

    // Visible, sizable fixed/absolute overlays that look like modals/popups.
    const overlays = [
      ...document.querySelectorAll(
        '[role="dialog"], [class*="modal" i], [class*="popup" i], [class*="overlay" i], [id*="modal" i], [id*="popup" i]'
      ),
    ].filter((el) => {
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden" || parseFloat(s.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 200 && r.height > 150 && (s.position === "fixed" || s.position === "absolute");
    });
    if (overlays.length > 0) {
      add("popup", "Popup / modal overlay", `${overlays.length} overlay${overlays.length > 1 ? "s" : ""} on load`);
    }
  } catch {
    /* never let detection break the content script */
  }
  return out;
}

function collectSignals() {
  const metaDescription =
    document.querySelector('meta[name="description"]')?.content ||
    document.querySelector('meta[property="og:description"]')?.content ||
    "";
  const contentSample = (document.body?.innerText || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);

  return {
    pageTitle: document.title || "",
    metaDescription,
    contentSample,
    darkPatterns: detectDarkPatterns(),
  };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "SYTELENS_GET_SIGNALS") {
    sendResponse(collectSignals());
  }
  // synchronous response — no `return true` needed
});
