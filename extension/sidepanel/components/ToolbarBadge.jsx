// Sytelens — brand mark: a shield with a magnifying lens ("see through any site").
// Matches the toolbar PNGs in extension/icons. state: loading | green | yellow | red.
import { useTheme } from "../theme.js";

export default function ToolbarBadge({ state = "loading", size = 18 }) {
  const T = useTheme();
  const COLORS = { loading: T.muted, green: T.green, yellow: T.amber, red: T.red };
  const c = COLORS[state] || T.muted;

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2 L4 5 V11 C4 16 7.5 20.6 12 22 C16.5 20.6 20 16 20 11 V5 Z"
        fill={c} fillOpacity="0.16" stroke={c} strokeWidth="1.6" strokeLinejoin="round"
      />
      <circle cx="10.6" cy="10.4" r="3.1" fill={c} fillOpacity="0.12" stroke={c} strokeWidth="1.5" />
      <line x1="12.9" y1="12.7" x2="15.4" y2="15.2" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
