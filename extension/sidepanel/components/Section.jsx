// Sytelens — collapsible titled section with an optional count badge.
import { useTheme } from "../theme.js";
import Icon from "./Icon.jsx";

export default function Section({ title, icon, count, countColor, open, onToggle, children }) {
  const T = useTheme();
  return (
    <div style={{ borderBottom: `1px solid ${T.border}` }}>
      <button
        onClick={onToggle}
        className="syte-section-toggle"
        style={{
          width: "100%", background: "none", border: "none", cursor: "pointer",
          padding: "12px 16px", display: "flex", alignItems: "center",
          justifyContent: "space-between", color: T.text,
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
          {icon && <span style={{ color: T.blue, display: "flex" }}><Icon name={icon} size={14} /></span>}
          <span style={{
            fontFamily: T.heading, fontSize: 12, fontWeight: 600, letterSpacing: "0.05em",
            textTransform: "uppercase", color: T.text,
          }}>{title}</span>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {count !== undefined && (
            <span style={{
              fontSize: 10, fontWeight: 700, background: `${countColor}20`,
              color: countColor, padding: "2px 7px", borderRadius: 10,
            }}>{count}</span>
          )}
          <span style={{
            color: T.muted, display: "block",
            transition: "transform 0.2s", transform: open ? "rotate(90deg)" : "rotate(0deg)",
          }}><Icon name="chevron" size={14} /></span>
        </div>
      </button>
      {open && <div style={{ padding: "12px 16px 16px", background: "#FFFFFF" }}>{children}</div>}
    </div>
  );
}
