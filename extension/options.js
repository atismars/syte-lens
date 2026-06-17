// Sytelens — options page logic. Two preferences:
//   knownSiteCheck (default ON)  — cache-only icon coloring for rated sites
//   autoScan       (default OFF) — full analysis of every site you visit

const autoScan = document.getElementById("autoScan");
const knownSiteCheck = document.getElementById("knownSiteCheck");
const saved = document.getElementById("saved");

function flash(text) {
  saved.textContent = text;
  setTimeout(() => (saved.textContent = ""), 3000);
}

// Load current values (knownSiteCheck defaults to true).
chrome.storage.local.get(["autoScan", "knownSiteCheck"]).then((s) => {
  autoScan.checked = s.autoScan === true;
  knownSiteCheck.checked = s.knownSiteCheck !== false;
});

autoScan.addEventListener("change", async () => {
  await chrome.storage.local.set({ autoScan: autoScan.checked });
  flash(
    autoScan.checked
      ? "Auto-scan enabled — every site is analyzed as you browse."
      : "Auto-scan off — analysis runs only when you click the icon."
  );
});

knownSiteCheck.addEventListener("change", async () => {
  await chrome.storage.local.set({ knownSiteCheck: knownSiteCheck.checked });
  flash(
    knownSiteCheck.checked
      ? "Known-site ratings on — the icon colors for sites already rated."
      : "Known-site ratings off — the icon stays neutral until you click."
  );
});
