// Animated EKG line shown while a verdict is being analyzed, so the panel
// reads as actively working rather than frozen. A faint full waveform sits
// behind a bright segment that sweeps across (see .syte-ekg-line in index.html).
import { useTheme } from "../theme.js";

// Three heartbeat pulses across a 240×60 viewBox.
const EKG_PATH =
  "M0 30 L30 30 L36 30 L42 16 L48 44 L54 6 L60 50 L66 30 L80 30 " +
  "L110 30 L116 30 L122 16 L128 44 L134 6 L140 50 L146 30 L160 30 " +
  "L190 30 L196 30 L202 16 L208 44 L214 6 L220 50 L226 30 L240 30";

export default function Heartbeat({ width = 210 }) {
  const T = useTheme();
  return (
    <svg viewBox="0 0 240 60" width={width} height={width * 0.25} fill="none"
      role="img" aria-label="Analyzing" xmlns="http://www.w3.org/2000/svg">
      <path d={EKG_PATH} stroke={T.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.16" />
      <path className="syte-ekg-line" d={EKG_PATH} stroke={T.blue} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
