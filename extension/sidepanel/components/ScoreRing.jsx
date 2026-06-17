// Sytelens — circular 0–100 score arc, colored by verdict, with a soft glow.
import { useId } from "react";
import { useTheme } from "../theme.js";

export default function ScoreRing({ score, color, size = 76 }) {
  const T = useTheme();
  const uid = useId().replace(/:/g, "");
  const stroke = 6;
  const r = size / 2 - stroke - 3;
  const cx = size / 2;
  const circ = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, score)) / 100) * circ;

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", overflow: "visible" }}>
        <defs>
          <filter id={`glow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor={color} floodOpacity="0.4" />
          </filter>
        </defs>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={T.track} strokeWidth={stroke} />
        <circle
          cx={cx} cy={cx} r={r} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="round"
          filter={`url(#glow-${uid})`}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex",
        flexDirection: "column", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 8, color: T.muted, letterSpacing: "0.1em", marginTop: 2 }}>/ 100</span>
      </div>
    </div>
  );
}
