// Sytelens — design tokens + adaptive theming.
// The panel's neutral palette is DERIVED from the visited page's background
// color (see deriveTheme): a light page yields a near-white grayish panel with
// dark text; a dark page yields a dark-gray panel with light text; tinted pages
// get a matching tint. Accent colors stay constant for consistent verdicts.

import { createContext, useContext } from "react";

// Constant accent palette (verdict colors). Same in light and dark.
const ACCENT = {
  green:   "#22C55E",
  greenBg: "#0D2818",
  amber:   "#F59E0B",
  amberBg: "#1F1608",
  red:     "#EF4444",
  redBg:   "#200A0A",
  blue:    "#6366F1",
};

const FONTS = {
  mono: "'JetBrains Mono', ui-monospace, 'Courier New', monospace",
  sans: "'Inter', system-ui, -apple-system, sans-serif",
  heading: "'Space Grotesk', 'Inter', system-ui, sans-serif",
};

// ── color math ──────────────────────────────────────────────────
const BLACK = [0, 0, 0];
const WHITE = [255, 255, 255];

function parseRgb(str) {
  const m = String(str || "").match(/[\d.]+/g);
  if (!m || m.length < 3) return [12, 12, 15]; // fall back to near-black
  return [Number(m[0]), Number(m[1]), Number(m[2])];
}

// Perceived relative luminance, 0 (black) … 1 (white).
const luminance = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

// Blend rgb toward target by amount a (0…1).
const mix = ([r, g, b], [tr, tg, tb], a) =>
  [r + (tr - r) * a, g + (tg - g) * a, b + (tb - b) * a].map(Math.round);

const hex = (rgb) =>
  "#" + rgb.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");

// Light ATIS MARS theme — pale-blue background, deep-navy text & logo, flat (no
// gradients). Verdict colors (green/amber/red) still come from ACCENT.
const LENS = "#0050FF";        // ".LENS" logo color (specified)
const ACCENT_BLUE = "#0050FF"; // links / secondary accent

export function deriveTheme() {
  return {
    ...ACCENT, ...FONTS,
    blue: ACCENT_BLUE,
    logo: LENS,
    brand1: LENS, brand2: LENS, radius: 14, mode: "light",
    bg:      "#E7EEF8",  // header/footer bars — near-white blue
    surface: "#DFE9F8",  // panel background (specified rgb(223 233 248))
    card:    "rgba(255,255,255,0.62)",
    border:  "rgba(5,22,44,0.12)",
    track:   "rgba(5,22,44,0.12)",
    text:    "#05162C",  // body text (specified)
    subtle:  "#3E5168",
    muted:   "#6B7C93",
    glass:       "rgba(255,255,255,0.62)",
    glassBorder: "rgba(5,22,44,0.10)",
    shadow:      "0 6px 18px rgba(5,22,44,0.12)",
    accentHover: "rgba(37,99,235,0.10)",
  };
}

// Default dark theme — fallback before/if page detection fails, and the source
// of accent colors for mock data.
export const T = deriveTheme("rgb(12,12,15)");

// Theme propagated via context so every component reads the active palette.
export const ThemeContext = createContext(T);
export const useTheme = () => useContext(ThemeContext);

// Map a 0–100 score to verdict label, accent color, and tinted background.
// Thresholds match SYTELENS_BRIEF.md: 85–100 SAFE, 40–84 CAUTION, 0–39 HIGH RISK.
export function verdictForScore(score) {
  if (score >= 85) return { verdict: "SAFE",      state: "green",  color: ACCENT.green, bg: ACCENT.greenBg };
  if (score >= 40) return { verdict: "CAUTION",   state: "yellow", color: ACCENT.amber, bg: ACCENT.amberBg };
  return { verdict: "HIGH RISK", state: "red", color: ACCENT.red, bg: ACCENT.redBg };
}

// Verdict string -> toolbar/shield state key.
export const STATE_FOR_VERDICT = {
  SAFE: "green",
  CAUTION: "yellow",
  "HIGH RISK": "red",
  ANALYZING: "loading",
};
