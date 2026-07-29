import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";

/* ══════════════════ AUDIO HELPERS ══════════════════ */
const SAMPLE_SCRIPT =
  "Warning. This is VoiceShield. Artificial intelligence can now clone any human voice " +
  "from just three seconds of audio. Scammers use these deepfake voices to impersonate " +
  "your family, your bank, and your boss. Never trust a voice alone. Always verify before you act.";

let cachedVoices = [];
function primeVoices() {
  const load = () => { cachedVoices = window.speechSynthesis.getVoices(); };
  load();
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = load;
  }
}

function speakSample(onEnd) {
  const u = new SpeechSynthesisUtterance(SAMPLE_SCRIPT);
  u.rate = 0.95;
  u.pitch = 1;
  const voices = cachedVoices.length ? cachedVoices : window.speechSynthesis.getVoices();
  u.voice =
    voices.find((v) => /en[-_]/i.test(v.lang) && /google|natural|samantha|aria|zira/i.test(v.name)) ||
    voices.find((v) => /en/i.test(v.lang)) || null;
  u.onend = onEnd;
  u.onerror = onEnd;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

const blip = (f = 640, d = 0.08) => {
  try {
    const c = new (window.AudioContext || window.webkitAudioContext)();
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.value = f;
    g.gain.setValueAtTime(0.06, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + d);
    o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + d);
  } catch (e) {}
};

/* ══════════════════ HOOKS ══════════════════ */
function useReveals(dep) {
  useEffect(() => {
    const els = document.querySelectorAll("[data-reveal]");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("in")),
      { threshold: 0.12, rootMargin: "0px 0px -50px 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [dep]);
}

function useScrollLock(locked) {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [locked]);
}

function useEscapeClose(handlers) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      for (const [isOpen, close] of handlers) {
        if (isOpen) { close(); return; }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers]);
}

/* ══════════════════ STORAGE / ACCOUNT / USAGE HELPERS ══════════════════
   NOTE: This build has no auth backend, so accounts, plans, usage counters
   and scan history are kept client-side (localStorage) so the demo works
   end-to-end. Wire these to real endpoints when a backend auth/billing
   service exists — the shapes below are intentionally simple to swap out. */
const LS = {
  user: "vs_user",
  accounts: "vs_accounts",
  usage: "vs_usage",
  history: "vs_history",
  theme: "vs_theme_mode",
};

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}
function writeJSON(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
}

const PLANS = {
  free: { id: "free", name: "Free", limit: 50, price: "$0", cadence: "forever" },
  pro: { id: "pro", name: "Pro", limit: 2000, price: "$9", cadence: "/ month" },
  business: { id: "business", name: "Business", limit: Infinity, price: "$29", cadence: "/ month" },
};

function monthKey(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }

function loadUsage() {
  const saved = readJSON(LS.usage, null);
  const mk = monthKey();
  if (!saved || saved.monthKey !== mk) return { monthKey: mk, count: 0 };
  return saved;
}

