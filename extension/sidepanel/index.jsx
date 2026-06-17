// Sytelens — React side panel (Step 8: live verdicts).
// Fetches the active tab's verdict from the background worker, adapts the page
// theme to the visited site, and renders the trust analysis. Mock data is gone.

import { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";

import { T, ThemeContext, useTheme, verdictForScore } from "./theme.js";
import ScoreRing from "./components/ScoreRing.jsx";
import Section from "./components/Section.jsx";
import ToolbarBadge from "./components/ToolbarBadge.jsx";
import Heartbeat from "./components/Heartbeat.jsx";
import Icon from "./components/Icon.jsx";

// ── header (shared by the panel and status screens) ─────────────────
function Header({ state, onClose }) {
  const T = useTheme();
  return (
    <div style={{
      padding: "12px 16px", borderBottom: `1px solid ${T.border}`, background: T.bg,
      display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <ToolbarBadge state={state} size={18} />
        <span style={{ fontFamily: T.heading, fontSize: 14, fontWeight: 700, letterSpacing: "0.04em" }}>
          <span style={{ color: T.text }}>SYTE</span>
          <span style={{ color: T.logo }}>.LENS</span>
        </span>
      </div>
      <button onClick={onClose} title="Close" aria-label="Close panel"
        style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, padding: 4, lineHeight: 0, display: "flex" }}>
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}

// ── verdict panel ───────────────────────────────────────────────────
function SidePanel({ data, onClose }) {
  const T = useTheme();
  const [openSection, setOpenSection] = useState("kids");
  const toggle = (id) => setOpenSection((cur) => (cur === id ? null : id));

  return (
    <div style={{ width: "100%", height: "100%", background: T.surface, display: "flex", flexDirection: "column", fontFamily: T.sans, overflow: "hidden" }}>
      <Header state={data.state} onClose={onClose} />

      <div style={{ overflowY: "auto", flex: 1 }}>
        {/* Hero report card */}
        <div style={{ padding: 14 }}>
          <div style={{ background: "#FFFFFF", border: `1px solid ${T.glassBorder}`, borderTop: `3px solid ${data.color}`, borderRadius: 16, boxShadow: T.shadow, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: `${data.faviconColor}1F`, border: `1px solid ${data.faviconColor}45`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 19, fontWeight: 800, color: data.faviconColor,
              }}>{data.favicon}</div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {data.domain}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 7, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: T.heading, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: data.color, background: `${data.color}1A`, border: `1px solid ${data.color}45`, padding: "3px 10px", borderRadius: 999 }}>
                    {data.verdict}
                  </span>
                  {data.kidsSafety && (() => {
                    const c = data.kidsSafety.ageRating === "16+" || data.kidsSafety.ageRating === "18+" ? T.red : data.kidsSafety.ageRating === "13+" ? T.amber : T.green;
                    return (
                      <span title={data.kidsSafety.summary} style={{ fontFamily: T.heading, fontSize: 10, fontWeight: 700, color: c, background: `${c}1A`, border: `1px solid ${c}45`, padding: "3px 10px", borderRadius: 999 }}>
                        {data.kidsSafety.ageRating}
                      </span>
                    );
                  })()}
                </div>
                <div style={{ marginTop: 7, fontSize: 10, color: data.cached ? T.muted : T.blue, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {data.cached
                    ? <><Icon name="clock" size={11} /> Cached{data.cachedAgo ? ` · ${data.cachedAgo}` : ""}</>
                    : <><Icon name="zap" size={11} /> Live analysis</>}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                <ScoreRing score={data.score} color={data.color} />
                {data.confidence && (() => {
                  const lvl = data.confidence.level;
                  const cc = lvl === "high" ? T.green : lvl === "medium" ? T.amber : T.muted;
                  const title = data.confidence.missing?.length
                    ? `Limited data — missing: ${data.confidence.missing.join(", ")}`
                    : "All signal sources available";
                  return (
                    <span title={title} style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.03em", color: cc, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 3 }}>
                      <Icon name="dot" size={7} />{lvl[0].toUpperCase() + lvl.slice(1)}
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* signal strip */}
            {(data.safeBrowsing != null || data.impersonation) && (
              <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                {data.safeBrowsing != null && (() => {
                  const clean = data.safeBrowsing.length === 0;
                  const c = clean ? T.green : T.red;
                  return (
                    <span title="Google Safe Browsing" style={{ fontSize: 10, fontWeight: 600, color: c, background: `${c}14`, padding: "4px 9px", borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Icon name="shield" size={11} />{clean ? "Safe Browsing: Clean" : `Threat: ${humanizeThreats(data.safeBrowsing)}`}
                    </span>
                  );
                })()}
                {data.impersonation && (
                  <span title={data.impersonation.note} style={{ fontSize: 10, fontWeight: 600, color: T.red, background: `${T.red}14`, padding: "4px 9px", borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Icon name="alert" size={11} />{data.impersonation.display ? `Impersonates ${data.impersonation.display}?` : "Possible impersonation"}
                  </span>
                )}
              </div>
            )}

            {/* summary */}
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.glassBorder}`, fontSize: 12, color: T.subtle, lineHeight: 1.6 }}>
              {data.summary}
            </div>
          </div>
        </div>

        {/* Kids safety — age rating + content categories */}
        {data.kidsSafety && (() => {
          const ks = data.kidsSafety;
          const ageColor = ks.ageRating === "16+" || ks.ageRating === "18+" ? T.red : ks.ageRating === "13+" ? T.amber : T.green;
          const flagged = (ks.categories || []).filter((c) => c.level !== "none").length;
          const levelMeta = {
            none: { label: "None", color: T.green },
            mild: { label: "Mild", color: T.amber },
            present: { label: "Present", color: T.red },
          };
          return (
            <Section title="Kids Safety" icon="users" count={flagged > 0 ? flagged : undefined} countColor={ageColor}
              open={openSection === "kids"} onToggle={() => toggle("kids")}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontFamily: T.heading, fontSize: 18, fontWeight: 700, color: ageColor, background: `${ageColor}1F`, border: `1px solid ${ageColor}55`, padding: "4px 12px", borderRadius: 999 }}>
                  {ks.ageRating}
                </span>
                {ks.summary && <span style={{ fontSize: 12, color: T.subtle, lineHeight: 1.45 }}>{ks.summary}</span>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {(ks.categories || []).map((c, i) => {
                  const m = levelMeta[c.level] || levelMeta.none;
                  return (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 12, color: T.text }}>{c.category}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: m.color, background: `${m.color}1A`, padding: "2px 9px", borderRadius: 999 }}>{m.label}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 11, paddingTop: 11, display: "flex", flexDirection: "column", gap: 9 }}>
                {[
                  { label: "Stranger contact", v: ks.contactRisk },
                  { label: "In-app monetization", v: ks.monetizationRisk },
                  { label: "Child privacy (COPPA)", v: ks.childPrivacy },
                ].map(({ label, v }, i) => {
                  if (!v) return null;
                  const rm = ({ none: { label: "OK", color: T.green }, caution: { label: "Caution", color: T.amber }, risk: { label: "Risk", color: T.red } })[v.level] || { label: "—", color: T.muted };
                  return (
                    <div key={i}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 12, color: T.text }}>{label}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: rm.color, background: `${rm.color}1A`, padding: "2px 9px", borderRadius: 999 }}>{rm.label}</span>
                      </div>
                      {v.note && v.level !== "none" && <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.4, marginTop: 1 }}>{v.note}</div>}
                    </div>
                  );
                })}
              </div>
            </Section>
          );
        })()}

        {/* Score breakdown */}
        {data.breakdown.length > 0 && (
          <Section title="Score Breakdown" icon="bars" open={openSection === "breakdown"} onToggle={() => toggle("breakdown")}>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {data.breakdown.map((c, i) => {
                const bar = c.score == null ? T.muted : c.score >= 85 ? T.green : c.score >= 40 ? T.amber : T.red;
                return (
                  <div key={i}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                      <span style={{ fontSize: 11, color: T.text }}>
                        {c.label} <span style={{ color: T.muted }}>· {Math.round(c.weight * 100)}%</span>
                      </span>
                      <span style={{ fontSize: 11, color: c.score == null ? T.muted : T.subtle, fontFamily: T.mono }}>
                        {c.score == null ? "—" : c.score}
                      </span>
                    </div>
                    <div style={{ height: 5, background: T.track, borderRadius: 3, overflow: "hidden" }}>
                      {c.score != null && <div style={{ height: "100%", width: `${c.score}%`, background: bar, borderRadius: 3 }} />}
                    </div>
                    {c.note && <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{c.note}</div>}
                  </div>
                );
              })}
              <div style={{ fontSize: 10, color: T.muted, borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
                Final score is the weighted sum of the components above. Community Signals isn’t collected yet.
              </div>
            </div>
          </Section>
        )}

        {/* Domain signals */}
        <Section title="Domain Signals" icon="globe" open={openSection === "domain"} onToggle={() => toggle("domain")}>
          <div style={{ display: "grid", gap: 8 }}>
            {[
              { label: "Age", value: data.domainAge },
              { label: "Registrar", value: data.registrar },
              { label: "HTTPS", value: (<span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name={data.https ? "check" : "x"} size={11} />{data.https ? "Valid SSL" : "None"}</span>), color: data.https ? T.green : T.red },
            ].map((item) => (
              <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <span style={{ fontSize: 11, color: T.muted, flexShrink: 0 }}>{item.label}</span>
                <span style={{ fontSize: 11, color: item.color || T.text, textAlign: "right", fontFamily: item.label === "Age" ? T.mono : "inherit" }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
          {data.recentlyTransferred && (
            <div style={{ fontSize: 10, color: T.muted, marginTop: 8, lineHeight: 1.4 }}>
              Old domain, recently transferred — its age may not reflect the current operator.
            </div>
          )}
        </Section>

        {/* Protection checks */}
        {data.protections.length > 0 && (() => {
          const meta = {
            pass: { icon: "check", color: T.green },
            caution: { icon: "alert", color: T.amber },
            risk: { icon: "x", color: T.red },
            na: { icon: "minus", color: T.muted },
          };
          const issues = data.protections.filter((p) => p.status === "risk" || p.status === "caution").length;
          const hasRisk = data.protections.some((p) => p.status === "risk");
          return (
            <Section
              title="Protection" icon="shield"
              count={issues > 0 ? issues : undefined}
              countColor={hasRisk ? T.red : T.amber}
              open={openSection === "protection"}
              onToggle={() => toggle("protection")}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {data.protections.map((p, i) => {
                  const m = meta[p.status] || meta.na;
                  return (
                    <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                      <span style={{ color: m.color, flexShrink: 0, marginTop: 1, display: "flex" }}><Icon name={m.icon} size={13} /></span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: T.text }}>{p.category}</div>
                        {p.note && <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.45, marginTop: 1 }}>{p.note}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          );
        })()}

        {/* What it actually is */}
        <Section title="What It Actually Is" icon="info" open={openSection === "business"} onToggle={() => toggle("business")}>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {data.whatItIs.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ color: T.blue, flexShrink: 0, marginTop: 3, display: "flex" }}><Icon name="chevron" size={11} /></span>
                <span style={{ fontSize: 12, color: T.subtle, lineHeight: 1.55 }}>{item}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Ad tracking (hidden if none) */}
        {data.urlParams.length > 0 && (
          <Section title="Ad Tracking Detected" icon="eye" count={data.urlParams.length} countColor={T.amber} open={openSection === "url"} onToggle={() => toggle("url")}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {data.urlParams.map((p, i) => (
                <div key={i} style={{ background: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 10, padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: T.mono, fontSize: 10, color: T.amber }}>{p.key}{p.value ? `=${p.value}` : ""}</span>
                  <span style={{ fontSize: 10, color: T.muted, textAlign: "right" }}>{p.note}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Dark patterns (hidden if none) */}
        {data.darkPatterns.length > 0 && (
          <Section title="Dark Patterns" icon="alert" count={data.darkPatterns.length} countColor={T.amber}
            open={openSection === "dark"} onToggle={() => toggle("dark")}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.darkPatterns.map((d, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ color: T.amber, flexShrink: 0, marginTop: 1, display: "flex" }}><Icon name="alert" size={13} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: T.text }}>{d.label}</div>
                    {d.evidence && <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.4, marginTop: 1 }}>“{d.evidence}”</div>}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Red flags (hidden if none) */}
        {data.redFlags.length > 0 && (
          <Section title="Red Flags" icon="flag" count={data.redFlags.length} countColor={T.red} open={openSection === "red"} onToggle={() => toggle("red")}>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {data.redFlags.map((f, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ color: T.red, flexShrink: 0, marginTop: 1, display: "flex" }}><Icon name="x" size={13} /></span>
                  <span style={{ fontSize: 12, color: T.subtle, lineHeight: 1.5 }}>{f}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Positive signals */}
        <Section title="Positive Signals" icon="check" count={data.greenSignals.length} countColor={T.green} open={openSection === "green"} onToggle={() => toggle("green")}>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {data.greenSignals.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ color: T.green, flexShrink: 0, marginTop: 1, display: "flex" }}><Icon name="check" size={13} /></span>
                <span style={{ fontSize: 12, color: T.subtle, lineHeight: 1.5 }}>{s}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Similar sites (hidden if none) */}
        {data.similarSites.length > 0 && (
          <Section title="Similar Sites" icon="external" count={data.similarSites.length} countColor={T.blue} open={openSection === "similar"} onToggle={() => toggle("similar")}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {data.similarSites.map((s, i) => {
                const href = /^https?:\/\//.test(s.url) ? s.url : `https://${s.url}`;
                return (
                  <a key={i} href={href} target="_blank" rel="noreferrer"
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, background: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 10, padding: "8px 10px", textDecoration: "none" }}>
                    <span style={{ fontSize: 12, color: T.text }}>{s.name}</span>
                    <span style={{ fontFamily: T.mono, fontSize: 10, color: T.blue, display: "inline-flex", alignItems: "center", gap: 3 }}>{s.url}<Icon name="external" size={10} /></span>
                  </a>
                );
              })}
            </div>
          </Section>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "10px 16px", borderTop: `1px solid ${T.border}`, background: T.bg, display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={() => chrome.runtime.openOptionsPage()}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 10, color: T.blue, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Icon name="lock" size={11} /> Privacy &amp; settings
          </button>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <a href="https://github.com/atismars/syte-lens" target="_blank" rel="noreferrer" style={{ fontSize: 10, color: T.blue, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="star" size={11} /> Open source on GitHub</a>
            <a href="https://sytelens.com" target="_blank" rel="noreferrer" style={{ fontSize: 10, color: T.blue, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="home" size={11} /> Syte.Lens</a>
          </div>
        </div>
        <span style={{ fontSize: 10, color: T.muted }}>
          Incorrect verdict?{" "}
          <a href={buildReportUrl(data)} target="_blank" rel="noreferrer" style={{ color: T.blue, textDecoration: "none" }}>Report it</a>
        </span>
      </div>
    </div>
  );
}

// ── non-verdict states (analyzing / error / no site / unconfigured) ──
function StatusView({ state, title, detail, onClose }) {
  const T = useTheme();
  const analyzing = state === "analyzing";
  return (
    <div style={{ width: "100%", height: "100%", background: T.surface, display: "flex", flexDirection: "column", fontFamily: T.sans }}>
      <Header state={state} onClose={onClose} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, textAlign: "center" }}>
        {analyzing ? (
          <>
            <span className="syte-pulse" style={{ display: "flex" }}>
              <ToolbarBadge state="loading" size={40} glyph={false} />
            </span>
            <Heartbeat width={200} />
          </>
        ) : (
          <ToolbarBadge state="loading" size={36} glyph={false} />
        )}
        <div style={{ fontFamily: T.heading, fontSize: 14, fontWeight: 700, color: T.text }}>{title}</div>
        {detail && <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5, maxWidth: 260 }}>{detail}</div>}
        {analyzing && (
          <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.5, maxWidth: 240 }}>
            Reading the page and checking trust signals. This usually takes a few seconds.
          </div>
        )}
      </div>
    </div>
  );
}

// ── data adapters ───────────────────────────────────────────────────
function timeAgo(iso) {
  if (!iso) return null;
  const secs = (Date.now() - new Date(iso).getTime()) / 1000;
  if (Number.isNaN(secs) || secs < 0) return null;
  if (secs < 3600) return `${Math.max(1, Math.round(secs / 60))} min ago`;
  if (secs < 86400) return `${Math.round(secs / 3600)} hr ago`;
  return `${Math.round(secs / 86400)} days ago`;
}

function toPanelData(v) {
  const { state, color } = verdictForScore(v.score);
  return {
    domain: v.domain,
    favicon: (v.domain?.[0] || "?").toUpperCase(),
    faviconColor: color,
    score: v.score,
    verdict: v.verdict,
    state,
    color,
    cached: !!v.cached,
    cachedAgo: v.cached ? timeAgo(v.analyzedAt) : null,
    confidence: v.confidence || null,
    breakdown: v.breakdown || [],
    summary: v.summary || "",
    domainAge: v.domainAge || "unknown",
    registrar: v.registrar || "unknown",
    https: !!v.https,
    recentlyTransferred: !!v.recentlyTransferred,
    whatItIs: v.whatItIs || [],
    urlParams: v.urlParams || [],
    redFlags: v.redFlags || [],
    greenSignals: v.greenSignals || [],
    similarSites: v.similarSites || [],
    protections: v.protections || [],
    darkPatterns: v.darkPatterns || [],
    impersonation: v.impersonation || null,
    kidsSafety: v.kidsSafety || null,
    safeBrowsing: v.safeBrowsing === undefined ? null : v.safeBrowsing, // null = not checked
  };
}

const THREAT_LABELS = {
  SOCIAL_ENGINEERING: "Phishing",
  MALWARE: "Malware",
  UNWANTED_SOFTWARE: "Unwanted software",
  POTENTIALLY_HARMFUL_APPLICATION: "Harmful app",
};
const humanizeThreats = (t) => (t || []).map((x) => THREAT_LABELS[x] || x).join(", ");

// Build a prefilled GitHub "new issue" URL for an incorrect-verdict report.
const REPO = "https://github.com/atismars/syte-lens";
function buildReportUrl(data) {
  const title = `Incorrect verdict: ${data.domain}`;
  const body = [
    `**Domain:** ${data.domain}`,
    `**Verdict shown:** ${data.verdict} (score ${data.score}/100)`,
    "",
    "**What seems wrong, and what's the correct read?**",
    "",
    "",
    "---",
    "_Reported from the Syte.Lens side panel._",
  ].join("\n");
  return `${REPO}/issues/new?labels=${encodeURIComponent("verdict-report")}&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}

function App() {
  const [result, setResult] = useState(null); // { status, domain?, verdict? }
  const activeTabId = useRef(null);

  async function refresh() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTabId.current = tab?.id ?? null;
    if (!tab?.id) {
      setResult({ status: "unsupported" });
      return;
    }
    try {
      const r = await chrome.runtime.sendMessage({ type: "SYTELENS_GET_VERDICT", tabId: tab.id });
      setResult(r || { status: "error" });
    } catch {
      setResult({ status: "error" });
    }
  }

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    const onActivated = () => refresh();
    // Live update when the worker finishes analyzing the active tab.
    const onMsg = (msg) => {
      if (msg?.type === "SYTELENS_VERDICT" && msg.tabId === activeTabId.current) {
        if (msg.status === "ready") setResult({ status: "ready", domain: msg.domain, verdict: msg.verdict });
        else if (msg.status === "error") setResult({ status: "error", domain: msg.domain });
      }
    };
    window.addEventListener("focus", onFocus);
    chrome.tabs?.onActivated?.addListener(onActivated);
    chrome.runtime?.onMessage?.addListener(onMsg);
    return () => {
      window.removeEventListener("focus", onFocus);
      chrome.tabs?.onActivated?.removeListener(onActivated);
      chrome.runtime?.onMessage?.removeListener(onMsg);
    };
  }, []);

  const onClose = () => window.close();

  let view;
  if (!result) {
    view = <StatusView state="loading" title="Loading…" onClose={onClose} />;
  } else if (result.status === "ready") {
    view = <SidePanel data={toPanelData(result.verdict)} onClose={onClose} />;
  } else if (result.status === "analyzing") {
    view = <StatusView state="analyzing" title="Analyzing…" detail={result.domain} onClose={onClose} />;
  } else if (result.status === "unconfigured") {
    view = <StatusView state="loading" title="Sytelens isn't set up" detail="No backend endpoint or API key is configured." onClose={onClose} />;
  } else if (result.status === "error") {
    view = <StatusView state="loading" title="Analysis unavailable" detail={`Couldn't analyze ${result.domain || "this site"}. Try reloading the page.`} onClose={onClose} />;
  } else {
    view = <StatusView state="loading" title="Open a website" detail="Navigate to any site and click the Sytelens icon to see its trust analysis." onClose={onClose} />;
  }

  return (
    <ThemeContext.Provider value={T}>
      <div style={{ height: "100vh", background: T.surface }}>{view}</div>
    </ThemeContext.Provider>
  );
}

createRoot(document.getElementById("root")).render(<App />);
