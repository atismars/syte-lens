// Sytelens — options page logic. One preference:
//   knownSiteCheck (default ON) — cache-only icon coloring for rated sites

const knownSiteCheck = document.getElementById("knownSiteCheck");
const saved = document.getElementById("saved");

function flash(text) {
  saved.textContent = text;
  setTimeout(() => (saved.textContent = ""), 3000);
}

// Load current value (knownSiteCheck defaults to true).
chrome.storage.local.get(["knownSiteCheck"]).then((s) => {
  knownSiteCheck.checked = s.knownSiteCheck !== false;
});

knownSiteCheck.addEventListener("change", async () => {
  await chrome.storage.local.set({ knownSiteCheck: knownSiteCheck.checked });
  flash(
    knownSiteCheck.checked
      ? "Known-site ratings on — the icon colors for sites already rated."
      : "Known-site ratings off — the icon stays neutral until you click."
  );
});