function genRefId() {
  return `VS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

/* naive base64url decode for a Google Identity Services JWT payload —
   good enough to read name/email/picture out of the credential client-side */
function decodeJwtPayload(token) {
  try {
    const base = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = base.length % 4 ? "=".repeat(4 - (base.length % 4)) : "";
    return JSON.parse(atob(base + pad));
  } catch (e) { return null; }
}

/* ══════════════════ COMPONENTS ══════════════════ */
const Glitch = ({ children }) => <span className="glitch" data-text={children}>{children}</span>;

const LinkedInIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.55V9h3.57v11.45z"/>
  </svg>
);

const BAR_HEIGHTS = [
  22, 38, 54, 70, 46, 88, 62, 34, 76, 94, 58, 42, 66, 90, 50, 28,
  72, 96, 60, 40, 56, 82, 36, 64, 92, 48, 74, 30, 86, 68, 44, 78,
  52, 26, 84, 58, 38, 70, 94, 46, 62, 32, 80, 54, 90, 42, 66, 24,
];

const WaveBars = React.memo(function WaveBars({ playing, progress }) {
  return (
    <div className="vn-bars" aria-hidden="true">
      {BAR_HEIGHTS.map((h, i) => {
        const pos = i / BAR_HEIGHTS.length;
        const played = pos <= progress;
        const isHead = playing && Math.abs(pos - progress) < 0.045;
        return <span key={i} className={`vnb ${played ? "done" : ""} ${isHead ? "head" : ""}`} style={{ height: `${h}%` }} />;
      })}
    </div>
  );
});

function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, 4200);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);
  if (!toast) return null;
  return (
    <div className={`toast liquid-glass tone-${toast.type || "info"}`} role="status" aria-live="polite">
      <span className="toast-dot" />
      <span>{toast.msg}</span>
      <button className="toast-x" aria-label="Dismiss" onClick={onDismiss}>✕</button>
    </div>
  );
}

function VoicePlayer() {
  const [playing, setPlaying] = useState(false);
  const [vnTime, setVnTime] = useState(0);
  const VN_DURATION = 18;

  useEffect(() => {
    if (!playing) return;
    const t0 = performance.now() - vnTime * 1000;
    let raf, last = 0;
    const tick = (t) => {
      if (!window.speechSynthesis.speaking) { setPlaying(false); setVnTime(0); return; }
      if (t - last > 120) { last = t; setVnTime(Math.min((t - t0) / 1000, VN_DURATION)); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, vnTime]);

  useEffect(() => () => window.speechSynthesis.cancel(), []);

  const togglePlay = () => {
    if (playing) {
      window.speechSynthesis.cancel();
      setPlaying(false); setVnTime(0); blip(420);
    } else {
      speakSample(() => { setPlaying(false); setVnTime(0); });
      setPlaying(true); blip(720);
    }
  };

  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const vnProgress = Math.round((vnTime / VN_DURATION) * 96) / 96;

  return (
    <div className="liquid-glass vn-panel">
      <div className="vn-top">
        <div>
          <p className="mono lab">SAMPLE</p>
          <p className="vn-name">sample.mp3</p>
        </div>
        <span className={`chip mono ${playing ? "on" : ""}`}>{playing ? "● LIVE" : "IDLE"}</span>
      </div>
      <WaveBars playing={playing} progress={vnProgress} />
      <div className="vn-foot">
        <button className={`play ${playing ? "on" : ""}`} onClick={togglePlay} aria-label={playing ? "Stop sample" : "Play sample"}>
          {playing
            ? <svg width="13" height="13" viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" rx="2" fill="currentColor"/></svg>
            : <svg width="13" height="13" viewBox="0 0 16 16"><path d="M3 1.6v12.8c0 1 1.1 1.6 2 1.1l10-6.4c.8-.5.8-1.7 0-2.2L5 .5C4.1 0 3 .6 3 1.6z" fill="currentColor"/></svg>}
        </button>
        <div className="seek"><i style={{ width: `${vnProgress * 100}%` }} /></div>
        <span className="mono time">{fmt(vnTime)} / {fmt(VN_DURATION)}</span>
      </div>
    </div>
  );
}

const MetricsPanel = React.memo(function MetricsPanel({ metrics, vColor }) {
  return (
    <section className="liquid-glass metrics" data-reveal>
      <div className="con-head">
        <p className="mono lab">FORENSIC BREAKDOWN</p>
        <span className="mono lab">CONFIDENCE / %</span>
      </div>
      {metrics.map(([label, val], i) => (
        <div key={label} className="metric">
          <span className="mono mno">{String(i + 1).padStart(2, "0")}</span>
          <span className="m-label">{label}</span>
          <div className="m-bar"><i style={{ width: `${val}%`, background: vColor, animationDelay: `${0.15 * i + 0.3}s` }} /></div>
          <span className="m-val mono">{val}</span>
        </div>
      ))}
    </section>
  );
});

function ResultsPage({ result, fileName, refId, onScanAnother, notify }) {
  const [displayAi, setDisplayAi] = useState(0);
  const verdict = result.ai >= 80 ? "danger" : result.ai >= 50 ? "warn" : "safe";
  const vColor = { danger: "#ff3b30", warn: "#ff9f0a", safe: "var(--volt)" }[verdict];
  const R = 112, CIRC = 2 * Math.PI * R;

  const verdictLabel = verdict === "danger" ? "HIGH PROBABILITY DEEPFAKE" : verdict === "warn" ? "SUSPICIOUS — AI MARKERS DETECTED" : "VERIFIED HUMAN VOICE";

  const copySummary = async () => {
    const text = `VoiceShield scan report\nFile: ${fileName || "n/a"}\nReference: ${refId || "n/a"}\nVerdict: ${verdictLabel}\nAI-generated probability: ${result.ai}%\nAuthentic-voice probability: ${result.real}%\nGenerated: ${new Date().toLocaleString()}`;
    try { await navigator.clipboard.writeText(text); notify?.("Result summary copied to clipboard.", "info"); }
    catch (e) { notify?.("Couldn't access the clipboard.", "warn"); }
  };

  const downloadReport = () => {
    const rowsHtml = result.metrics.map(([l, v]) => `<tr><td>${l}</td><td>${v}%</td></tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>VoiceShield report — ${refId || ""}</title>
      <style>body{font-family:Arial,sans-serif;max-width:640px;margin:40px auto;color:#111}
      h1{font-size:20px}table{width:100%;border-collapse:collapse;margin-top:16px}
      td{padding:8px 4px;border-bottom:1px solid #ddd}.v{font-size:48px;font-weight:700}
      .lab{color:#777;font-size:12px;letter-spacing:1px;text-transform:uppercase}</style></head>
      <body><p class="lab">VoiceShield — forensic scan report</p>
      <h1>${verdictLabel}</h1>
      <p class="v">${result.ai}% <span style="font-size:16px;color:#777">AI-generated</span></p>
      <p>File: ${fileName || "n/a"}<br/>Reference: ${refId || "n/a"}<br/>Generated: ${new Date().toLocaleString()}</p>
      <table>${rowsHtml}</table>
      <p class="lab" style="margin-top:24px">Demo build — scores are simulated, not forensic evidence.</p>
      </body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `voiceshield-report-${refId || Date.now()}.html`; a.click();
    URL.revokeObjectURL(url);
    notify?.("Report downloaded — open it in a browser and print to PDF if needed.", "info");
  };

  useEffect(() => {
    setDisplayAi(0);
    let raf, s, last = 0;
    const step = (t) => {
      if (!s) s = t;
      const p = Math.min((t - s) / 1600, 1);
      if (t - last > 33 || p === 1) { last = t; setDisplayAi(Math.round(result.ai * (1 - Math.pow(1 - p, 3)))); }
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [result.ai]);

  return (
    <main className="page res-page" id="main-content">
      <div className={`liquid-glass verdict-banner vb-${verdict}`} data-reveal>
        <span className="vb-pulse" />
        {verdict === "danger" && <>HIGH PROBABILITY <Glitch>DEEPFAKE</Glitch> — DO NOT TRUST THIS AUDIO</>}
        {verdict === "warn" && <>SUSPICIOUS — <Glitch>AI</Glitch> MARKERS DETECTED · VERIFY THE SOURCE</>}
        {verdict === "safe" && <>VERIFIED HUMAN VOICE — NO SYNTHETIC SIGNATURES FOUND</>}
      </div>

      <section className="res-grid">
        <div className="float-wrap a" data-reveal>
          <div className="liquid-glass res-num">
            <p className="mono lab">TRUST SCORE</p>
            <p className="big-num" style={{ color: vColor }}>{displayAi}<em>%</em></p>
            <p className="big-cap">{result.ai >= 50 ? <Glitch>AI GENERATED</Glitch> : "AI GENERATED"}</p>
            <p className="vline">
              {verdict === "danger" && <>Overall, this audio is generated via <Glitch>AI</Glitch> voice synthesis.</>}
              {verdict === "warn" && "Overall, this audio shows mixed signals — treat with caution."}
              {verdict === "safe" && "Overall, this audio appears to be a real human voice."}
            </p>
            {fileName && <p className="mono src">SOURCE · {fileName}</p>}
            {refId && <p className="mono src ref-line">REF · {refId} · {new Date().toLocaleDateString()}</p>}
          </div>
        </div>

        <div className="float-wrap b" data-reveal>
          <div className="liquid-glass res-gauge">
            <div className="gauge-w">
              <svg viewBox="0 0 280 280" className="gauge">
                <circle cx="140" cy="140" r={R} className="g-track" />
                <circle cx="140" cy="140" r={R} className="g-fill" stroke={vColor}
                  strokeDasharray={CIRC} strokeDashoffset={CIRC - (CIRC * displayAi) / 100} />
                <circle cx="140" cy="140" r={R - 22} className="g-inner" />
              </svg>
              <div className="g-center mono">
                <span>{displayAi}%</span>
                <small>SYNTHETIC</small>
              </div>
            </div>
            <div className="split">
              <div className="si"><b style={{ color: vColor }}>{result.ai}%</b><span className="mono"><Glitch>AI</Glitch> GENERATED</span></div>
              <div className="si"><b>{result.real}%</b><span className="mono">AUTHENTIC VOICE</span></div>
            </div>
          </div>
        </div>
      </section>

      <div className="float-wrap a">
        <MetricsPanel metrics={result.metrics} vColor={vColor} />
      </div>

      <div className="res-actions" data-reveal>
        <button className="tlink mono sm-btn" onClick={copySummary}>COPY SUMMARY</button>
        <button className="tlink mono sm-btn" onClick={downloadReport}>DOWNLOAD REPORT</button>
      </div>

      <div className="cta-wrap" data-reveal>
        <button className="cta" onClick={onScanAnother}>
          SCAN ANOTHER AUDIO <i>→</i>
        </button>
      </div>
    </main>
  );
}

/* ══════════════════ #11 RECENT-ACTIVITY SPARKLINE ══════════════════ */
const Sparkline = React.memo(function Sparkline({ points }) {
  if (!points.length) return null;
  const W = 240, H = 56, pad = 4;
  const max = 100;
  const step = points.length > 1 ? (W - pad * 2) / (points.length - 1) : 0;
  const coords = points.map((v, i) => [pad + i * step, H - pad - ((v / max) * (H - pad * 2))]);
  const d = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(" ");
  const last = coords[coords.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="spark" preserveAspectRatio="none" aria-hidden="true">
      <path d={d} fill="none" stroke="var(--volt)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill="var(--volt)" />
    </svg>
  );
});

/* ══════════════════ #8 LIVE MIC LEVEL METER ══════════════════ */
function MicLevelMeter({ stream, active }) {
  const [level, setLevel] = useState(0);
  const rafRef = useRef(null);
  useEffect(() => {
    if (!active || !stream) { setLevel(0); return; }
    let ctx, analyser, data, source;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      data = new Uint8Array(analyser.frequencyBinCount);
      source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setLevel(Math.min(100, Math.round((avg / 255) * 140)));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {}
    return () => {
      cancelAnimationFrame(rafRef.current);
      try { source && source.disconnect(); analyser && analyser.disconnect(); ctx && ctx.close(); } catch (e) {}
    };
  }, [active, stream]);
  if (!active) return null;
  return (
    <div className="mic-meter" aria-hidden="true">
      {Array.from({ length: 12 }).map((_, i) => (
        <span key={i} className={`mic-seg ${level >= (i + 1) * 8.3 ? "lit" : ""}`} />
      ))}
    </div>
  );
}

/* ══════════════════ #14 QUOTA BANNER ══════════════════ */
function QuotaBanner({ used, limit, planName, onUpgrade }) {
  if (limit === Infinity) return null;
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const atLimit = used >= limit;
  const near = pct >= 80 && !atLimit;
  if (!near && !atLimit) return null;
  return (
    <div className={`liquid-glass quota-banner ${atLimit ? "at-limit" : "near-limit"}`} data-reveal role="status">
      <div className="qb-text">
        <p className="mono lab">{atLimit ? "MONTHLY LIMIT REACHED" : "APPROACHING MONTHLY LIMIT"}</p>
        <p className="qb-sub">{used} / {limit} scans used on the {planName} plan this month.</p>
      </div>
      <button className="cta sm qb-btn" onClick={onUpgrade}>UPGRADE PLAN <i>→</i></button>
    </div>
  );
}

/* ══════════════════ ACCOUNT MENU ══════════════════ */
function AccountMenu({ user, plan, onOpenAuth, onLogout, onNav }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!user) {
    return <button className="hbtn back mono" onClick={onOpenAuth}>SIGN IN</button>;
  }
  return (
    <div className="acct-wrap" ref={ref}>
      <button className="acct-avatar" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {initials(user.name)}
      </button>
      {open && (
        <div className="acct-menu liquid-glass" role="menu">
          <p className="acct-name">{user.name}</p>
          <p className="acct-email mono">{user.email}</p>
          <span className={`plan-badge pb-${plan.id}`}>{plan.name} PLAN</span>
          <button role="menuitem" onClick={() => { onNav("history"); setOpen(false); }}>Scan history</button>
          <button role="menuitem" onClick={() => { onNav("pricing"); setOpen(false); }}>Billing & plan</button>
          <button role="menuitem" onClick={() => { onNav("settings"); setOpen(false); }}>Settings & privacy</button>
          <button role="menuitem" className="acct-out" onClick={() => { onLogout(); setOpen(false); }}>Sign out</button>
        </div>
      )}
    </div>
  );
}

/* ══════════════════ MOBILE BOTTOM TAB BAR (#9) ══════════════════ */
function MobileTabBar({ page, onNav, hasUser }) {
  const tabs = [
    { id: "home", label: "Scan", icon: "◎" },
    { id: "history", label: "History", icon: "☰" },
    { id: "pricing", label: "Plans", icon: "◆" },
    { id: "account", label: hasUser ? "Account" : "Sign in", icon: "●" },
  ];
  return (
    <nav className="mtab" aria-label="Primary">
      {tabs.map((t) => (
        <button key={t.id} className={`mtab-btn ${page === t.id ? "on" : ""}`} onClick={() => onNav(t.id)}>
          <span className="mtab-ico" aria-hidden="true">{t.icon}</span>
          <span className="mtab-lab">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

/* ══════════════════ #6 AUTH MODAL (Google + email) ══════════════════ */
function AuthModal({ onClose, onAuthed, notify }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const googleDivRef = useRef(null);
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return; // no client id configured — fall back button shown instead
    const scriptId = "google-identity-services";
    function init() {
      if (!window.google || !googleDivRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (resp) => {
          const payload = decodeJwtPayload(resp.credential);
          if (!payload) return notify("Google sign-in failed to decode.", "danger");
          onAuthed({ name: payload.name || "Google User", email: payload.email, provider: "google", plan: "free" });
        },
      });
      window.google.accounts.id.renderButton(googleDivRef.current, { theme: "filled_black", size: "large", width: 280 });
    }
    if (document.getElementById(scriptId)) { init(); return; }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true; s.defer = true; s.id = scriptId;
    s.onload = init;
    document.body.appendChild(s);
  }, [GOOGLE_CLIENT_ID]); // eslint-disable-line react-hooks/exhaustive-deps

  const demoGoogle = () => {
    notify("Demo mode: set VITE_GOOGLE_CLIENT_ID to enable real Google Sign-In.", "info");
    onAuthed({ name: "Demo Google User", email: "demo.user@gmail.com", provider: "google", plan: "free" });
  };

  const submitEmail = (e) => {
    e.preventDefault();
    if (!email || !pass || (mode === "signup" && !name)) return notify("Please fill in all fields.", "warn");
    const accounts = readJSON(LS.accounts, {});
    if (mode === "signup") {
      if (accounts[email]) return notify("An account with this email already exists.", "warn");
      accounts[email] = { name, passHash: btoa(pass), plan: "free" };
      writeJSON(LS.accounts, accounts);
      onAuthed({ name, email, provider: "email", plan: "free" });
    } else {
      const acc = accounts[email];
      if (!acc || acc.passHash !== btoa(pass)) return notify("Incorrect email or password.", "danger");
      onAuthed({ name: acc.name, email, provider: "email", plan: acc.plan || "free" });
    }
  };

  return (
    <div className="veil on center" onClick={onClose}>
      <div className="modal liquid-glass auth-modal" role="dialog" aria-modal="true" aria-label="Sign in" onClick={(e) => e.stopPropagation()}>
        <p className="mono lab">ACCOUNT / 01</p>
        <h3>{mode === "login" ? "Welcome back" : "Create your account"}</h3>

        {GOOGLE_CLIENT_ID
          ? <div ref={googleDivRef} className="google-btn-slot" />
          : <button type="button" className="google-btn-fallback" onClick={demoGoogle}>
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.3 1 7.3 2.8l6-6C33.6 6.2 29.1 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.6 16 18.9 13 24 13c2.8 0 5.3 1 7.3 2.8l6-6C33.6 6.2 29.1 4 24 4c-7.6 0-14.1 4.3-17.7 10.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.4 26.7 36 24 36c-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C9.8 39.6 16.4 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.2 5.2C40.7 36.3 44 30.7 44 24c0-1.2-.1-2.4-.4-3.5z"/></svg>
              Continue with Google
            </button>}

        <div className="auth-divider mono"><span /> OR {mode === "login" ? "SIGN IN" : "SIGN UP"} WITH EMAIL <span /></div>

        <form className="auth-form" onSubmit={submitEmail}>
          {mode === "signup" && (
            <label className="field">
              <span className="mono">FULL NAME</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" autoComplete="name" />
            </label>
          )}
          <label className="field">
            <span className="mono">EMAIL</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          </label>
          <label className="field">
            <span className="mono">PASSWORD</span>
            <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••" autoComplete={mode === "login" ? "current-password" : "new-password"} />
          </label>
          <button className="cta sm" type="submit">{mode === "login" ? "SIGN IN" : "CREATE ACCOUNT"}</button>
        </form>

        <button className="auth-switch mono" onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}>
          {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
        <p className="auth-fine">Demo build — accounts are stored locally in your browser, not on a server.</p>
      </div>
    </div>
  );
}

/* ══════════════════ #7 PRICING PAGE ══════════════════ */
function PricingPage({ plan, onChoose, onCheckout, user }) {
  const [yearly, setYearly] = useState(false);
  const tiers = [
    { id: "free", name: "Free", blurb: "Try VoiceShield on real calls and clips.", monthly: 0, features: ["50 scans / month", "Upload & live recording", "Trust score + forensic breakdown", "Scan history (local)"] },
    { id: "pro", name: "Pro", blurb: "For creators, journalists & power users.", monthly: 9, features: ["2,000 scans / month", "Everything in Free", "Downloadable PDF reports", "Priority analysis queue", "Email support"] },
    { id: "business", name: "Business", blurb: "For teams verifying calls at scale.", monthly: 29, features: ["Unlimited scans", "Everything in Pro", "Team seats & shared history", "API access", "Priority support & SLA"] },
  ];
  return (
    <main className="page" id="main-content">
      <section className="sect-head pricing-head" data-reveal>
        <span className="mono idx">$</span>
        <h2 className="sect-t">Simple <em>pricing</em></h2>
        <span className="rule" />
      </section>
      <p className="pricing-lede" data-reveal>Start free. Upgrade when you need more scans, exports or team access.</p>

      <div className="billing-toggle mono" data-reveal>
        <button className={!yearly ? "on" : ""} onClick={() => setYearly(false)}>MONTHLY</button>
        <button className={yearly ? "on" : ""} onClick={() => setYearly(true)}>YEARLY <em>· 2 months free</em></button>
      </div>

      <div className="tiles pricing-grid" data-reveal>
        {tiers.map((t) => {
          const price = t.monthly === 0 ? 0 : yearly ? Math.round(t.monthly * 10 / 12) : t.monthly;
          const isCurrent = plan.id === t.id;
          return (
            <div key={t.id} className={`liquid-glass price-card ${t.id === "pro" ? "featured" : ""}`}>
              {t.id === "pro" && <span className="price-pop mono">MOST POPULAR</span>}
              <p className="mono lab">{t.name.toUpperCase()}</p>
              <p className="price-amt">${price}<span className="mono">{t.monthly === 0 ? "/ forever" : "/ mo"}</span></p>
              <p className="price-blurb">{t.blurb}</p>
              <ul className="price-feats">
                {t.features.map((f) => <li key={f}><span className="pf-check">✓</span>{f}</li>)}
              </ul>
              <button
                className={`cta sm ${isCurrent ? "current" : ""}`}
                disabled={isCurrent}
                onClick={() => (t.monthly === 0 ? onChoose(t.id) : onCheckout(t, yearly ? "yearly" : "monthly"))}
              >
                {isCurrent ? "CURRENT PLAN" : t.id === "free" ? "DOWNGRADE" : "UPGRADE"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="pay-methods mono" data-reveal>
        <span>WE ACCEPT</span>
        <span className="pm-chip">VISA</span><span className="pm-chip">MASTERCARD</span><span className="pm-chip">AMEX</span><span className="pm-chip">RUPAY</span><span className="pm-chip">UPI</span>
        <span className="pm-lock">🔒 SANDBOX CHECKOUT — NO REAL CHARGE</span>
      </div>

      <TrustBadges />
      <ComparisonTable />
      <FAQAccordion />
    </main>
  );
}

/* ══════════════════ #5 / #13 HISTORY PAGE (with search & filter) ══════════════════ */
function HistoryPage({ history, onClear, onExport }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const rows = history.filter((h) => {
    if (filter !== "all" && h.verdict !== filter) return false;
    if (query && !h.fileName.toLowerCase().includes(query.toLowerCase()) && !h.refId.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <main className="page" id="main-content">
      <section className="sect-head" data-reveal>
        <span className="mono idx">☰</span>
        <h2 className="sect-t">Scan <em>history</em></h2>
        <span className="rule" />
      </section>

      <div className="liquid-glass history-toolbar" data-reveal>
        <input
          className="hist-search"
          placeholder="Search by file name or reference ID…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search history"
        />
        <div className="hist-filters mono">
          {["all", "danger", "warn", "safe"].map((f) => (
            <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
              {f === "all" ? "ALL" : f === "danger" ? "DEEPFAKE" : f === "warn" ? "SUSPICIOUS" : "HUMAN"}
            </button>
          ))}
        </div>
        <div className="hist-actions">
          <button className="tlink mono sm-btn" onClick={onExport}>EXPORT JSON</button>
          <button className="tlink mono sm-btn" onClick={onClear}>CLEAR HISTORY</button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="liquid-glass hist-empty" data-reveal>
          <p className="mono lab">NO SCANS YET</p>
          <p>Run a scan from the home page — every result you generate will show up here.</p>
        </div>
      ) : (
        <div className="liquid-glass hist-table" data-reveal>
          <div className="hist-row hist-head mono">
            <span>FILE</span><span>DATE</span><span>VERDICT</span><span>AI %</span><span>REF</span>
          </div>
          {rows.map((h) => (
            <div key={h.refId} className={`hist-row hist-v-${h.verdict}`}>
              <span className="hist-file">{h.fileName}</span>
              <span className="mono">{new Date(h.ts).toLocaleString()}</span>
              <span className={`hist-badge hb-${h.verdict}`}>
                {h.verdict === "danger" ? "DEEPFAKE" : h.verdict === "warn" ? "SUSPICIOUS" : "HUMAN"}
              </span>
              <span className="mono">{h.ai}%</span>
              <span className="mono hist-ref">{h.refId}</span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

/* ══════════════════ #12 SETTINGS & PRIVACY MODAL ══════════════════ */
function SettingsModal({ onClose, usage, limit, planName, onClearHistory, onExportHistory, onShowShortcuts }) {
  return (
    <div className="veil on center" onClick={onClose}>
      <div className="modal liquid-glass" role="dialog" aria-modal="true" aria-label="Settings and privacy" onClick={(e) => e.stopPropagation()}>
        <p className="mono lab">ACCOUNT / 02</p>
        <h3>Settings & privacy</h3>
        <div className="settings-block">
          <p className="mono lab">USAGE THIS MONTH</p>
          <p className="vline">{usage} / {limit === Infinity ? "∞" : limit} scans used on the {planName} plan.</p>
        </div>
        <div className="settings-block">
          <p className="mono lab">YOUR DATA</p>
          <p className="vline">Scan history and account details are stored only in this browser.</p>
          <div className="settings-btn-row">
            <button className="tlink mono sm-btn" onClick={onExportHistory}>EXPORT AS JSON</button>
            <button className="tlink mono sm-btn" onClick={onClearHistory}>CLEAR HISTORY</button>
          </div>
        </div>
        <div className="settings-block">
          <p className="mono lab">SHORTCUTS</p>
          <button className="tlink mono sm-btn" onClick={onShowShortcuts}>VIEW KEYBOARD SHORTCUTS</button>
        </div>
        <button className="cta sm" onClick={onClose}>DONE</button>
      </div>
    </div>
  );
}

/* ══════════════════ #6 KEYBOARD SHORTCUTS MODAL ══════════════════ */
function ShortcutsModal({ onClose }) {
  const rows = [
    ["U", "Upload an audio file"],
    ["R", "Start / stop live recording"],
    ["H", "Go to scan history"],
    ["G then P", "Go to pricing"],
    ["?", "Open this shortcuts panel"],
    ["Esc", "Close any open panel"],
  ];
  return (
    <div className="veil on center" onClick={onClose}>
      <div className="modal liquid-glass" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={(e) => e.stopPropagation()}>
        <p className="mono lab">HELP / 01</p>
        <h3>Keyboard shortcuts</h3>
        <div className="shortcut-list">
          {rows.map(([k, d]) => (
            <div key={k} className="shortcut-row">
              <kbd className="kbd mono">{k}</kbd>
              <span>{d}</span>
            </div>
          ))}
        </div>
        <button className="cta sm" onClick={onClose}>GOT IT</button>
      </div>
    </div>
  );
}

/* ══════════════════ UPGRADE CONFIRM (demo billing) MODAL ══════════════════ */
function UpgradeConfirmModal({ target, onClose, onConfirm }) {
  const tier = PLANS[target];
  return (
    <div className="veil on center" onClick={onClose}>
      <div className="modal liquid-glass" role="dialog" aria-modal="true" aria-label="Confirm plan change" onClick={(e) => e.stopPropagation()}>
        <p className="mono lab">BILLING / 01</p>
        <h3>Switch to {tier.name}?</h3>
        <p className="vline">This is a demo build — no payment is collected and no card is charged. Confirming just updates your plan locally so you can preview {tier.name} limits ({tier.limit === Infinity ? "unlimited" : tier.limit} scans / month).</p>
        <button className="cta sm" onClick={onConfirm}>CONFIRM {tier.name.toUpperCase()}</button>
      </div>
    </div>
  );
}

/* ══════════════════ #15 BACKEND STATUS MONITOR ══════════════════
   Pings the backend's health endpoint so connectivity problems are
   visible immediately instead of only surfacing when a scan fails. */
function backendBaseUrl() {
  const analyzeUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api/analyze";
  return analyzeUrl.replace(/\/api\/analyze\/?$/, "");
}

function useBackendStatus() {
  const [status, setStatus] = useState("checking"); // checking | online | offline
  const [lastChecked, setLastChecked] = useState(null);

  const ping = useCallback(async () => {
    const base = backendBaseUrl();
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(`${base}/api/health`, { signal: ctrl.signal }).catch(() =>
        fetch(base, { signal: ctrl.signal })
      );
      clearTimeout(t);
      setStatus(res && res.ok ? "online" : "offline");
    } catch (e) {
      setStatus("offline");
    } finally {
      setLastChecked(Date.now());
    }
  }, []);

  useEffect(() => {
    ping();
    const iv = setInterval(ping, 60000);
    return () => clearInterval(iv);
  }, [ping]);

  return { status, lastChecked, retry: ping };
}

function StatusPill({ status, onClick }) {
  const label = status === "checking" ? "CHECKING…" : status === "online" ? "BACKEND LIVE" : "DEMO MODE";
  return (
    <button className={`status-pill mono st-${status}`} onClick={onClick} title="Backend connectivity — click for details">
      <i className="status-dot" /> {label}
    </button>
  );
}

function StatusModal({ status, lastChecked, onClose, onRetry }) {
  const base = backendBaseUrl();
  return (
    <div className="veil on center" onClick={onClose}>
      <div className="modal liquid-glass" role="dialog" aria-modal="true" aria-label="System status" onClick={(e) => e.stopPropagation()}>
        <p className="mono lab">SYSTEM / 01</p>
        <h3>System status</h3>
        <div className="status-rows">
          <div className="status-row">
            <span>Frontend</span>
            <span className="hist-badge hb-safe mono">OPERATIONAL</span>
          </div>
          <div className="status-row">
            <span>Analysis API</span>
            <span className={`hist-badge mono ${status === "online" ? "hb-safe" : status === "checking" ? "hb-warn" : "hb-warn"}`}>
              {status === "online" ? "OPERATIONAL" : status === "checking" ? "CHECKING" : "UNREACHABLE — DEMO MODE ACTIVE"}
            </span>
          </div>
          <div className="status-row">
            <span>Model inference</span>
            <span className={`hist-badge mono ${status === "online" ? "hb-safe" : "hb-warn"}`}>{status === "online" ? "OPERATIONAL" : "UNKNOWN"}</span>
          </div>
        </div>
        <p className="vline">
          {status === "online"
            ? "Connected to the live backend — scans are analysed by the real model."
            : `Could not reach ${base}. Scans fall back to a clearly-labelled simulated result so the app keeps working. If you're the developer: confirm VITE_API_URL is set, the Render service is awake (free tier sleeps after ~15 min idle), and FRONTEND_ORIGIN matches this domain for CORS.`}
        </p>
        <p className="ref-line mono">{lastChecked ? `Last checked ${new Date(lastChecked).toLocaleTimeString()}` : ""}</p>
        <button className="cta sm" onClick={onRetry}>RECHECK NOW</button>
      </div>
    </div>
  );
}

/* ══════════════════ #16 ANIMATED STAT COUNTERS ══════════════════ */
function StatCounter({ to, suffix = "", label, decimals = 0 }) {
  const ref = useRef(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      const start = performance.now();
      const dur = 1400;
      const step = (now) => {
        const p = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        setVal(to * eased);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      io.disconnect();
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [to]);
  return (
    <div className="stat-cell" ref={ref}>
      <p className="stat-num">{val.toFixed(decimals)}{suffix}</p>
      <p className="stat-lab mono">{label}</p>
    </div>
  );
}

function StatsStrip() {
  return (
    <section className="sect" data-reveal>
      <div className="liquid-glass stats-strip">
        <StatCounter to={128430} label="VOICE SAMPLES SCANNED" />
        <StatCounter to={4217} label="DEEPFAKES FLAGGED" />
        <StatCounter to={99.2} suffix="%" decimals={1} label="UPTIME LAST 90 DAYS" />
        <StatCounter to={61} label="COUNTRIES REACHED" />
      </div>
    </section>
  );
}

/* ══════════════════ #17 TRUST / COMPLIANCE BADGES ══════════════════ */
function TrustBadges() {
  const badges = [
    ["🔒", "AES-256 in transit", "All uploads are sent over encrypted HTTPS."],
    ["🗑️", "Auto-deleted samples", "Audio files are analysed and removed from disk immediately after scoring."],
    ["🧾", "GDPR-minded", "No sample audio is retained; only the score and a reference ID are stored."],
    ["🛡️", "Independent research base", "Detection heuristics are grounded in the project's own spectral research."],
  ];
  return (
    <section className="sect" data-reveal>
      <div className="sect-head">
        <span className="mono idx">04</span>
        <h2 className="sect-t">Built with <em>trust</em> in mind</h2>
        <span className="rule" />
      </div>
      <div className="tiles trust-grid">
        {badges.map(([icon, t, d]) => (
          <div className="liquid-glass trust-card" key={t}>
            <span className="trust-ico" aria-hidden="true">{icon}</span>
            <p className="trust-t">{t}</p>
            <p className="trust-d">{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ══════════════════ #18 TESTIMONIALS CAROUSEL ══════════════════ */
const TESTIMONIALS = [
  { quote: "Caught a cloned voicemail from a 'relative' asking for gift cards within seconds. This is the tool I wish my parents had years ago.", name: "R. Fernandes", role: "Community moderator" },
  { quote: "We run every inbound vendor call through VoiceShield before wiring anything. It's now part of our finance team's checklist.", name: "S. Okafor", role: "Finance operations lead" },
  { quote: "The forensic breakdown makes it easy to explain to non-technical colleagues why a clip looked suspicious.", name: "T. Nakamura", role: "Journalist, fact-checking desk" },
  { quote: "Simple upload flow, fast result, clear verdict. Exactly what a first line of defence should feel like.", name: "A. Kapoor", role: "IT support manager" },
];

function TestimonialsCarousel() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setI((v) => (v + 1) % TESTIMONIALS.length), 6000);
    return () => clearInterval(iv);
  }, []);
  const t = TESTIMONIALS[i];
  return (
    <section className="sect" data-reveal>
      <div className="sect-head">
        <span className="mono idx">05</span>
        <h2 className="sect-t">What <em>people</em> say</h2>
        <span className="rule" />
      </div>
      <div className="liquid-glass testi-card">
        <p className="testi-quote">"{t.quote}"</p>
        <p className="testi-name">{t.name}<span className="testi-role"> — {t.role}</span></p>
        <div className="testi-dots">
          {TESTIMONIALS.map((_, idx) => (
            <button key={idx} className={`testi-dot ${idx === i ? "on" : ""}`} aria-label={`Testimonial ${idx + 1}`} onClick={() => setI(idx)} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════ #19 COMPARISON TABLE ══════════════════ */
function ComparisonTable() {
  const rows = [
    ["Detects AI-cloned voices", "✓", "✗", "Depends on ear training"],
    ["Works in under 10 seconds", "✓", "—", "✗"],
    ["Forensic breakdown report", "✓", "✗", "✗"],
    ["Scan history & export", "✓", "—", "✗"],
    ["Available 24/7", "✓", "✗", "✓"],
  ];
  return (
    <section className="sect" data-reveal>
      <div className="sect-head">
        <span className="mono idx">06</span>
        <h2 className="sect-t">Why not just <em>trust your ear</em>?</h2>
        <span className="rule" />
      </div>
      <div className="liquid-glass cmp-wrap">
        <div className="cmp-row cmp-head mono">
          <span /><span>VOICESHIELD</span><span>CALLER-ID APPS</span><span>MANUAL LISTENING</span>
        </div>
        {rows.map(([label, a, b, c]) => (
          <div className="cmp-row" key={label}>
            <span className="cmp-label">{label}</span>
            <span className="cmp-cell cmp-yes">{a}</span>
            <span className="cmp-cell">{b}</span>
            <span className="cmp-cell">{c}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ══════════════════ #20 FAQ ACCORDION ══════════════════ */
function FAQAccordion() {
  const items = [
    ["Is my audio stored anywhere?", "No — uploaded clips are analysed in memory / on temporary disk and deleted immediately after scoring. Only the numeric result and a reference ID are saved to your local history."],
    ["What file types can I upload?", "MP3, WAV, OGG, M4A and WEBM, up to 16 MB per file. You can also record live from your microphone for up to 15 seconds."],
    ["How accurate is the detection?", "Accuracy depends on the underlying model and audio quality. Treat the trust score as one strong signal among several — always verify high-stakes calls through a second, known channel too."],
    ["What happens if the backend is offline?", "The app automatically falls back to a clearly-labelled simulated result so you can still explore the interface. A live status indicator in the header shows whether you're connected to the real backend."],
    ["Can I use this for my whole team?", "Yes — the Business plan adds shared history and API access so a team can verify calls together. See the pricing page for details."],
    ["Do you sell or share my data?", "No. This is a demo/portfolio build with no third-party analytics or ad trackers."],
  ];
  const [open, setOpen] = useState(0);
  return (
    <section className="sect" data-reveal>
      <div className="sect-head">
        <span className="mono idx">07</span>
        <h2 className="sect-t">Frequently <em>asked</em></h2>
        <span className="rule" />
      </div>
      <div className="liquid-glass faq-wrap">
        {items.map(([q, a], idx) => (
          <div className={`faq-item ${open === idx ? "open" : ""}`} key={q}>
            <button className="faq-q" onClick={() => setOpen(open === idx ? -1 : idx)} aria-expanded={open === idx}>
              <span>{q}</span><span className="faq-plus">{open === idx ? "−" : "+"}</span>
            </button>
            {open === idx && <p className="faq-a">{a}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ══════════════════ #21 INTEGRATIONS STRIP ══════════════════ */
function IntegrationsStrip() {
  const items = ["Zoom", "Google Meet", "Microsoft Teams", "Twilio", "Slack", "Discord"];
  return (
    <section className="sect" data-reveal>
      <div className="sect-head">
        <span className="mono idx">08</span>
        <h2 className="sect-t">Fits your <em>call stack</em></h2>
        <span className="rule" />
      </div>
      <p className="pricing-lede" style={{ marginTop: 0 }}>Planned integrations for Business plan teams — verify a caller without leaving the tools you already use.</p>
      <div className="integ-row">
        {items.map((n) => <span className="integ-chip mono" key={n}>{n}</span>)}
      </div>
    </section>
  );
}

/* ══════════════════ #22 DEVELOPER / API SECTION ══════════════════ */
function DeveloperAPISection({ onGetKey }) {
  const snippet = `curl -X POST https://api.voiceshield.app/v1/analyze \\
  -H "Authorization: Bearer $VOICESHIELD_API_KEY" \\
  -F "audio=@call_clip.wav"

# → { "ai": 87, "real": 13, "prediction": "FAKE", "confidence": 87.4 }`;
  return (
    <section className="sect" data-reveal>
      <div className="sect-head">
        <span className="mono idx">09</span>
        <h2 className="sect-t">Build on the <em>API</em></h2>
        <span className="rule" />
      </div>
      <div className="liquid-glass api-card">
        <p className="mono lab">BUSINESS PLAN · REST API</p>
        <pre className="code-block mono">{snippet}</pre>
        <div className="res-actions">
          <button className="cta sm" onClick={onGetKey}>GET AN API KEY</button>
          <span className="auth-fine">Demo build — no live API is exposed yet.</span>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════ #23 CASE STUDIES ══════════════════ */
function CaseStudiesGrid() {
  const cases = [
    ["Regional credit union", "Cut successful voice-phishing attempts on the member-support line to zero over one quarter by screening suspicious callbacks."],
    ["Independent newsroom", "Used forensic breakdowns to corroborate a leaked audio clip before publishing, with a documented trust score in the byline."],
    ["Family safety group", "Rolled out a shared 'verify before you wire' habit across 40+ households after a near-miss grandparent scam."],
  ];
  return (
    <section className="sect" data-reveal>
      <div className="sect-head">
        <span className="mono idx">10</span>
        <h2 className="sect-t">Case <em>studies</em></h2>
        <span className="rule" />
      </div>
      <div className="tiles cases-grid">
        {cases.map(([t, d]) => (
          <div className="liquid-glass case-card" key={t}>
            <p className="mono lab">ILLUSTRATIVE EXAMPLE</p>
            <p className="case-t">{t}</p>
            <p className="case-d">{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ══════════════════ #24 ROADMAP / CHANGELOG ══════════════════ */
function RoadmapTimeline() {
  const rows = [
    ["Shipped", "Live microphone recording + batch upload queue"],
    ["Shipped", "Local scan history with search, filters & JSON export"],
    ["In progress", "Real-time streaming detection during live calls"],
    ["Planned", "Native mobile app (iOS / Android)"],
    ["Planned", "Team workspaces with shared verification queues"],
  ];
  return (
    <section className="sect" data-reveal>
      <div className="sect-head">
        <span className="mono idx">11</span>
        <h2 className="sect-t">Product <em>roadmap</em></h2>
        <span className="rule" />
      </div>
      <div className="liquid-glass road-wrap">
        {rows.map(([status, label], idx) => (
          <div className="road-row" key={idx}>
            <span className={`hist-badge mono ${status === "Shipped" ? "hb-safe" : status === "In progress" ? "hb-warn" : "hb-danger"}`}>{status.toUpperCase()}</span>
            <span className="road-label">{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ══════════════════ #25 LIVE ACTIVITY TICKER ══════════════════ */
function LiveActivityFeed() {
  const seed = ["voicemail_clip.mp3 → HUMAN", "unknown_caller.wav → SUSPICIOUS", "vendor_call.m4a → HUMAN", "voicemail_2.ogg → DEEPFAKE", "support_line.wav → HUMAN", "recording_047.mp3 → SUSPICIOUS"];
  const [rows, setRows] = useState(seed);
  useEffect(() => {
    const iv = setInterval(() => {
      setRows((r) => {
        const verdicts = ["HUMAN", "HUMAN", "SUSPICIOUS", "DEEPFAKE"];
        const names = ["call_clip", "voice_note", "vendor_line", "unknown_number", "recording"];
        const n = `${names[Math.floor(Math.random() * names.length)]}_${Math.floor(Math.random() * 900 + 100)}.wav`;
        const v = verdicts[Math.floor(Math.random() * verdicts.length)];
        return [`${n} → ${v}`, ...r].slice(0, 6);
      });
    }, 4500);
    return () => clearInterval(iv);
  }, []);
  return (
    <section className="sect" data-reveal>
      <div className="sect-head">
        <span className="mono idx">12</span>
        <h2 className="sect-t">Live <em>activity</em> (anonymized)</h2>
        <span className="rule" />
      </div>
      <div className="liquid-glass ticker-wrap">
        {rows.map((r, idx) => {
          const [file, verdict] = r.split(" → ");
          const cls = verdict === "DEEPFAKE" ? "hb-danger" : verdict === "SUSPICIOUS" ? "hb-warn" : "hb-safe";
          return (
            <div className="ticker-row" key={idx}>
              <span className="bq-dot" style={{ background: "var(--accent3)" }} />
              <span className="ticker-file mono">{file}</span>
              <span className={`hist-badge mono ${cls}`}>{verdict}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ══════════════════ #26 REFERRAL PROGRAM ══════════════════ */
function ReferralSection({ user }) {
  const code = useMemo(() => "VS-" + btoa(user?.email || "guest").replace(/[^A-Z0-9]/gi, "").slice(0, 6).toUpperCase(), [user]);
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
  };
  return (
    <section className="sect" data-reveal>
      <div className="sect-head">
        <span className="mono idx">13</span>
        <h2 className="sect-t">Give a <em>month</em>, get a month</h2>
        <span className="rule" />
      </div>
      <div className="liquid-glass referral-card">
        <p className="vline">Share your code — when a friend upgrades to Pro, you both get a free month.</p>
        <div className="ref-row">
          <code className="ref-code mono">{code}</code>
          <button className="cta sm" onClick={copy}>{copied ? "COPIED ✓" : "COPY CODE"}</button>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════ #27 NEWSLETTER SIGNUP ══════════════════ */
function NewsletterSignup({ notify }) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const submit = (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return notify("Enter a valid email address.", "warn");
    setDone(true);
    notify("Subscribed — you'll hear about major detection updates.", "info");
  };
  return (
    <section className="sect" data-reveal>
      <div className="liquid-glass newsletter-card">
        <div>
          <p className="mono lab">STAY IN THE LOOP</p>
          <p className="vline">Occasional emails about new scam patterns and product updates. No spam.</p>
        </div>
        {done ? (
          <p className="hist-badge hb-safe mono">SUBSCRIBED ✓</p>
        ) : (
          <form className="news-form" onSubmit={submit}>
            <input className="hist-search" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email for newsletter" />
            <button className="cta sm" type="submit">SUBSCRIBE</button>
          </form>
        )}
      </div>
    </section>
  );
}

/* ══════════════════ #28 / #29 APP + EXTENSION TEASERS ══════════════════ */
function DownloadTeasers() {
  return (
    <section className="sect" data-reveal>
      <div className="sect-head">
        <span className="mono idx">14</span>
        <h2 className="sect-t">Take it <em>everywhere</em></h2>
        <span className="rule" />
      </div>
      <div className="tiles download-grid">
        <div className="liquid-glass download-card">
          <p className="mono lab">MOBILE APP · PLANNED</p>
          <p className="case-t">Scan calls the moment they land</p>
          <div className="store-row">
            <span className="store-badge mono">▲ App Store</span>
            <span className="store-badge mono">▶ Google Play</span>
          </div>
        </div>
        <div className="liquid-glass download-card">
          <p className="mono lab">BROWSER EXTENSION · PLANNED</p>
          <p className="case-t">Verify voice notes on any web page</p>
          <div className="store-row">
            <span className="store-badge mono">Chrome</span>
            <span className="store-badge mono">Edge</span>
            <span className="store-badge mono">Firefox</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════ #30 TEAM / ABOUT ══════════════════ */
function TeamSection() {
  const team = [
    ["Product & ML", "Owns the detection pipeline and forensic scoring model."],
    ["Frontend engineering", "Builds and maintains the scan console and reporting UI."],
    ["Backend & infra", "Runs the API, database and uptime for every scan."],
  ];
  return (
    <section className="sect" data-reveal>
      <div className="sect-head">
        <span className="mono idx">15</span>
        <h2 className="sect-t">The <em>team</em></h2>
        <span className="rule" />
      </div>
      <div className="tiles team-grid">
        {team.map(([role, d]) => (
          <div className="liquid-glass team-card" key={role}>
            <div className="team-avatar mono">{role.split(" ").map((w) => w[0]).slice(0, 2).join("")}</div>
            <p className="case-t">{role}</p>
            <p className="case-d">{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ══════════════════ #31 ENTERPRISE CONTACT FORM ══════════════════ */
function EnterpriseContactForm({ notify }) {
  const [form, setForm] = useState({ name: "", company: "", email: "", size: "1–10" });
  const [sent, setSent] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = (e) => {
    e.preventDefault();
    if (!form.name || !form.company || !/^\S+@\S+\.\S+$/.test(form.email)) return notify("Fill in your name, company and a valid email.", "warn");
    setSent(true);
    notify("Thanks — your enterprise inquiry has been noted.", "info");
  };
  return (
    <section className="sect" data-reveal>
      <div className="sect-head">
        <span className="mono idx">16</span>
        <h2 className="sect-t">Talk to <em>sales</em></h2>
        <span className="rule" />
      </div>
      <div className="liquid-glass enterprise-card">
        {sent ? (
          <div>
            <p className="hist-badge hb-safe mono">REQUEST RECEIVED ✓</p>
            <p className="vline" style={{ marginTop: 10 }}>Someone from the team will follow up at {form.email}.</p>
          </div>
        ) : (
          <form className="auth-form ent-form" onSubmit={submit}>
            <div className="ent-grid">
              <label className="field"><span className="mono">FULL NAME</span><input value={form.name} onChange={set("name")} placeholder="Ada Lovelace" /></label>
              <label className="field"><span className="mono">COMPANY</span><input value={form.company} onChange={set("company")} placeholder="Acme Inc." /></label>
              <label className="field"><span className="mono">WORK EMAIL</span><input type="email" value={form.email} onChange={set("email")} placeholder="you@company.com" /></label>
              <label className="field">
                <span className="mono">TEAM SIZE</span>
                <select className="select" value={form.size} onChange={set("size")}>
                  {["1–10", "11–50", "51–200", "200+"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            </div>
            <button className="cta sm" type="submit">REQUEST A DEMO</button>
          </form>
        )}
      </div>
    </section>
  );
}

/* ══════════════════ #32 NOTIFICATION BELL ══════════════════ */
function NotificationBell() {
  const [open, setOpen] = useState(false);
  const items = [
    ["New detection model", "Formant-stability scoring improved on short clips."],
    ["Weekly digest", "3 deepfake patterns trending in voicemail scams this week."],
    ["Tip", "Add a family safe-word — it beats any AI detector for phone scams."],
  ];
  return (
    <div className="acct-wrap">
      <button className="hbtn bell" aria-label="Notifications" onClick={() => setOpen((o) => !o)}>
        🔔<span className="bell-dot" />
      </button>
      {open && (
        <div className="acct-menu liquid-glass notif-menu" role="menu">
          <p className="acct-name">Notifications</p>
          {items.map(([t, d]) => (
            <div className="notif-item" key={t}>
              <p className="notif-t">{t}</p>
              <p className="notif-d">{d}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════ #33 LANGUAGE SELECTOR (display-only) ══════════════════ */
function LanguageSelector() {
  const [lang, setLang] = useState("EN");
  const [open, setOpen] = useState(false);
  const langs = ["EN", "ES", "FR", "HI", "DE"];
  return (
    <div className="acct-wrap">
      <button className="hbtn mono" onClick={() => setOpen((o) => !o)} aria-label="Language">{lang}</button>
      {open && (
        <div className="acct-menu liquid-glass lang-menu" role="menu">
          {langs.map((l) => (
            <button key={l} onClick={() => { setLang(l); setOpen(false); }}>{l === "EN" ? "English" : l === "ES" ? "Español" : l === "FR" ? "Français" : l === "HI" ? "हिन्दी" : "Deutsch"}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════ #34 COOKIE / CONSENT BANNER ══════════════════ */
function CookieBanner() {
  const [visible, setVisible] = useState(() => !readJSON("vs_cookie_ok", false));
  if (!visible) return null;
  const accept = () => { writeJSON("vs_cookie_ok", true); setVisible(false); };
  return (
    <div className="cookie-banner liquid-glass">
      <p>This demo uses local storage only (no third-party cookies or ad trackers) to remember your theme, plan and scan history on this device.</p>
      <button className="cta sm" onClick={accept}>GOT IT</button>
    </div>
  );
}

/* ══════════════════ #35 PRESS / SOCIAL PROOF STRIP ══════════════════ */
function PressStrip() {
  const items = ["FEATURED IN CAMPUS TECH DIGEST", "HACKATHON FINALIST 2026", "DEV COMMUNITY SPOTLIGHT", "OPEN SOURCE WEEKLY"];
  return (
    <div className="press-strip mono" data-reveal>
      {items.map((i) => <span key={i}>{i}</span>)}
    </div>
  );
}

/* ══════════════════ #36 PAYMENT / CHECKOUT MODAL ══════════════════
   Client-side only — no real payment processor is wired up in this
   build. Card details are formatted/validated in the browser and
   never leave it (nothing is sent over the network here); wire this
   form up to Stripe Elements / a PCI-compliant processor before
   accepting real cards in production. */
function luhnValid(num) {
  const digits = num.replace(/\D/g, "");
  if (digits.length < 12) return false;
  let sum = 0, dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i], 10);
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d; dbl = !dbl;
  }
  return sum % 10 === 0;
}
function cardBrand(num) {
  const d = num.replace(/\D/g, "");
  if (/^4/.test(d)) return "Visa";
  if (/^5[1-5]/.test(d)) return "Mastercard";
  if (/^3[47]/.test(d)) return "Amex";
  if (/^6(?:011|5)/.test(d)) return "Discover";
  return "Card";
}
function formatCardNumber(v) {
  const d = v.replace(/\D/g, "").slice(0, 16);
  return d.replace(/(.{4})/g, "$1 ").trim();
}
function formatExpiry(v) {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

function CheckoutModal({ tier, cycle, onClose, onSuccess, notify }) {
  const [step, setStep] = useState("form"); // form | processing | success
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [country, setCountry] = useState("India");
  const [zip, setZip] = useState("");
  const [promo, setPromo] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [errors, setErrors] = useState({});

  const price = tier.monthly === 0 ? 0 : cycle === "yearly" ? Math.round(tier.monthly * 10 / 12) : tier.monthly;
  const discount = promoApplied ? Math.round(price * 0.2 * 100) / 100 : 0;
  const total = Math.max(0, price - discount);

  const applyPromo = () => {
    if (promo.trim().toUpperCase() === "SHIELD20") { setPromoApplied(true); notify("Promo applied — 20% off.", "info"); }
    else notify("Invalid promo code.", "warn");
  };

  const validate = () => {
    const e = {};
    if (cardName.trim().length < 2) e.cardName = "Enter the name on the card.";
    if (!luhnValid(cardNumber)) e.cardNumber = "Enter a valid card number.";
    const [mm, yy] = expiry.split("/");
    const now = new Date();
    const validMonth = mm && +mm >= 1 && +mm <= 12;
    const validExpiry = validMonth && yy && (2000 + +yy > now.getFullYear() || (2000 + +yy === now.getFullYear() && +mm >= now.getMonth() + 1));
    if (!validExpiry) e.expiry = "Enter a valid future expiry (MM/YY).";
    if (!/^\d{3,4}$/.test(cvv)) e.cvv = "Enter a valid CVV.";
    if (zip.trim().length < 3) e.zip = "Enter a valid postal / ZIP code.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    setStep("processing");
    setTimeout(() => {
      setStep("success");
      onSuccess?.();
    }, 1600);
  };

  return (
    <div className="veil on center" onClick={step === "form" ? onClose : undefined}>
      <div className="modal liquid-glass checkout-modal" role="dialog" aria-modal="true" aria-label="Checkout" onClick={(e) => e.stopPropagation()}>
        {step === "form" && (
          <>
            <p className="mono lab">BILLING / 02 · SECURE CHECKOUT</p>
            <h3>Upgrade to {tier.name}</h3>
            <div className="order-summary">
              <div><span>{tier.name} plan · {cycle === "yearly" ? "billed yearly" : "billed monthly"}</span><span>${price.toFixed(2)}</span></div>
              {promoApplied && <div className="order-discount"><span>Promo SHIELD20</span><span>−${discount.toFixed(2)}</span></div>}
              <div className="order-total"><span>Total due today</span><span>${total.toFixed(2)}</span></div>
            </div>

            <form className="auth-form checkout-form" onSubmit={submit}>
              <label className="field">
                <span className="mono">NAME ON CARD</span>
                <input value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="Ada Lovelace" autoComplete="cc-name" />
                {errors.cardName && <span className="field-err">{errors.cardName}</span>}
              </label>
              <label className="field">
                <span className="mono">CARD NUMBER · {cardBrand(cardNumber)}</span>
                <input value={cardNumber} onChange={(e) => setCardNumber(formatCardNumber(e.target.value))} placeholder="4242 4242 4242 4242" inputMode="numeric" autoComplete="cc-number" maxLength={19} />
                {errors.cardNumber && <span className="field-err">{errors.cardNumber}</span>}
              </label>
              <div className="ent-grid">
                <label className="field">
                  <span className="mono">EXPIRY (MM/YY)</span>
                  <input value={expiry} onChange={(e) => setExpiry(formatExpiry(e.target.value))} placeholder="12/29" inputMode="numeric" autoComplete="cc-exp" maxLength={5} />
                  {errors.expiry && <span className="field-err">{errors.expiry}</span>}
                </label>
                <label className="field">
                  <span className="mono">CVV</span>
                  <input value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="123" inputMode="numeric" autoComplete="cc-csc" maxLength={4} />
                  {errors.cvv && <span className="field-err">{errors.cvv}</span>}
                </label>
              </div>
              <div className="ent-grid">
                <label className="field">
                  <span className="mono">COUNTRY</span>
                  <select className="select" value={country} onChange={(e) => setCountry(e.target.value)}>
                    {["India", "United States", "United Kingdom", "Germany", "Australia", "Other"].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span className="mono">POSTAL / ZIP CODE</span>
                  <input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="411014" />
                  {errors.zip && <span className="field-err">{errors.zip}</span>}
                </label>
              </div>
              <div className="promo-row">
                <input className="hist-search" value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="Promo code (try SHIELD20)" disabled={promoApplied} />
                <button type="button" className="tlink mono sm-btn" onClick={applyPromo} disabled={promoApplied}>{promoApplied ? "APPLIED ✓" : "APPLY"}</button>
              </div>
              <button className="cta sm" type="submit">PAY ${total.toFixed(2)} & UPGRADE</button>
              <p className="auth-fine">🔒 Sandbox checkout — this demo build does not transmit or store real card data. No live payment processor is connected.</p>
            </form>
          </>
        )}

        {step === "processing" && (
          <div className="checkout-processing">
            <div className="spinner" />
            <p className="mono lab">PROCESSING PAYMENT…</p>
          </div>
        )}

        {step === "success" && (
          <div className="checkout-success">
            <p className="success-check">✓</p>
            <h3>Payment successful</h3>
            <p className="vline">You're now on the {tier.name} plan. A receipt has been generated below.</p>
            <div className="order-summary">
              <div><span>Reference</span><span className="mono">{genRefId()}</span></div>
              <div><span>Plan</span><span>{tier.name} · {cycle === "yearly" ? "yearly" : "monthly"}</span></div>
              <div className="order-total"><span>Charged</span><span>${total.toFixed(2)}</span></div>
            </div>
            <button className="cta sm" onClick={onClose}>DONE</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════ #37 EXPANDED FOOTER ══════════════════ */
function SiteFooter({ onNav, onTerms }) {
  const cols = [
    ["Product", [["Run a scan", () => onNav("home")], ["Pricing", () => onNav("pricing")], ["Scan history", () => onNav("history")]]],
    ["Company", [["About the team", () => onNav("home", "team")], ["Case studies", () => onNav("home", "cases")], ["Roadmap", () => onNav("home", "roadmap")]]],
    ["Resources", [["FAQ", () => onNav("home", "faq")], ["Developer API", () => onNav("home", "api")], ["Enterprise", () => onNav("home", "enterprise")]]],
    ["Legal", [["Terms & conditions", onTerms], ["Security & privacy", () => onNav("home", "security")]]],
  ];
  return (
    <footer className="foot site-foot" data-reveal>
      <div className="foot-top">
        <div className="foot-brand">
          <p className="foot-big">Stay <em>human</em>-verified.</p>
          <p className="vline">VoiceShield is a demo/portfolio build showcasing an end-to-end AI voice-forensics product.</p>
          <a className="li" href="#" target="_blank" rel="noreferrer" aria-label="LinkedIn">
            <LinkedInIcon /> <span className="mono">/in/hackathon-team</span>
          </a>
        </div>
        <div className="foot-cols">
          {cols.map(([title, links]) => (
            <div className="foot-col" key={title}>
              <p className="mono lab">{title.toUpperCase()}</p>
              {links.map(([label, fn]) => (
                <button key={label} className="foot-link" onClick={fn}>{label}</button>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="foot-bottom">
        <p className="cpy mono">© 2026 VOICESHIELD — DEMO BUILD</p>
        <p className="cpy mono">MADE FOR RESEARCH & EDUCATIONAL USE</p>
      </div>
    </footer>
  );
}

/* ══════════════════ DATA ══════════════════ */
const TIPS = [
  ["Verify before you trust", "If a 'family member' calls asking for money urgently, hang up and call back on their known number. Voice clones need only seconds of audio."],
  ["Listen for artifacts", "Synthetic voices show flat emotion, odd breathing and unnatural pauses. Ask unexpected personal questions to break the script."],
  ["Never share OTPs", "No bank or agency asks for codes over a call. Urgency plus secrecy equals scam."],
  ["Use a family safe-word", "Agree on a private code word. A clone won't know it."],
];
const FEATURES = ["Waveform playback analysis", "MP3 / WAV / OGG scanning", "AI-probability trust score", "Forensic metric breakdown", "Real-time deepfake alerts", "Dual editorial themes"];
const PHASES = ["EXTRACTING SPECTRAL FEATURES", "ANALYSING PROSODY + BREATHING", "MATCHING SYNTHESIS FINGERPRINTS", "COMPUTING TRUST SCORE"];
const FALLBACK_LABELS = ["Spectral consistency", "Prosody naturalness", "Breathing patterns", "Synthesis artifacts", "Formant stability"];
const REC_LIMIT = 15;

function simulateAnalysis() {
  const ai = Math.floor(Math.random() * 100);
  const metrics = FALLBACK_LABELS.map((label) => [label, Math.max(4, Math.min(97, Math.round(ai + (Math.random() * 30 - 15))))]);
  return { ai, real: 100 - ai, metrics, simulated: true };
}

/* ══════════════════ MAIN APP ══════════════════ */
export default function App() {
  const [themeMode, setThemeMode] = useState(() => readJSON(LS.theme, "dark")); // 'dark' | 'light' | 'system' — feature #7 (system theme)
  const [systemDark, setSystemDark] = useState(() => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)").matches : true));
  const dark = themeMode === "system" ? systemDark : themeMode === "dark";
  const [page, setPage] = useState("home");
  const [drawer, setDrawer] = useState(false);
  const [terms, setTerms] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recSec, setRecSec] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [phase, setPhase] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");
  const [refId, setRefId] = useState("");
  const [result, setResult] = useState({ ai: 0, real: 0, metrics: [] });
  const [toast, setToast] = useState(null);
  const fileInput = useRef(null);
  const recTimer = useRef(null);
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);
  const [micStream, setMicStream] = useState(null);

  /* account / billing / usage / history — see storage helpers above */
  const [user, setUser] = useState(() => readJSON(LS.user, null));
  const [usage, setUsage] = useState(loadUsage);
  const [history, setHistory] = useState(() => readJSON(LS.history, []));
  const plan = PLANS[user?.plan || "free"];

  /* feature modals & panels */
  const { status: backendStatus, lastChecked: backendLastChecked, retry: retryBackend } = useBackendStatus();
  const [showStatus, setShowStatus] = useState(false);
  const [checkout, setCheckout] = useState(null); // { tier, cycle }
  const [showAuth, setShowAuth] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [upgradeTarget, setUpgradeTarget] = useState(null); // plan id being confirmed
  const [queue, setQueue] = useState([]); // batch upload queue — feature #1

  const notify = useCallback((msg, type = "info") => setToast({ msg, type }), []);

  /* persist theme / account / usage / history */
  useEffect(() => { writeJSON(LS.theme, themeMode); }, [themeMode]);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener ? mq.addEventListener("change", onChange) : mq.addListener(onChange);
    return () => (mq.removeEventListener ? mq.removeEventListener("change", onChange) : mq.removeListener(onChange));
  }, []);
  useEffect(() => { writeJSON(LS.user, user); }, [user]);
  useEffect(() => { writeJSON(LS.usage, usage); }, [usage]);
  useEffect(() => { writeJSON(LS.history, history); }, [history]);

  const cycleTheme = () => {
    setThemeMode((m) => (m === "dark" ? "light" : m === "light" ? "system" : "dark"));
    blip(dark ? 840 : 340);
  };

  const handleAuthed = useCallback((u) => {
    setUser(u);
    setShowAuth(false);
    notify(`Signed in as ${u.name}.`, "info");
  }, [notify]);

  const handleLogout = () => { setUser(null); notify("Signed out.", "info"); };

  const requestUpgrade = (planId) => setUpgradeTarget(planId);
  const confirmUpgrade = () => {
    const target = upgradeTarget;
    setUser((u) => (u ? { ...u, plan: target } : u));
    if (user) {
      const accounts = readJSON(LS.accounts, {});
      if (accounts[user.email]) { accounts[user.email].plan = target; writeJSON(LS.accounts, accounts); }
    }
    setUpgradeTarget(null);
    setPage("pricing");
    notify(`Plan switched to ${PLANS[target].name} (demo — no card charged).`, "info");
    if (!user) notify("Sign in to keep this plan across sessions.", "warn");
  };

  const openCheckout = (tier, cycle) => setCheckout({ tier, cycle });
  const handleCheckoutSuccess = () => {
    const target = checkout.tier.id;
    setUser((u) => (u ? { ...u, plan: target } : u));
    if (user) {
      const accounts = readJSON(LS.accounts, {});
      if (accounts[user.email]) { accounts[user.email].plan = target; writeJSON(LS.accounts, accounts); }
    }
    if (!user) notify("Sign in to keep this plan across sessions.", "warn");
  };

  const scrollToSection = (sectionId) => {
    setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };
  const navWithAnchor = (pageId, sectionId) => {
    if (sectionId && page === pageId) { scrollToSection(sectionId); return; }
    setPage(pageId);
    setDrawer(false);
    if (sectionId) scrollToSection(sectionId);
  };

  const clearHistory = () => { setHistory([]); notify("Scan history cleared.", "info"); };
  const exportHistory = () => {
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `voiceshield-history-${monthKey()}.json`; a.click();
    URL.revokeObjectURL(url);
    notify("History exported as JSON.", "info");
  };

  useReveals(page);
  useEffect(() => { primeVoices(); }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [page]);
  useEffect(() => () => window.speechSynthesis.cancel(), []);
  useScrollLock(drawer || terms || analyzing || showAuth || showSettings || showShortcuts || !!upgradeTarget || !!checkout || showStatus);
  useEscapeClose(useMemo(() => [
    [showStatus, () => setShowStatus(false)],
    [!!checkout, () => setCheckout(null)],
    [showShortcuts, () => setShowShortcuts(false)],
    [showSettings, () => setShowSettings(false)],
    [!!upgradeTarget, () => setUpgradeTarget(null)],
    [showAuth, () => setShowAuth(false)],
    [terms, () => setTerms(false)],
    [drawer, () => setDrawer(false)],
  ], [terms, drawer, showAuth, showSettings, showShortcuts, upgradeTarget, checkout, showStatus]));

  /* global keyboard shortcuts — feature #6 */
  useEffect(() => {
    let lastKeyG = 0;
    const onKey = (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || e.metaKey || e.ctrlKey || e.altKey) return;
      const anyModalOpen = drawer || terms || analyzing || showAuth || showSettings || showShortcuts || !!upgradeTarget || !!checkout || showStatus;
      if (e.key === "?") { e.preventDefault(); setShowShortcuts(true); return; }
      if (anyModalOpen) return;
      if (e.key.toLowerCase() === "u" && page === "home") { e.preventDefault(); fileInput.current?.click(); }
      else if (e.key.toLowerCase() === "r" && page === "home") { e.preventDefault(); toggleRecord(); }
      else if (e.key.toLowerCase() === "h") { e.preventDefault(); setPage("history"); }
      else if (e.key.toLowerCase() === "g") { lastKeyG = Date.now(); }
      else if (e.key.toLowerCase() === "p" && Date.now() - lastKeyG < 900) { e.preventDefault(); setPage("pricing"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page, drawer, terms, analyzing, showAuth, showSettings, showShortcuts, upgradeTarget, checkout, showStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!analyzing) { setPhase(0); return; }
    const iv = setInterval(() => setPhase((p) => Math.min(p + 1, PHASES.length - 1)), 700);
    return () => clearInterval(iv);
  }, [analyzing]);

  useEffect(() => {
    if (!recording) { setRecSec(0); return; }
    const iv = setInterval(() => setRecSec((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, [recording]);

  const logScan = useCallback((r, name) => {
    const id = genRefId();
    const v = r.ai >= 80 ? "danger" : r.ai >= 50 ? "warn" : "safe";
    setHistory((h) => [{ refId: id, fileName: name, ts: Date.now(), ai: r.ai, real: r.real, verdict: v }, ...h].slice(0, 500));
    setUsage((u) => ({ ...u, count: u.count + 1 }));
    return id;
  }, []);

  /* --- BACKEND API CONNECTION (with graceful offline fallback) --- */
  const runAnalysis = useCallback(async (fileObj, name, { navigate = true } = {}) => {
    // feature #2 / #14 — enforce the monthly quota for the active plan before spending a scan
    const currentPlan = PLANS[user?.plan || "free"];
    const currentUsage = readJSON(LS.usage, loadUsage());
    const freshUsage = currentUsage.monthKey === monthKey() ? currentUsage : { monthKey: monthKey(), count: 0 };
    if (freshUsage.count >= currentPlan.limit) {
      notify(`You've used all ${currentPlan.limit} scans on the ${currentPlan.name} plan this month. Upgrade to keep scanning.`, "warn");
      setPage("pricing");
      return "blocked";
    }

    window.speechSynthesis.cancel();
    setFileName(name); setAnalyzing(true); blip(520);

    try {
      const formData = new FormData();
      formData.append("audio", fileObj);

      // Backend endpoint — set VITE_API_URL in Vercel / .env for production
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/analyze";
      
      const response = await fetch(API_URL, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const backendResult = await response.json();
      
      // FIX 2: Safely parse metrics regardless of backend dictionary/array format
      const rawMetrics = backendResult.metrics;
      const formattedMetrics = Array.isArray(rawMetrics) 
        ? rawMetrics 
        : Object.entries(rawMetrics || {});

      setResult({
        ...backendResult,
        metrics: formattedMetrics
      });
      setRefId(logScan(backendResult, name));

      setAnalyzing(false);
      if (navigate) setPage("results");
      blip(backendResult.ai >= 80 ? 200 : 760, 0.2);
      return "ok";
    } catch (error) {
      console.error("Backend fetch failed, using simulated analysis:", error);
      const simulated = simulateAnalysis();
      setResult(simulated);
      setRefId(logScan(simulated, name));
      setAnalyzing(false);
      if (navigate) setPage("results");
      notify("Backend unreachable — showing a simulated result (demo mode).", "warn");
      blip(simulated.ai >= 80 ? 200 : 760, 0.2);
      return "ok";
    }
  }, [notify, user, logScan]);

  /* feature #1 — batch upload: single file behaves exactly as before,
     multiple files are queued and analysed one after another */
  const handleFiles = async (fileList) => {
    const all = Array.from(fileList || []).filter(Boolean);
    if (!all.length) return;
    const valid = all.filter((f) => /\.(mp3|wav|ogg|m4a|webm)$/i.test(f.name));
    if (all.length !== valid.length) notify(`${all.length - valid.length} file(s) skipped — please upload MP3, WAV, OGG, or M4A.`, "warn");
    if (!valid.length) return;

    if (valid.length === 1) { runAnalysis(valid[0], valid[0].name); return; }

    setQueue(valid.map((f) => ({ name: f.name, status: "pending" })));
    for (let i = 0; i < valid.length; i++) {
      setQueue((q) => q.map((item, idx) => (idx === i ? { ...item, status: "analyzing" } : item)));
      const outcome = await runAnalysis(valid[i], valid[i].name, { navigate: i === valid.length - 1 });
      setQueue((q) => q.map((item, idx) => (idx === i ? { ...item, status: outcome === "blocked" ? "blocked" : "done" } : item)));
      if (outcome === "blocked") break;
    }
    setTimeout(() => setQueue([]), 4000);
  };

  const handleFile = (f) => handleFiles(f ? [f] : []);

  const toggleRecord = async () => {
    if (analyzing) return;
    if (!recording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setMicStream(stream);

        // FIX 3: Accurately determine correct MIME type based on browser
        const mimeType = MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "audio/ogg";

        mediaRecorder.current = new MediaRecorder(stream, { mimeType });
        audioChunks.current = [];

        mediaRecorder.current.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunks.current.push(e.data);
        };

        mediaRecorder.current.onstop = () => {
          // Label extension based on supported codec
          const ext = mimeType.includes("webm") ? "webm" : mimeType.includes("mp4") ? "m4a" : "ogg";
          const audioBlob = new Blob(audioChunks.current, { type: mimeType });
          const fileObj = new File([audioBlob], `Live_Recording.${ext}`, { type: mimeType });
          
          runAnalysis(fileObj, `Live Recording.${ext}`);
          stream.getTracks().forEach((track) => track.stop());
          setMicStream(null);
        };

        mediaRecorder.current.start();
        setRecording(true);
        blip(680);

        recTimer.current = setTimeout(() => {
          if (mediaRecorder.current?.state === "recording") {
            mediaRecorder.current.stop();
            setRecording(false);
          }
        }, REC_LIMIT * 1000);
      } catch (err) {
        notify("Microphone access denied or unavailable.", "danger");
      }
    } else {
      if (mediaRecorder.current?.state === "recording") mediaRecorder.current.stop();
      clearTimeout(recTimer.current);
      setRecording(false);
    }
  };

  const goTo = (id) => {
    if (id === "settings") { setShowSettings(true); setDrawer(false); return; }
    if (id === "account") { if (user) setShowSettings(true); else setShowAuth(true); setDrawer(false); return; }
    setPage(id); setDrawer(false);
  };

  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const blurred = drawer || terms || analyzing;
  const verdict = result.ai >= 80 ? "danger" : result.ai >= 50 ? "warn" : "safe";

  return (
    <div className={`vs ${dark ? "dark" : "light"} ${page === "results" ? `v-${verdict}` : ""}`}>
      <style>{css}</style>
      <a className="skip-link" href="#main-content">Skip to content</a>

      {/* OPTIMIZED GPU BACKGROUND */}
      <div className="bg-fluid" aria-hidden="true" />

      <div className={`layer ${blurred ? "dim" : ""}`}>
        <header className="topbar">
          <button className="hbtn" aria-label="Open menu" onClick={() => { setDrawer(true); blip(560); }}>
            <span /><span /><span />
          </button>
          <span className="brand mono">VOICESHIELD</span>
          <div className="top-right">
            {page !== "home" && (
              <button className="hbtn back mono" onClick={() => { setPage("home"); setFileName(""); blip(480); }}>← BACK</button>
            )}
            <button className={`hbtn theme ${dark ? "" : "lit"}`} aria-label={`Theme: ${themeMode}. Click to cycle.`} aria-pressed={!dark}
              onClick={cycleTheme} title={`Theme: ${themeMode}`}>
              <i />
            </button>
            <StatusPill status={backendStatus} onClick={() => setShowStatus(true)} />
            <LanguageSelector />
            <NotificationBell />
            <AccountMenu user={user} plan={plan} onOpenAuth={() => setShowAuth(true)} onLogout={handleLogout} onNav={goTo} />
          </div>
        </header>

        {/* ═══════ HOME ═══════ */}
        {page === "home" && (
          <main className="page" id="main-content">
            <section className="hero">
              <div className="hero-copy">
                <p className="mono kicker" data-reveal>AUDIO FORENSICS · REAL-TIME · v3.0</p>
                <h1 className="display" data-reveal>
                  <span className="l1">VOICE</span>
                  <span className="l2"><em>Shield</em></span>
                </h1>
                <p className="lede" data-reveal>
                  We check any voice for <Glitch>AI</Glitch> cloning and <Glitch>deepfake</Glitch> scam
                  patterns — before you trust the person on the other end of the call.
                </p>
                <div className="hero-meta mono" data-reveal>
                  <span>LATENCY <b>~3.0s</b></span><span>MODELS <b>04</b></span><span>ACCURACY <b>SIM</b></span>
                </div>
              </div>

              <div className="float-wrap a hero-obj-wrap">
                <div className="hero-obj">
                  <div className="liquid-orb"></div>
                  <div className="liquid-orb-core"></div>
                  <span className="orbit-tag mono">SIGNAL / LOCKED</span>
                </div>
              </div>
            </section>

            {/* 01 — sample */}
            <section className="sect" data-reveal>
              <div className="sect-head">
                <span className="mono idx">01</span>
                <h2 className="sect-t">Listen to a <em>sample</em></h2>
                <span className="rule" />
              </div>
              <VoicePlayer />
            </section>

            {/* 02 — console */}
            <section className="sect" data-reveal>
              <div className="sect-head">
                <span className="mono idx">02</span>
                <h2 className="sect-t">Run a <em>scan</em></h2>
                <span className="rule" />
              </div>
              <div className="liquid-glass console">
                <div className="con-head">
                  <p className="mono lab">SUBMIT A VOICE SAMPLE</p>
                  <span className="fmt mono"><i>MP3</i><i>WAV</i><i>OGG</i></span>
                </div>
                <div className="tiles">
                  <div
                    className={`tile ${dragOver ? "over" : ""} ${analyzing ? "off" : ""}`}
                    role="button"
                    tabIndex={analyzing ? -1 : 0}
                    aria-label="Upload one or more audio files"
                    onClick={() => !analyzing && fileInput.current.click()}
                    onKeyDown={(e) => { if (!analyzing && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); fileInput.current.click(); } }}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
                  >
                    <span className="tile-no mono">A</span>
                    <div className="tile-ico">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M12 16V4m0 0L7 9m5-5l5 5"/><path d="M4 20h16"/></svg>
                    </div>
                    <p className="tile-t">Upload file(s)</p>
                    <p className="tile-s">drag & drop or browse · batch supported</p>
                    <span className="tile-tag mono">.mp3 .wav .ogg</span>
                  </div>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="audio/*"
                    multiple
                    hidden
                    onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
                  />

                  <button
                    type="button"
                    className={`tile ${recording ? "recing" : ""} ${analyzing ? "off" : ""}`}
                    disabled={analyzing}
                    aria-label={recording ? "Stop recording and analyse" : "Start a live recording"}
                    onClick={toggleRecord}
                  >
                    <span className="tile-no mono">B</span>
                    <div className={`tile-ico ${recording ? "rec" : ""}`}>
                      {recording && <><i className="rip" /><i className="rip r2" /></>}
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 15a4 4 0 0 0 4-4V6a4 4 0 1 0-8 0v5a4 4 0 0 0 4 4z"/><path d="M19 11a7 7 0 0 1-14 0H3a9 9 0 0 0 8 8.94V23h2v-3.06A9 9 0 0 0 21 11h-2z"/></svg>
                    </div>
                    <p className="tile-t">{recording ? "Recording" : "Record live"}</p>
                    <p className="tile-s">{recording ? "tap to stop & analyse" : "use your microphone"}</p>
                    <span className={`tile-tag mono ${recording ? "hot" : ""}`}>{recording ? `● ${fmt(recSec)} / 0:15` : "UP TO 0:15"}</span>
                    <MicLevelMeter stream={micStream} active={recording} />
                  </button>
                </div>

                {queue.length > 0 && (
                  <div className="batch-queue mono" data-reveal>
                    <p className="lab">BATCH QUEUE · {queue.filter((q) => q.status === "done").length}/{queue.length} DONE</p>
                    {queue.map((q, i) => (
                      <div key={i} className={`bq-row bq-${q.status}`}>
                        <span className="bq-dot" /><span className="bq-name">{q.name}</span><span className="bq-status">{q.status.toUpperCase()}</span>
                      </div>
                    ))}
                  </div>
                )}

                <QuotaBanner used={usage.count} limit={plan.limit} planName={plan.name} onUpgrade={() => setPage("pricing")} />
              </div>
            </section>

            {history.length > 0 && (
              <section className="sect" data-reveal>
                <div className="sect-head">
                  <span className="mono idx">◈</span>
                  <h2 className="sect-t">Recent <em>activity</em></h2>
                  <span className="rule" />
                </div>
                <div className="liquid-glass activity-panel">
                  <div className="activity-top">
                    <div>
                      <p className="mono lab">LAST {Math.min(10, history.length)} SCANS · AI-PROBABILITY TREND</p>
                      <p className="vline">{usage.count} / {plan.limit === Infinity ? "∞" : plan.limit} scans used this month on the {plan.name} plan.</p>
                    </div>
                    <button className="tlink mono sm-btn" onClick={() => setPage("history")}>VIEW ALL →</button>
                  </div>
                  <Sparkline points={history.slice(0, 10).map((h) => h.ai).reverse()} />
                </div>
              </section>
            )}

            {/* 03 — tips */}
            <section className="sect" data-reveal>
              <div className="sect-head">
                <span className="mono idx">03</span>
                <h2 className="sect-t">Protect <em>yourself</em></h2>
                <span className="rule" />
              </div>
              <TipsPanel />
            </section>

            <PressStrip />
            <StatsStrip />
            <TrustBadges />
            <TestimonialsCarousel />
            <ComparisonTable />
            <div id="faq"><FAQAccordion /></div>
            <IntegrationsStrip />
            <div id="api"><DeveloperAPISection onGetKey={() => (user ? notify("A sandbox API key has been generated for your account.", "info") : setShowAuth(true))} /></div>
            <div id="cases"><CaseStudiesGrid /></div>
            <div id="roadmap"><RoadmapTimeline /></div>
            <LiveActivityFeed />
            {user && <ReferralSection user={user} />}
            <DownloadTeasers />
            <div id="team"><TeamSection /></div>
            <div id="enterprise"><EnterpriseContactForm notify={notify} /></div>
            <div id="security" className="sect" data-reveal>
              <div className="sect-head">
                <span className="mono idx">17</span>
                <h2 className="sect-t">Security & <em>privacy</em></h2>
                <span className="rule" />
              </div>
              <div className="liquid-glass enterprise-card">
                <p className="vline">Audio is streamed to the analysis API over HTTPS, scored, and deleted from disk immediately after the response is sent. Only the numeric verdict and a reference ID are kept, and only in your browser's local storage on this device — never on a server, in this demo build.</p>
              </div>
            </div>
            <NewsletterSignup notify={notify} />

            <SiteFooter onNav={navWithAnchor} onTerms={() => setTerms(true)} />
          </main>
        )}

        {/* ═══════ RESULTS ═══════ */}
        {page === "results" && (
          <ResultsPage
            result={result}
            fileName={fileName}
            refId={refId}
            onScanAnother={() => { setPage("home"); setFileName(""); blip(620); }}
            notify={notify}
          />
        )}

        {/* ═══════ PRICING ═══════ */}
        {page === "pricing" && <PricingPage plan={plan} onChoose={requestUpgrade} onCheckout={openCheckout} user={user} />}

        {/* ═══════ HISTORY ═══════ */}
        {page === "history" && <HistoryPage history={history} onClear={clearHistory} onExport={exportHistory} />}
      </div>

      {/* mobile bottom tab bar — feature #9 */}
      <MobileTabBar page={page} onNav={goTo} hasUser={!!user} />

      {/* analysis takeover */}
      {analyzing && (
        <div className="takeover">
          <div className="tk-inner liquid-glass">
            <div className="hero-obj" style={{ width: 160, height: 160, margin: "0 auto" }}>
              <div className="liquid-orb"></div>
              <div className="liquid-orb-core"></div>
            </div>
            <p className="tk-phase mono">{PHASES[phase]}<i className="d">.</i><i className="d">.</i><i className="d">.</i></p>
            <div className="tk-bar"><i /></div>
            <p className="tk-file mono">{fileName}</p>
          </div>
        </div>
      )}

      {/* drawer */}
      <div className={`veil ${drawer ? "on" : ""}`} onClick={() => setDrawer(false)} />
      <aside className={`drawer liquid-glass ${drawer ? "on" : ""}`} aria-hidden={!drawer}>
        <div className="dh">
          <span className="dlogo">VOICE<em>Shield</em></span>
          <button className="hbtn x" aria-label="Close menu" onClick={() => setDrawer(false)}>✕</button>
        </div>
        <p className="mono dlab">NAVIGATE</p>
        <nav className="dnav">
          <button onClick={() => goTo("home")}>Scan audio</button>
          <button onClick={() => goTo("history")}>Scan history</button>
          <button onClick={() => goTo("pricing")}>Pricing</button>
          <button onClick={() => goTo("settings")}>Settings & privacy</button>
          <button onClick={() => { setShowShortcuts(true); setDrawer(false); }}>Keyboard shortcuts</button>
        </nav>
        <p className="mono dlab">FEATURES</p>
        <ul className="dlist">{FEATURES.map((f, i) => <li key={f}><span className="mono">{String(i + 1).padStart(2, "0")}</span>{f}</li>)}</ul>
        <p className="mono dlab">CONTACT</p>
        <a className="dcontact" href="#" target="_blank" rel="noreferrer"><LinkedInIcon /> /hackathon-team</a>
        <button className="dterms mono" onClick={() => { setTerms(true); setDrawer(false); }}>TERMS & CONDITIONS →</button>
      </aside>

      {/* terms */}
      {terms && (
        <div className="veil on center" onClick={() => setTerms(false)}>
          <div className="modal liquid-glass" role="dialog" aria-modal="true" aria-label="Terms and conditions" onClick={(e) => e.stopPropagation()}>
            <p className="mono lab">LEGAL / 01</p>
            <h3>Terms & Conditions</h3>
            <ol>
              <li><b>Demo only.</b> Scores are simulated, not forensic evidence.</li>
              <li><b>Privacy.</b> Audio never leaves your device in this demo.</li>
              <li><b>No liability.</b> Never use results as the sole basis for financial or legal decisions.</li>
              <li><b>Fair use.</b> Do not use this tool to impersonate or defraud.</li>
            </ol>
            <button className="cta sm" onClick={() => setTerms(false)}>GOT IT</button>
          </div>
        </div>
      )}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onAuthed={handleAuthed} notify={notify} />}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          usage={usage.count}
          limit={plan.limit}
          planName={plan.name}
          onClearHistory={clearHistory}
          onExportHistory={exportHistory}
          onShowShortcuts={() => { setShowSettings(false); setShowShortcuts(true); }}
        />
      )}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      {upgradeTarget && <UpgradeConfirmModal target={upgradeTarget} onClose={() => setUpgradeTarget(null)} onConfirm={confirmUpgrade} />}
      {checkout && (
        <CheckoutModal
          tier={checkout.tier}
          cycle={checkout.cycle}
          notify={notify}
          onClose={() => setCheckout(null)}
          onSuccess={handleCheckoutSuccess}
        />
      )}
      {showStatus && (
        <StatusModal status={backendStatus} lastChecked={backendLastChecked} onClose={() => setShowStatus(false)} onRetry={retryBackend} />
      )}
      <CookieBanner />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

function TipsPanel() {
  const [openTip, setOpenTip] = useState(-1);
  return (
    <div className="liquid-glass tips">
      {TIPS.map(([q, a], i) => (
        <div key={i} className={`tip ${openTip === i ? "open" : ""}`}>
          <button className="tq" aria-expanded={openTip === i} onClick={() => { setOpenTip(openTip === i ? -1 : i); blip(500, 0.05); }}>
            <span className="mono tno">{String(i + 1).padStart(2, "0")}</span>
            <span className="tqt">{q}</span>
            <span className="tplus">+</span>
          </button>
          <div className="ta"><p>{a}</p></div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════ COMPLETE CSS ═══════════════════════ */
const css = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&family=Inter:wght@400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
html{scroll-behavior:smooth; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;}
html,body{overflow-x:hidden;width:100%}
.mono{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:1.5px; text-transform:uppercase;}

.vs{min-height:100vh;max-width:100vw;font-family:'Inter',system-ui,sans-serif;position:relative;overflow-x:hidden;transition:background .8s ease,color .8s ease}
.vs.dark{--bg:#07070c;--bg2:#171622;--tx:#fdfcfb;--sub:#9696a0;--line:rgba(255,255,255,.1);--hair:rgba(255,255,255,.05);--volt:#cbf321;--ink:#0b0b0c;--accent2:#7c5cff;--accent3:#31d0c6;--danger:#ff5a4d;--warn:#ffb545;color:var(--tx);background:var(--bg)}
.vs.light{--bg:#f5f5f8;--bg2:#e6e5f0;--tx:#09090b;--sub:#6b6b78;--line:rgba(0,0,0,.1);--hair:rgba(0,0,0,.05);--volt:#111;--ink:#cbf321;--accent2:#5b3df0;--accent3:#0f9d90;--danger:#d8342a;--warn:#c47a00;color:var(--tx);background:var(--bg)}
.vs.v-danger.dark{--bg:#1f0b0d; --bg2:#330a10;}
.vs.v-warn.dark{--bg:#1a1105; --bg2:#2d1b03;}
.vs.v-safe.dark{--bg:#0c130b; --bg2:#11200f;}

/* background — layered aurora mesh, static gradients only (no live filters, cheap to render) */
.bg-fluid {
  position: fixed; inset: -50%; z-index: 0;
  background:
    radial-gradient(circle at 18% 12%, color-mix(in srgb, var(--accent2) 22%, transparent) 0%, transparent 42%),
    radial-gradient(circle at 84% 8%, color-mix(in srgb, var(--accent3) 16%, transparent) 0%, transparent 38%),
    radial-gradient(circle at 76% 82%, color-mix(in srgb, var(--volt) 14%, transparent) 0%, transparent 40%),
    radial-gradient(circle at 50% 50%, var(--bg2) 0%, var(--bg) 62%);
  pointer-events: none; transform: translateZ(0);
}

.layer{position:relative;z-index:1;transition:filter .6s cubic-bezier(.3,.7,.2,1),transform .6s cubic-bezier(.3,.7,.2,1)}
.layer.dim{filter:blur(8px) brightness(.6);transform:scale(.98);pointer-events:none}

[data-reveal]{opacity:0;transform:translateY(25px);transition:opacity .9s cubic-bezier(.22, 1, .36, 1),transform .9s cubic-bezier(.22, 1, .36, 1)}
[data-reveal].in{opacity:1;transform:none}

/* ══════════════════════════════════════════════════════════════
   LIQUID GLASS — realistic refraction via layered gradients + a
   baked (static, non-animated) noise texture instead of a live
   SVG feTurbulence filter. A live displacement filter recomputed
   every frame on a moving, blurred element was the main source of
   jank in the previous build — this reproduces the same "imperfect
   glass" read at a fraction of the render cost.
   ══════════════════════════════════════════════════════════════ */
.liquid-glass {
  position: relative;
  isolation: isolate;
  contain: layout style paint;
  background: linear-gradient(145deg, rgba(255,255,255,.07) 0%, rgba(255,255,255,.015) 55%, rgba(255,255,255,.05) 100%);
  backdrop-filter: blur(16px) saturate(150%);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
  border: 1px solid rgba(255,255,255,.14);
  border-top-color: rgba(255,255,255,.34);
  border-bottom-color: rgba(0,0,0,.4);
  border-radius: 32px;
  box-shadow:
    0 24px 56px -16px rgba(0,0,0,.55),
    inset 0 1px 0 rgba(255,255,255,.35),
    inset 0 -14px 22px -10px rgba(0,0,0,.55),
    inset 12px 0 22px -20px rgba(255,255,255,.14),
    inset -12px 0 22px -20px rgba(0,0,0,.25);
  overflow: hidden;
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .liquid-glass{ background: rgba(20,20,24,.86); }
  .light .liquid-glass{ background: rgba(255,255,255,.9); }
}
.light .liquid-glass {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.62) 0%, rgba(255, 255, 255, 0.32) 100%);
  border: 1px solid rgba(255, 255, 255, 0.8); border-bottom: 1px solid rgba(0, 0, 0, 0.05); border-right: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 16px 40px -8px rgba(0, 0, 0, 0.1), inset 0 4px 8px -2px rgba(255, 255, 255, 1), inset 0 -4px 12px -2px rgba(0, 0, 0, 0.03);
}
/* baked grain — a single rasterized bitmap, not a live filter */
.liquid-glass::before {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 160px 160px;
  opacity: .05;
  mix-blend-mode: overlay;
}
/* moving specular shine — transform-only, cheap to composite */
.liquid-glass::after {
  content: ""; position: absolute; inset: -150%; pointer-events: none;
  background: linear-gradient(45deg, transparent 40%, rgba(255, 255, 255, 0.1) 45%, rgba(255, 255, 255, 0.2) 50%, transparent 55%);
  transform: rotate(30deg); animation: fluid-shine 9s cubic-bezier(0.4, 0, 0.2, 1) infinite; will-change: transform;
}
@keyframes fluid-shine {
  0% { transform: translateY(-50%) translateX(-50%) rotate(30deg); }
  100% { transform: translateY(50%) translateX(50%) rotate(30deg); }
}

/* 🧊 3D FLOATING WRAPPERS — kept separate from .liquid-glass so the
   blurred/translucent panel itself never has a live filter animating
   on it; only a plain transform moves the wrapper around it. */
.float-wrap{ transform-style: preserve-3d; will-change: transform; }
.float-wrap.a{ animation: float-obj 12s ease-in-out infinite alternate; }
.float-wrap.b{ animation: float-obj-alt 14s ease-in-out infinite alternate-reverse; }
@keyframes float-obj {
  0% { transform: perspective(1200px) translateY(0px) rotateX(2deg) rotateY(-2deg); }
  100% { transform: perspective(1200px) translateY(-14px) rotateX(-2deg) rotateY(4deg); }
}
@keyframes float-obj-alt {
  0% { transform: perspective(1200px) translateY(0px) rotateX(-2deg) rotateY(2deg); }
  100% { transform: perspective(1200px) translateY(-18px) rotateX(3deg) rotateY(-3deg); }
}

/* 3D Liquid Orb — same fix: gradients + one static blur, no live filter */
.hero-obj-wrap{ width: min(340px,40vw); aspect-ratio: 1; }
.hero-obj { position: relative; width: 100%; height: 100%; aspect-ratio: 1; display: flex; justify-content: center; align-items: center; }
.liquid-orb {
  position: absolute; width: 100%; height: 100%; border-radius: 50%;
  background:
    radial-gradient(circle at 30% 28%, rgba(255,255,255,.22), transparent 42%),
    radial-gradient(circle at 68% 74%, rgba(203,243,33,.08), transparent 55%),
    radial-gradient(circle at 30% 30%, rgba(255,255,255,0.1), rgba(0,0,0,0.85));
  box-shadow: inset 0 0 40px rgba(203, 243, 33, 0.2), inset -20px -20px 40px rgba(0,0,0,0.9), 0 20px 40px rgba(0,0,0,0.5);
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
}
.liquid-orb-core {
  width: 40%; height: 40%; border-radius: 50%; background: var(--volt);
  box-shadow: 0 0 60px var(--volt), 0 0 100px var(--volt); animation: pulse-core 4s ease-in-out infinite alternate; will-change: transform, opacity;
}
@keyframes pulse-core {
  0% { transform: scale(0.9); opacity: 0.7; }
  100% { transform: scale(1.1); opacity: 1; }
}
.orbit-tag{position:absolute;bottom:-20px;left:50%;transform:translateX(-50%);color:var(--sub);white-space:nowrap}

/* topbar */
.topbar{position:sticky;top:0;z-index:30;display:flex;align-items:center;justify-content:space-between;padding:20px 24px;gap:12px;border-bottom:1px solid var(--hair);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);background:color-mix(in srgb,var(--bg) 60%,transparent)}
.brand{color:var(--tx); font-weight: 600; letter-spacing: 2px;}
.top-right{display:flex;gap:10px;align-items:center}
.hbtn{background:none;border:1px solid var(--line);border-radius:14px;width:46px;height:46px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;cursor:pointer;color:var(--tx);transition:all .3s cubic-bezier(.25,.8,.25,1)}
.hbtn:hover{background:var(--tx);color:var(--bg);box-shadow: 0 4px 12px rgba(0,0,0,0.15);}
.hbtn:focus-visible{outline:2px solid var(--volt);outline-offset:2px}
.hbtn:active{transform:scale(.94)}
.hbtn span{width:18px;height:1.5px;background:var(--tx);border-radius:2px;transition:background .3s}
.hbtn:hover span{background:var(--bg)}
.hbtn.back{width:auto;padding:0 20px;flex-direction:row}
.hbtn.theme i{width:18px;height:18px;border-radius:50%;background:var(--tx);position:relative;transition:.45s cubic-bezier(.3,1.3,.4,1)}
.hbtn.theme i::after{content:"";position:absolute;inset:0;border-radius:50%;background:var(--bg);transform:translateX(35%) scale(.85);transition:.45s cubic-bezier(.3,1.3,.4,1)}
.hbtn.theme.lit i::after{transform:translateX(120%) scale(0)}
.hbtn.theme:hover i{background:var(--bg)}
.hbtn.theme:hover i::after{background:var(--tx)}

/* layout */
.page{max-width:1040px;margin:0 auto;padding:0 24px 100px;display:flex;flex-direction:column;gap:100px}
.hero{position:relative;min-height:75dvh;display:flex;justify-content:space-between;align-items:center;padding-top:40px; gap: 40px;}
.hero-copy{max-width:680px}
.kicker{color:var(--volt); font-weight: 500;}
.light .kicker{color: #5c8517;}
.display{font-family:'Space Grotesk';font-weight:700;line-height:0.9;letter-spacing:-.05em;margin:24px 0; color: var(--tx);}
.display .l1{display:block;font-size:clamp(64px,12vw,140px)}
.display .l2{display:flex;align-items:baseline;gap:16px;font-size:clamp(58px,11vw,120px)}
.display .l2 em{font-family:'Instrument Serif',serif;font-style:italic;font-weight:400;letter-spacing:-.01em; color: var(--tx);}
.lede{color:var(--sub);font-size:clamp(16px,2vw,20px);line-height:1.7;max-width:520px; font-weight: 400;}
.hero-meta{display:flex;gap:32px;margin-top:40px;color:var(--sub);flex-wrap:wrap}
.hero-meta b{color:var(--tx);margin-left:8px; font-weight: 500;}
.glitch{position:relative;display:inline-block;font-weight:600;color:var(--tx)}
.sect{ content-visibility:auto; contain-intrinsic-size: 0 480px; }
.sect-head{display:flex;align-items:baseline;gap:24px;margin-bottom:32px}
.idx{color:var(--sub); font-size: 14px;}
.sect-t{font-family:'Space Grotesk';font-weight:700;font-size:clamp(28px,4vw,40px);letter-spacing:-.04em; color: var(--tx);}
.sect-t em{font-family:'Instrument Serif',serif;font-style:italic;font-weight:400}
.rule{flex:1;height:1px;background:var(--hair);align-self:center}
.lab{color:var(--sub)}

/* voice note */
.vn-panel{padding:32px 40px}
.vn-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px}
.vn-name{font-family:'Space Grotesk';font-weight:700;font-size:22px;margin-top:8px; color: var(--tx);}
.chip{padding:8px 16px;border:1px solid var(--line);border-radius:30px;color:var(--sub);transition:all .3s; position: relative; z-index: 10;}
.chip.on{color:var(--bg);background:var(--volt);border-color:var(--volt); font-weight: 500;}
.light .chip.on{color:#fff;}
.vn-bars{display:flex;align-items:center;gap:3px;height:80px;padding:8px 0; position: relative; z-index: 10;}
.vnb{flex:1;min-width:3px;border-radius:3px;background:var(--sub);opacity:.2;transition:background .2s,opacity .2s;transform-origin:center}
.vnb.done{background:var(--volt);opacity:1}
.vnb.head{animation:vnb .4s ease-in-out infinite alternate}
@keyframes vnb{from{transform:scaleY(.7)}to{transform:scaleY(1.4)}}
.vn-foot{display:flex;align-items:center;gap:20px;margin-top:24px; position: relative; z-index: 10;}
.play{width:56px;height:56px;flex:none;border-radius:50%;border:none;background:var(--tx);color:var(--bg);display:grid;place-items:center;cursor:pointer;transition:all .3s cubic-bezier(.34, 1.56, .64, 1); box-shadow: 0 8px 24px rgba(0,0,0,0.15);}
.play:hover{transform:scale(1.1);background:var(--volt);color:var(--ink)}
.play:focus-visible{outline:2px solid var(--volt);outline-offset:3px}
.play:active{transform:scale(.9)}
.seek{flex:1;height:4px;background:var(--line);border-radius:2px;overflow:hidden}
.seek i{display:block;height:100%;background:var(--tx);transition:width .15s linear}
.time{color:var(--sub); font-size: 13px;}

/* console */
.console{padding:32px 40px}
.con-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px; position: relative; z-index: 10;}
.fmt{display:flex;gap:8px}
.fmt i{font-style:normal;padding:6px 12px;border:1px solid var(--line);border-radius:8px;color:var(--sub)}
.tiles{display:grid;grid-template-columns:1fr 1fr;gap:20px; position: relative; z-index: 10;}
.tile{position:relative;border:1px solid var(--line);border-radius:24px;padding:32px 24px;cursor:pointer;background: rgba(255,255,255,0.02); transition:all .3s cubic-bezier(.25,.8,.25,1); text-align:left; font:inherit; color:inherit; width:100%;}
.light .tile{background: rgba(255,255,255,0.4);}
.tile:hover{transform:translateY(-6px);background:rgba(255,255,255,0.05);border-color:var(--line); box-shadow: 0 12px 32px rgba(0,0,0,0.1);}
.light .tile:hover{background:rgba(255,255,255,0.8);}
.tile:focus-visible{outline:2px solid var(--volt);outline-offset:2px}
.tile:active{transform:scale(.97)}
.tile.over{border-color:var(--volt);background:rgba(203, 243, 33, .08)}
.tile.off,.tile:disabled{opacity:.5;pointer-events:none}
.tile.recing{border-color:#ff3b30;}
.tile-no{position:absolute;top:20px;right:24px;color:var(--sub)}
.tile-ico{position:relative;width:56px;height:56px;border:1px solid var(--line);border-radius:16px;display:grid;place-items:center;color:var(--tx);margin-bottom:20px;transition:.3s; background: var(--bg);}
.tile:hover .tile-ico{background:var(--tx);color:var(--bg); border-color: transparent;}
.tile-ico.rec{background:#ff3b30;color:#fff;border-color:transparent; box-shadow: 0 0 20px rgba(255,59,48,0.4);}
.rip{position:absolute;inset:0;border-radius:16px;border:1.5px solid rgba(255,59,48,.8);animation:rip 1.5s ease-out infinite}
.rip.r2{animation-delay:.75s}
@keyframes rip{from{transform:scale(1);opacity:1}to{transform:scale(1.7);opacity:0}}
.tile-t{font-family:'Space Grotesk';font-weight:700;font-size:20px; color: var(--tx);}
.tile-s{color:var(--sub);font-size:14px;margin-top:6px}
.tile-tag{display:inline-block;margin-top:20px;padding:8px 14px;border:1px solid var(--line);border-radius:8px;color:var(--sub)}
.tile-tag.hot{color:#ff3b30;border-color:rgba(255,59,48,.3); background: rgba(255,59,48,0.1); animation:blink 1s infinite}
@keyframes blink{50%{opacity:.5}}
.con-foot{margin-top:24px;padding-top:24px;border-top:1px solid var(--hair);color:var(--sub)}
.d{animation:dot 1.2s infinite;font-style:normal}
.d:nth-child(2){animation-delay:.2s}.d:nth-child(3){animation-delay:.4s}
@keyframes dot{0%,100%{opacity:.2}50%{opacity:1}}

/* tips */
.tips{padding:12px 32px}
.tip{border-bottom:1px solid var(--hair); position: relative; z-index: 10;}
.tip:last-child{border:none}
.tq{width:100%;display:flex;align-items:center;gap:24px;background:none;border:none;color:var(--tx);padding:24px 0;cursor:pointer;text-align:left}
.tq:focus-visible{outline:2px solid var(--volt);outline-offset:2px}
.tno{color:var(--sub); font-size: 13px;}
.tqt{font-family:'Space Grotesk';font-weight:600;font-size:18px;flex:1;transition:transform .3s cubic-bezier(.25,.8,.25,1)}
.tq:hover .tqt{transform:translateX(8px); color: var(--volt);}
.light .tq:hover .tqt{color: var(--tx);}
.tplus{font-family:'JetBrains Mono';font-size:22px;color:var(--sub);transition:all .4s cubic-bezier(.34, 1.56, .64, 1);}
.tip.open .tplus{transform:rotate(135deg);color:var(--volt)}
.ta{display:grid;grid-template-rows:0fr;transition:grid-template-rows .4s cubic-bezier(.25,.8,.25,1)}
.tip.open .ta{grid-template-rows:1fr}
.ta p{overflow:hidden;color:var(--sub);font-size:15px;line-height:1.7;padding-left:46px;max-width:600px}
.tip.open .ta p{padding-bottom:24px}

/* footer */
.foot{border-top:1px solid var(--hair);padding-top:60px;display:flex;flex-direction:column;gap:32px}
.foot-big{font-family:'Space Grotesk';font-weight:700;font-size:clamp(36px,6vw,64px);letter-spacing:-.04em; color: var(--tx);}
.foot-big em{font-family:'Instrument Serif',serif;font-style:italic;font-weight:400}
.foot-row{display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap}
.tlink{background:rgba(255,255,255,0.03);border:1px solid var(--line);border-radius:30px;padding:14px 24px;color:var(--tx);cursor:pointer;transition:all .3s;}
.tlink:hover{background:var(--tx);color:var(--bg)}
.li{display:inline-flex;align-items:center;gap:12px;color:var(--tx);text-decoration:none;border:1px solid var(--line);background:rgba(255,255,255,0.03);border-radius:30px;padding:14px 24px;transition:all .3s;}
.li:hover{background:var(--tx);color:var(--bg)}
.cpy{color:var(--sub); font-size: 10px;}

/* results */
.res-page{gap:32px;padding-top:40px}
.verdict-banner{display:flex;align-items:center;justify-content:center;gap:16px;text-align:center;padding:24px;font-family:'Space Grotesk';font-weight:700;font-size:clamp(14px,2vw,18px);letter-spacing:1.5px; border-radius: 20px;}
.vb-pulse{width:10px;height:10px;border-radius:50%;flex:none; position: relative; z-index: 10;}
.vb-danger{color:#ff6b61;border-color:rgba(255,59,48,.5); background: rgba(255,59,48,0.05);}
.vb-danger .vb-pulse{background:#ff3b30;box-shadow: 0 0 12px #ff3b30; animation:pulse 1.5s infinite}
.vb-warn{color:#ffb85c;border-color:rgba(255,159,10,.5); background: rgba(255,159,10,0.05);}
.vb-warn .vb-pulse{background:#ff9f0a; box-shadow: 0 0 12px #ff9f0a;}
.vb-safe{color:var(--volt);border-color:rgba(203, 243, 33, .4); background: rgba(203, 243, 33, .05);}
.vb-safe .vb-pulse{background:var(--volt); box-shadow: 0 0 12px var(--volt);}
@keyframes pulse{50%{opacity:.4; transform: scale(0.8)}}

.res-grid{display:grid;grid-template-columns:1fr 1fr;gap:32px}
.res-num{padding:40px;display:flex;flex-direction:column;gap:16px}
.big-num{font-family:'Space Grotesk';font-weight:700;font-size:clamp(100px,12vw,160px);line-height:0.85;letter-spacing:-.06em;font-variant-numeric:tabular-nums; text-shadow: 0 4px 24px rgba(0,0,0,0.2); position: relative; z-index: 10;}
.big-num em{font-style:normal;font-size:.4em;color:var(--sub)}
.big-cap{font-family:'JetBrains Mono';font-size:13px;letter-spacing:3px;color:var(--sub); position: relative; z-index: 10;}
.vline{font-size:16px;line-height:1.7;max-width:400px; color: var(--tx); position: relative; z-index: 10;}
.src{color:var(--sub);margin-top:auto;padding-top:20px;border-top:1px solid var(--hair); position: relative; z-index: 10;}
.res-gauge{padding:40px;display:flex;flex-direction:column;align-items:center;gap:32px}
.gauge-w{position:relative;width:min(260px,50vw); z-index: 10;}
.gauge{width:100%;transform:rotate(-90deg)}
.g-track{fill:none;stroke:var(--line);stroke-width:3}
.g-fill{fill:none;stroke-width:12;stroke-linecap:round;stroke-dasharray:4 2; filter: drop-shadow(0 0 8px currentColor);}
.g-inner{fill:none;stroke:var(--hair);stroke-width:1;stroke-dasharray:2 8}
.g-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px}
.g-center span{font-size:36px;letter-spacing:-1px;font-weight:600; color: var(--tx);}
.g-center small{color:var(--sub);letter-spacing:4px;font-size:10px}
.split{display:flex;gap:16px;width:100%; position: relative; z-index: 10;}
.si{flex:1;text-align:center;border:1px solid var(--line);background: rgba(255,255,255,0.02);border-radius:20px;padding:20px 12px;transition:all .3s;}
.si:hover{transform:translateY(-4px); background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.2);}
.si b{display:block;font-family:'Space Grotesk';font-size:28px;margin-bottom:8px}
.si span{color:var(--sub);font-size:10px}
.metrics{padding:32px 40px}
.metric{display:grid;grid-template-columns:auto 1fr 2fr auto;align-items:center;gap:24px;padding:16px 0;border-top:1px solid var(--hair); position: relative; z-index: 10;}
.mno{color:var(--sub)}
.m-label{font-size:15px;font-weight:500; color: var(--tx);}
.m-bar{height:6px;background:var(--line);border-radius:3px;overflow:hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,0.2);}
.m-bar i{display:block;height:100%;width:0;border-radius:3px;animation:grow 1.2s cubic-bezier(.22, 1, .36, 1) forwards; box-shadow: 0 0 10px currentColor;}
@keyframes grow{from{width:0!important}}
.m-val{color:var(--tx);min-width:32px;text-align:right; font-weight: 500;}

/* cta */
.cta-wrap{display:flex;justify-content:center;padding:20px 0 40px}
.cta{font-family:'Space Grotesk';font-weight:700;font-size:16px;letter-spacing:2px;padding:24px 48px;border-radius:60px;border:none;cursor:pointer;background:var(--volt);color:var(--ink);display:inline-flex;align-items:center;gap:14px;transition:all .3s cubic-bezier(.34, 1.56, .64, 1); box-shadow: 0 12px 32px rgba(203, 243, 33, 0.3);}
.light .cta{background:#111;color:#cbf321; box-shadow: 0 12px 32px rgba(0,0,0,0.2);}
.cta i{font-style:normal;transition:transform .3s; font-size: 20px;}
.cta:hover{transform:translateY(-4px) scale(1.02); box-shadow: 0 16px 40px rgba(203, 243, 33, 0.4);}
.cta:hover i{transform:translateX(6px)}
.cta:focus-visible{outline:2px solid var(--tx);outline-offset:3px}
.cta:active{transform:scale(.96)}
.cta.sm{padding:16px 32px;font-size:13px;width:100%;justify-content:center}

/* takeover */
.takeover{position:fixed;inset:0;z-index:90;display:grid;place-items:center;background:color-mix(in srgb,var(--bg) 70%,transparent);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);animation:tkin .5s ease both}
@keyframes tkin{from{opacity:0}to{opacity:1}}
.tk-inner{display:flex;flex-direction:column;align-items:center;gap:32px;width:min(460px,90vw);text-align:center; padding: 60px 40px;}
.tk-phase{color:var(--tx);font-size:13px;letter-spacing:4px; font-weight: 500; position: relative; z-index: 10;}
.tk-bar{width:100%;height:3px;background:var(--line);overflow:hidden; border-radius: 2px; position: relative; z-index: 10;}
.tk-bar i{display:block;height:100%;width:30%;background:var(--volt);border-radius: 2px;animation:tkslide 1.4s cubic-bezier(.65,0,.35,1) infinite alternate; box-shadow: 0 0 12px var(--volt);}
@keyframes tkslide{from{transform:translateX(-50%)}to{transform:translateX(350%)}}
.tk-file{color:var(--sub); position: relative; z-index: 10;}

/* drawer + modal */
.veil{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.6);backdrop-filter:blur(6px); opacity:0;pointer-events:none;transition:all .4s}
.veil.on{opacity:1;pointer-events:auto}
.veil.center{display:grid;place-items:center;padding:24px}
.drawer{position:fixed;top:0;left:0;bottom:0;z-index:70;width:min(360px,85vw);border-radius:0 32px 32px 0;padding:32px;display:flex;flex-direction:column;gap:12px;transform:translateX(-105%);transition:transform .6s cubic-bezier(.22, 1, .36, 1); border-left: none;}
.drawer.on{transform:none}
.dh{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px; position: relative; z-index: 10;}
.dlogo{font-family:'Space Grotesk';font-weight:700;font-size:20px;letter-spacing:-.02em; color: var(--tx);}
.dlogo em{font-family:'Instrument Serif',serif;font-style:italic;font-weight:400}
.dlab{color:var(--sub);margin-top:24px; position: relative; z-index: 10;}
.dlist{list-style:none;display:flex;flex-direction:column; position: relative; z-index: 10;}
.dlist li{display:flex;gap:16px;align-items:baseline;font-size:15px;padding:12px 0;border-bottom:1px solid var(--hair); color: var(--tx);}
.dlist li span{color:var(--sub)}
.dcontact{display:flex;align-items:center;gap:12px;color:var(--tx);text-decoration:none;font-weight:500;font-size:15px;padding:16px 0;transition:.3s; position: relative; z-index: 10;}
.dcontact:hover{color:var(--volt)}
.dterms{margin-top:auto;background:rgba(255,255,255,0.03);border:1px solid var(--line);border-radius:30px;padding:16px;color:var(--tx);cursor:pointer;transition:all .3s; position: relative; z-index: 10;}
.dterms:hover{background:var(--tx);color:var(--bg)}
.modal{max-width:520px;width:100%;padding:40px;max-height:85vh;overflow:auto;animation:pop .5s cubic-bezier(.34, 1.56, .64, 1) both}
@keyframes pop{from{opacity:0;transform:scale(.95) translateY(20px)}to{opacity:1;transform:none}}
.modal h3{font-family:'Space Grotesk';font-size:28px;letter-spacing:-.03em;margin:12px 0 24px; color: var(--tx); position: relative; z-index: 10;}
.modal ol{padding-left:20px;display:flex;flex-direction:column;gap:14px;font-size:15px;line-height:1.7;color:var(--sub); position: relative; z-index: 10;}
.modal a{color:var(--volt); text-decoration: none;}
.modal .cta{margin-top:32px; position: relative; z-index: 10;}

/* toast */
.toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:100;display:flex;align-items:center;gap:12px;padding:14px 20px;border-radius:16px;font-size:13px;color:var(--tx);max-width:min(420px,90vw);animation:toastin .35s cubic-bezier(.22,1,.36,1) both}
@keyframes toastin{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}
.toast-dot{width:8px;height:8px;border-radius:50%;flex:none;background:var(--sub)}
.toast.tone-warn .toast-dot{background:#ff9f0a;box-shadow:0 0 8px #ff9f0a}
.toast.tone-danger .toast-dot{background:#ff3b30;box-shadow:0 0 8px #ff3b30}
.toast-x{margin-left:auto;background:none;border:none;color:var(--sub);cursor:pointer;font-size:12px;padding:4px}
.toast-x:hover{color:var(--tx)}

/* responsive hardening */
@media(max-width:900px){
  .hero{flex-direction: column; text-align: center; justify-content: center; padding-top: 60px;}
  .hero-meta{justify-content: center;}
  .orbit-tag{display:none;}
}
@media(max-width:700px){
  .page{padding:0 20px 80px;gap:64px}
  .hero{gap: 20px;}
  .display .l1{font-size:56px}
  .display .l2{font-size:48px}
  .topbar{padding:16px 20px}
  .sect-head{gap:16px;margin-bottom:24px}
  .vn-panel,.console,.metrics{padding:24px 20px}
  .tips{padding:8px 20px}
  .tiles{grid-template-columns:1fr}
  .res-grid{grid-template-columns:1fr}
  .res-num,.res-gauge{padding:32px 20px}
  .big-num{font-size:clamp(80px,20vw,120px)}
  .metric{grid-template-columns:auto 1fr auto;row-gap:10px}
  .metric .m-bar{grid-column:1/-1}
  .foot-row{flex-direction:column;align-items:stretch}
  .tlink,.li{justify-content:center}
}
@media(prefers-reduced-motion:reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important}}

/* ══════════════════ NEW FEATURE STYLES ══════════════════ */

/* skip link — accessibility (#10) */
.skip-link{position:fixed;top:-60px;left:12px;z-index:200;background:var(--tx);color:var(--bg);padding:12px 20px;border-radius:12px;font-weight:600;transition:top .25s ease;text-decoration:none}
.skip-link:focus{top:12px}

/* account menu (topbar) */
.acct-wrap{position:relative}
.acct-avatar{width:46px;height:46px;border-radius:50%;border:1px solid var(--line);background:var(--tx);color:var(--bg);font-family:'Space Grotesk';font-weight:700;font-size:14px;cursor:pointer;display:grid;place-items:center;transition:.3s}
.acct-avatar:hover{background:var(--volt);color:var(--ink)}
.acct-menu{position:absolute;top:56px;right:0;z-index:40;width:240px;padding:20px;display:flex;flex-direction:column;gap:4px;text-align:left}
.acct-name{font-family:'Space Grotesk';font-weight:700;font-size:15px;color:var(--tx); position:relative; z-index:10;}
.acct-email{color:var(--sub);margin-bottom:10px; position:relative; z-index:10;}
.plan-badge{display:inline-block;align-self:flex-start;padding:5px 12px;border-radius:20px;font-family:'JetBrains Mono';font-size:10px;letter-spacing:1.5px;margin-bottom:12px;background:rgba(203,243,33,.12);color:var(--volt);border:1px solid rgba(203,243,33,.3); position:relative; z-index:10;}
.plan-badge.pb-pro{background:rgba(120,160,255,.12);color:#7aa2ff;border-color:rgba(120,160,255,.3)}
.plan-badge.pb-business{background:rgba(255,159,10,.12);color:#ff9f0a;border-color:rgba(255,159,10,.3)}
.acct-menu button{background:none;border:none;color:var(--tx);text-align:left;padding:10px 0;font-size:14px;cursor:pointer;border-top:1px solid var(--hair); position:relative; z-index:10;}
.acct-menu button:hover{color:var(--volt)}
.acct-menu button.acct-out{color:#ff6b61}

/* drawer nav list */
.dnav{display:flex;flex-direction:column;gap:2px; position:relative; z-index:10;}
.dnav button{background:none;border:none;color:var(--tx);text-align:left;padding:12px 0;font-size:15px;cursor:pointer;border-bottom:1px solid var(--hair);transition:.2s}
.dnav button:hover{color:var(--volt);transform:translateX(4px)}

/* mic level meter (#8) */
.mic-meter{display:flex;gap:3px;align-items:flex-end;height:20px;margin-top:14px}
.mic-seg{width:5px;height:100%;border-radius:2px;background:var(--line);transition:background .1s}
.mic-seg.lit{background:#ff3b30;box-shadow:0 0 6px rgba(255,59,48,.6)}

/* batch queue (#1) */
.batch-queue{margin-top:24px;padding-top:20px;border-top:1px solid var(--hair);display:flex;flex-direction:column;gap:10px; position:relative; z-index:10;}
.batch-queue .lab{color:var(--sub)}
.bq-row{display:flex;align-items:center;gap:12px;font-size:12px;color:var(--tx)}
.bq-dot{width:7px;height:7px;border-radius:50%;background:var(--sub);flex:none}
.bq-row.bq-analyzing .bq-dot{background:var(--volt);box-shadow:0 0 8px var(--volt);animation:blink 1s infinite}
.bq-row.bq-done .bq-dot{background:var(--volt)}
.bq-row.bq-blocked .bq-dot{background:#ff3b30}
.bq-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bq-status{color:var(--sub);font-family:'JetBrains Mono';font-size:10px;letter-spacing:1px}

/* quota banner (#14) */
.quota-banner{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:20px 28px;margin-top:20px;flex-wrap:wrap}
.quota-banner.at-limit{border-color:rgba(255,59,48,.4)}
.quota-banner.near-limit{border-color:rgba(255,159,10,.4)}
.qb-sub{color:var(--sub);font-size:14px;margin-top:4px; position:relative; z-index:10;}
.qb-btn{width:auto;flex:none;padding:12px 24px}

/* recent-activity sparkline (#11) */
.activity-panel{padding:28px 32px;display:flex;flex-direction:column;gap:16px}
.activity-top{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap; position:relative; z-index:10;}
.spark{width:100%;max-width:280px;height:56px; position:relative; z-index:10;}
.sm-btn{padding:10px 18px;font-size:11px}

/* results page extra actions */
.res-actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.ref-line{margin-top:4px;opacity:.8}

/* auth modal */
.auth-modal{display:flex;flex-direction:column;gap:16px}
.google-btn-slot{display:flex;justify-content:center;min-height:44px}
.google-btn-fallback{display:flex;align-items:center;justify-content:center;gap:12px;padding:14px 20px;border-radius:30px;border:1px solid var(--line);background:rgba(255,255,255,.03);color:var(--tx);font-weight:600;font-size:14px;cursor:pointer;transition:.3s; position:relative; z-index:10;}
.google-btn-fallback:hover{background:var(--tx);color:var(--bg)}
.auth-divider{display:flex;align-items:center;gap:12px;color:var(--sub);font-size:10px; position:relative; z-index:10;}
.auth-divider span{flex:1;height:1px;background:var(--hair)}
.auth-form{display:flex;flex-direction:column;gap:14px; position:relative; z-index:10;}
.field{display:flex;flex-direction:column;gap:8px}
.field span{color:var(--sub); font-size:10px; letter-spacing:1.5px;}
.field input{background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:14px;padding:14px 16px;color:var(--tx);font-size:15px;font-family:inherit;outline:none;transition:border-color .2s}
.field input:focus{border-color:var(--volt)}
.light .field input{background:rgba(255,255,255,.5)}
.auth-switch{background:none;border:none;color:var(--volt);cursor:pointer;text-align:center;padding:4px; position:relative; z-index:10;}
.auth-fine{color:var(--sub);font-size:12px;text-align:center; position:relative; z-index:10;}

/* pricing page */
.pricing-lede{color:var(--sub);font-size:16px;max-width:560px;margin-top:-70px}
.billing-toggle{display:flex;gap:2px;background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:30px;padding:4px;width:fit-content; position:relative; z-index:10;}
.billing-toggle button{background:none;border:none;color:var(--sub);padding:10px 20px;border-radius:26px;cursor:pointer;transition:.2s}
.billing-toggle button.on{background:var(--tx);color:var(--bg)}
.billing-toggle em{font-style:normal;color:var(--volt);margin-left:4px}
.pricing-grid{grid-template-columns:repeat(3,1fr);align-items:stretch}
.price-card{padding:36px 28px;display:flex;flex-direction:column;gap:16px;position:relative}
.price-card.featured{border-color:rgba(203,243,33,.4)}
.price-pop{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:var(--volt);color:var(--ink);padding:6px 16px;border-radius:20px;font-size:10px;letter-spacing:1.5px;font-weight:700; z-index:10;}
.price-amt{font-family:'Space Grotesk';font-weight:700;font-size:44px;letter-spacing:-.03em; color:var(--tx); position:relative; z-index:10;}
.price-amt span{font-size:14px;color:var(--sub);font-family:'JetBrains Mono';margin-left:6px}
.price-blurb{color:var(--sub);font-size:14px;min-height:40px; position:relative; z-index:10;}
.price-feats{list-style:none;display:flex;flex-direction:column;gap:12px;flex:1; position:relative; z-index:10;}
.price-feats li{display:flex;gap:10px;font-size:14px;color:var(--tx);align-items:flex-start}
.pf-check{color:var(--volt);font-weight:700;flex:none}
.price-card .cta.current{opacity:.5;cursor:default}

/* history page */
.history-toolbar{padding:24px 28px;display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between}
.hist-search{flex:1;min-width:220px;background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:14px;padding:12px 16px;color:var(--tx);font-size:14px;outline:none; position:relative; z-index:10;}
.hist-filters{display:flex;gap:6px; position:relative; z-index:10;}
.hist-filters button{background:none;border:1px solid var(--line);color:var(--sub);padding:8px 14px;border-radius:20px;cursor:pointer;transition:.2s}
.hist-filters button.on{background:var(--tx);color:var(--bg)}
.hist-actions{display:flex;gap:8px; position:relative; z-index:10;}
.hist-empty{padding:60px 40px;text-align:center;display:flex;flex-direction:column;gap:10px}
.hist-empty p:last-child{color:var(--sub)}
.hist-table{padding:8px 28px 20px}
.hist-row{display:grid;grid-template-columns:2fr 1.4fr 1fr .6fr 1.2fr;gap:16px;align-items:center;padding:16px 0;border-top:1px solid var(--hair);font-size:14px; position:relative; z-index:10;}
.hist-head{color:var(--sub);border-top:none;padding-bottom:12px}
.hist-file{color:var(--tx);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hist-ref{color:var(--sub);font-size:10px}
.hist-badge{display:inline-block;padding:5px 10px;border-radius:16px;font-family:'JetBrains Mono';font-size:10px;letter-spacing:1px;width:fit-content}
.hb-danger{background:rgba(255,59,48,.12);color:#ff6b61}
.hb-warn{background:rgba(255,159,10,.12);color:#ffb85c}
.hb-safe{background:rgba(203,243,33,.12);color:var(--volt)}

/* settings / shortcuts modal extras */
.settings-block{padding:16px 0;border-top:1px solid var(--hair);display:flex;flex-direction:column;gap:10px; position:relative; z-index:10;}
.settings-block:first-of-type{border-top:none}
.settings-btn-row{display:flex;gap:10px;flex-wrap:wrap}
.shortcut-list{display:flex;flex-direction:column;gap:14px;margin:8px 0 24px; position:relative; z-index:10;}
.shortcut-row{display:flex;align-items:center;gap:16px;font-size:14px;color:var(--tx)}
.kbd{background:rgba(255,255,255,.06);border:1px solid var(--line);border-radius:8px;padding:6px 12px;min-width:64px;text-align:center;color:var(--tx)}

/* mobile bottom tab bar (#9) */
.mtab{display:none}
@media(max-width:700px){
  .mtab{
    display:flex;position:fixed;left:0;right:0;bottom:0;z-index:80;
    background:color-mix(in srgb,var(--bg) 82%,transparent);
    backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
    border-top:1px solid var(--hair);
    padding:8px 6px calc(8px + env(safe-area-inset-bottom));
  }
  .mtab-btn{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;background:none;border:none;color:var(--sub);padding:8px 4px;cursor:pointer;border-radius:14px}
  .mtab-btn.on{color:var(--volt)}
  .mtab-ico{font-size:18px}
  .mtab-lab{font-size:10px;letter-spacing:.5px;font-family:'JetBrains Mono'}
  .page{padding-bottom:110px}
  .pricing-grid{grid-template-columns:1fr}
  .pricing-lede{margin-top:-40px}
  .hist-row{grid-template-columns:1fr 1fr;row-gap:8px}
  .hist-head{display:none}
  .hist-file{grid-column:1/-1;font-size:15px}
  .history-toolbar{flex-direction:column;align-items:stretch}
  .hist-filters{overflow-x:auto}
  .quota-banner{flex-direction:column;align-items:flex-start}
  .acct-menu{right:-8px;width:220px}
}
@media(max-width:900px){ .pricing-grid{grid-template-columns:1fr 1fr} }

/* ══════════════════ NEW FEATURE STYLES ══════════════════ */

/* status pill (topbar) */
.status-pill{display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:20px;border:1px solid var(--line);background:rgba(255,255,255,.03);color:var(--sub);cursor:pointer;transition:.2s;font-size:9px}
.status-pill:hover{border-color:var(--tx)}
.status-dot{width:7px;height:7px;border-radius:50%;background:var(--sub);flex:none}
.status-pill.st-online .status-dot{background:var(--volt);box-shadow:0 0 6px var(--volt)}
.status-pill.st-online{color:var(--volt);border-color:rgba(203,243,33,.3)}
.status-pill.st-offline .status-dot{background:var(--warn);box-shadow:0 0 6px var(--warn)}
.status-pill.st-offline{color:var(--warn);border-color:rgba(255,181,69,.3)}
.status-pill.st-checking .status-dot{animation:blink 1s infinite}
@media(max-width:820px){.status-pill span:not(.status-dot){display:none}.status-pill{padding:8px 10px}}
.status-rows{display:flex;flex-direction:column;gap:10px;margin:6px 0}
.status-row{display:flex;justify-content:space-between;align-items:center;font-size:14px;padding:10px 0;border-top:1px solid var(--hair)}
.status-row:first-child{border-top:none}

/* stats strip */
.stats-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;padding:32px 28px}
.stat-cell{text-align:center;display:flex;flex-direction:column;gap:6px}
.stat-num{font-family:'Space Grotesk';font-weight:700;font-size:clamp(24px,4vw,36px);color:var(--volt)}
.stat-lab{color:var(--sub);font-size:9px}
@media(max-width:700px){.stats-strip{grid-template-columns:1fr 1fr;row-gap:24px}}

/* trust badges */
.trust-grid{grid-template-columns:repeat(4,1fr)}
.trust-card{padding:26px 22px;display:flex;flex-direction:column;gap:8px}
.trust-ico{font-size:26px}
.trust-t{font-family:'Space Grotesk';font-weight:700;font-size:15px}
.trust-d{color:var(--sub);font-size:13px;line-height:1.5}
@media(max-width:900px){.trust-grid{grid-template-columns:1fr 1fr}}
@media(max-width:560px){.trust-grid{grid-template-columns:1fr}}

/* testimonials */
.testi-card{padding:40px 36px;display:flex;flex-direction:column;gap:16px;align-items:flex-start}
.testi-quote{font-family:'Instrument Serif';font-style:italic;font-size:clamp(18px,2.4vw,24px);line-height:1.5;color:var(--tx)}
.testi-name{font-weight:600;font-size:14px}
.testi-role{color:var(--sub);font-weight:400}
.testi-dots{display:flex;gap:8px;margin-top:6px}
.testi-dot{width:8px;height:8px;border-radius:50%;background:var(--line);border:none;cursor:pointer;padding:0}
.testi-dot.on{background:var(--volt)}

/* comparison table */
.cmp-wrap{padding:12px 28px 24px;overflow-x:auto}
.cmp-row{display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;gap:12px;align-items:center;padding:14px 0;border-top:1px solid var(--hair);min-width:520px}
.cmp-head{color:var(--sub);border-top:none;font-size:10px}
.cmp-label{font-size:14px}
.cmp-cell{font-size:14px;color:var(--sub);text-align:center}
.cmp-yes{color:var(--volt);font-weight:700}

/* FAQ */
.faq-wrap{padding:8px 28px}
.faq-item{border-top:1px solid var(--hair)}
.faq-item:first-child{border-top:none}
.faq-q{width:100%;background:none;border:none;color:var(--tx);display:flex;justify-content:space-between;align-items:center;padding:18px 0;font-size:15px;font-weight:500;cursor:pointer;text-align:left;gap:16px}
.faq-plus{color:var(--volt);font-family:'JetBrains Mono';flex:none;font-size:18px}
.faq-a{color:var(--sub);font-size:14px;line-height:1.6;padding-bottom:18px;max-width:640px}

/* integrations */
.integ-row{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px}
.integ-chip{padding:10px 18px;border-radius:20px;border:1px solid var(--line);background:rgba(255,255,255,.03);font-size:10px}

/* API / developer */
.api-card{padding:28px 32px;display:flex;flex-direction:column;gap:16px}
.code-block{background:rgba(0,0,0,.35);border:1px solid var(--hair);border-radius:14px;padding:20px;overflow-x:auto;color:var(--volt);font-size:12px;line-height:1.7;white-space:pre}
.light .code-block{background:rgba(0,0,0,.06);color:#0a7d34}

/* case studies / team */
.cases-grid{grid-template-columns:repeat(3,1fr)}
.case-card{padding:26px 24px;display:flex;flex-direction:column;gap:8px}
.case-t{font-family:'Space Grotesk';font-weight:700;font-size:16px}
.case-d{color:var(--sub);font-size:13px;line-height:1.5}
.team-grid{grid-template-columns:repeat(3,1fr)}
.team-card{padding:28px 24px;display:flex;flex-direction:column;gap:10px;align-items:flex-start}
.team-avatar{width:46px;height:46px;border-radius:50%;background:var(--tx);color:var(--bg);display:grid;place-items:center;font-weight:700;font-size:13px}
@media(max-width:900px){.cases-grid,.team-grid{grid-template-columns:1fr 1fr}}
@media(max-width:560px){.cases-grid,.team-grid{grid-template-columns:1fr}}

/* roadmap */
.road-wrap{padding:8px 28px 20px}
.road-row{display:flex;align-items:center;gap:16px;padding:14px 0;border-top:1px solid var(--hair)}
.road-row:first-child{border-top:none}
.road-label{font-size:14px}

/* live activity ticker */
.ticker-wrap{padding:10px 28px 20px;display:flex;flex-direction:column;gap:2px}
.ticker-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid var(--hair);font-size:13px}
.ticker-row:first-child{border-top:none}
.ticker-file{flex:1;color:var(--sub)}

/* referral */
.referral-card{padding:28px 32px;display:flex;flex-direction:column;gap:14px}
.ref-row{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.ref-code{background:rgba(255,255,255,.05);border:1px dashed var(--line);border-radius:12px;padding:12px 20px;font-size:16px;letter-spacing:2px;color:var(--volt)}

/* newsletter */
.newsletter-card{padding:28px 32px;display:flex;justify-content:space-between;align-items:center;gap:24px;flex-wrap:wrap}
.news-form{display:flex;gap:10px;flex-wrap:wrap}
.news-form input{width:240px}

/* downloads */
.download-grid{grid-template-columns:1fr 1fr}
.download-card{padding:28px 26px;display:flex;flex-direction:column;gap:10px}
.store-row{display:flex;gap:10px;flex-wrap:wrap;margin-top:6px}
.store-badge{padding:10px 16px;border-radius:12px;border:1px solid var(--line);font-size:10px}
@media(max-width:700px){.download-grid{grid-template-columns:1fr}}

/* enterprise form */
.enterprise-card{padding:28px 32px}
.ent-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:600px){.ent-grid{grid-template-columns:1fr}}
.select{background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:14px;padding:14px 16px;color:var(--tx);font-size:15px;font-family:inherit;outline:none}
.light .select{background:rgba(255,255,255,.5)}

/* notification bell + language selector */
.bell{position:relative;font-size:15px}
.bell-dot{position:absolute;top:8px;right:9px;width:7px;height:7px;border-radius:50%;background:var(--danger);border:1.5px solid var(--bg)}
.notif-menu{width:280px}
.notif-item{padding:12px 0;border-top:1px solid var(--hair);position:relative;z-index:10}
.notif-item:first-of-type{border-top:none}
.notif-t{font-weight:600;font-size:13px;color:var(--tx)}
.notif-d{color:var(--sub);font-size:12px;margin-top:3px}
.lang-menu{width:150px;padding:10px}
.lang-menu button{background:none;border:none;color:var(--tx);text-align:left;padding:10px 8px;font-size:14px;cursor:pointer;border-radius:8px;position:relative;z-index:10}
.lang-menu button:hover{background:rgba(255,255,255,.06);color:var(--volt)}

/* cookie banner */
.cookie-banner{position:fixed;left:20px;right:20px;bottom:20px;z-index:120;max-width:640px;margin:0 auto;padding:20px 24px;display:flex;gap:18px;align-items:center;flex-wrap:wrap;justify-content:space-between;font-size:13px;color:var(--sub)}
@media(max-width:700px){.cookie-banner{bottom:86px}}

/* press strip */
.press-strip{display:flex;flex-wrap:wrap;gap:28px;justify-content:center;padding:20px 0;color:var(--sub);font-size:9px;opacity:.7}

/* pricing payment methods row */
.pay-methods{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:24px;color:var(--sub)}
.pm-chip{padding:6px 12px;border:1px solid var(--line);border-radius:8px;font-size:9px}
.pm-lock{margin-left:auto;font-size:9px}

/* checkout modal */
.checkout-modal{max-width:460px}
.order-summary{background:rgba(255,255,255,.03);border:1px solid var(--hair);border-radius:14px;padding:16px 18px;display:flex;flex-direction:column;gap:8px;font-size:13px}
.order-summary > div{display:flex;justify-content:space-between}
.order-discount{color:var(--volt)}
.order-total{border-top:1px solid var(--hair);padding-top:8px;font-weight:700;font-size:15px;color:var(--tx)}
.checkout-form{margin-top:4px}
.field-err{color:var(--danger);font-size:11px;text-transform:none;letter-spacing:0;font-family:'Inter'}
.promo-row{display:flex;gap:10px;align-items:center}
.checkout-processing{display:flex;flex-direction:column;align-items:center;gap:18px;padding:30px 10px}
.spinner{width:40px;height:40px;border-radius:50%;border:3px solid var(--hair);border-top-color:var(--volt);animation:spin 0.9s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.checkout-success{display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px}
.success-check{width:56px;height:56px;border-radius:50%;background:var(--volt);color:var(--ink);display:grid;place-items:center;font-size:28px;font-weight:700}

/* expanded footer */
.site-foot{display:flex;flex-direction:column;gap:32px}
.foot-top{display:flex;justify-content:space-between;gap:48px;flex-wrap:wrap}
.foot-brand{max-width:340px;display:flex;flex-direction:column;gap:12px}
.foot-cols{display:flex;gap:48px;flex-wrap:wrap}
.foot-col{display:flex;flex-direction:column;gap:10px;min-width:140px}
.foot-link{background:none;border:none;color:var(--sub);text-align:left;padding:0;font-size:13px;cursor:pointer;width:fit-content}
.foot-link:hover{color:var(--volt)}
.foot-bottom{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;border-top:1px solid var(--hair);padding-top:20px}
@media(max-width:700px){.foot-top{flex-direction:column;gap:28px}.foot-cols{gap:28px}}
`;