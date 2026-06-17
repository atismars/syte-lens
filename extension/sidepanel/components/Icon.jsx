// Sytelens — inline SVG icons (Lucide-style), replacing emoji for crisp,
// theme-able, cross-platform rendering. Stroke uses currentColor.

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };

export default function Icon({ name, size = 14, color = "currentColor", style }) {
  const c = { width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true, style: { color, flexShrink: 0, display: "block", ...style } };
  switch (name) {
    case "check":
      return (<svg {...c} {...STROKE}><path d="M20 6 9 17l-5-5" /></svg>);
    case "x":
      return (<svg {...c} {...STROKE}><path d="M18 6 6 18M6 6l12 12" /></svg>);
    case "minus":
      return (<svg {...c} {...STROKE}><path d="M5 12h14" /></svg>);
    case "alert":
      return (<svg {...c} {...STROKE}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>);
    case "shield":
      return (<svg {...c} {...STROKE}><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>);
    case "lock":
      return (<svg {...c} {...STROKE}><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>);
    case "zap":
      return (<svg {...c} {...STROKE}><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" /></svg>);
    case "clock":
      return (<svg {...c} {...STROKE}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>);
    case "star":
      return (<svg {...c} {...STROKE}><path d="M11.5 2.3a.5.5 0 0 1 .95 0l2.3 4.68a2.1 2.1 0 0 0 1.6 1.16l5.16.76a.53.53 0 0 1 .3.9l-3.74 3.64a2.1 2.1 0 0 0-.6 1.88l.88 5.14a.53.53 0 0 1-.77.56l-4.62-2.43a2.1 2.1 0 0 0-1.97 0L6.4 21a.53.53 0 0 1-.77-.56l.88-5.14a2.1 2.1 0 0 0-.61-1.88L2.16 9.8a.53.53 0 0 1 .3-.9l5.16-.76a2.1 2.1 0 0 0 1.6-1.16z" /></svg>);
    case "external":
      return (<svg {...c} {...STROKE}><path d="M7 7h10v10" /><path d="M7 17 17 7" /></svg>);
    case "chevron":
      return (<svg {...c} {...STROKE}><path d="m9 18 6-6-6-6" /></svg>);
    case "dot":
      return (<svg {...c}><circle cx="12" cy="12" r="6" fill="currentColor" /></svg>);
    case "info":
      return (<svg {...c} {...STROKE}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>);
    case "bars":
      return (<svg {...c} {...STROKE}><line x1="6" x2="6" y1="20" y2="14" /><line x1="12" x2="12" y1="20" y2="4" /><line x1="18" x2="18" y1="20" y2="10" /></svg>);
    case "globe":
      return (<svg {...c} {...STROKE}><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>);
    case "eye":
      return (<svg {...c} {...STROKE}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>);
    case "users":
      return (<svg {...c} {...STROKE}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>);
    case "flag":
      return (<svg {...c} {...STROKE}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" x2="4" y1="22" y2="15" /></svg>);
    default:
      return null;
  }
}
