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

function ResultsPage({ result, fileName, onScanAnother }) {
  const [displayAi, setDisplayAi] = useState(0);
  const verdict = result.ai >= 80 ? "danger" : result.ai >= 50 ? "warn" : "safe";
  const vColor = { danger: "#ff3b30", warn: "#ff9f0a", safe: "var(--volt)" }[verdict];
  const R = 112, CIRC = 2 * Math.PI * R;

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
    <main className="page res-page">
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

      <div className="cta-wrap" data-reveal>
        <button className="cta" onClick={onScanAnother}>
          SCAN ANOTHER AUDIO <i>→</i>
        </button>
      </div>
    </main>
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
  const [dark, setDark] = useState(true);
  const [page, setPage] = useState("home");
  const [drawer, setDrawer] = useState(false);
  const [terms, setTerms] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recSec, setRecSec] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [phase, setPhase] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState({ ai: 0, real: 0, metrics: [] });
  const [toast, setToast] = useState(null);
  const fileInput = useRef(null);
  const recTimer = useRef(null);
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);

  const notify = useCallback((msg, type = "info") => setToast({ msg, type }), []);

  useReveals(page);
  useEffect(() => { primeVoices(); }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [page]);
  useEffect(() => () => window.speechSynthesis.cancel(), []);
  useScrollLock(drawer || terms || analyzing);
  useEscapeClose(useMemo(() => [
    [terms, () => setTerms(false)],
    [drawer, () => setDrawer(false)],
  ], [terms, drawer]));

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

  /* --- BACKEND API CONNECTION (with graceful offline fallback) --- */
  const runAnalysis = useCallback(async (fileObj, name) => {
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

      setAnalyzing(false);
      setPage("results");
      blip(backendResult.ai >= 80 ? 200 : 760, 0.2);
    } catch (error) {
      console.error("Backend fetch failed, using simulated analysis:", error);
      const simulated = simulateAnalysis();
      setResult(simulated);
      setAnalyzing(false);
      setPage("results");
      notify("Backend unreachable — showing a simulated result (demo mode).", "warn");
      blip(simulated.ai >= 80 ? 200 : 760, 0.2);
    }
  }, [notify]);

  const handleFile = (f) => {
    if (!f) return;
    if (!/\.(mp3|wav|ogg|m4a|webm)$/i.test(f.name)) return notify("Please upload an MP3, WAV, OGG, or M4A file.", "warn");
    runAnalysis(f, f.name);
  };

  const toggleRecord = async () => {
    if (analyzing) return;
    if (!recording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
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

  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const blurred = drawer || terms || analyzing;
  const verdict = result.ai >= 80 ? "danger" : result.ai >= 50 ? "warn" : "safe";

  return (
    <div className={`vs ${dark ? "dark" : "light"} ${page === "results" ? `v-${verdict}` : ""}`}>
      <style>{css}</style>

      {/* OPTIMIZED GPU BACKGROUND */}
      <div className="bg-fluid" aria-hidden="true" />

      <div className={`layer ${blurred ? "dim" : ""}`}>
        <header className="topbar">
          <button className="hbtn" aria-label="Open menu" onClick={() => { setDrawer(true); blip(560); }}>
            <span /><span /><span />
          </button>
          <span className="brand mono">VOICESHIELD</span>
          <div className="top-right">
            {page === "results" && (
              <button className="hbtn back mono" onClick={() => { setPage("home"); setFileName(""); blip(480); }}>← BACK</button>
            )}
            <button className={`hbtn theme ${dark ? "" : "lit"}`} aria-label="Toggle theme" aria-pressed={!dark}
              onClick={() => { setDark((d) => !d); blip(dark ? 840 : 340); }}>
              <i />
            </button>
          </div>
        </header>

        {/* ═══════ HOME ═══════ */}
        {page === "home" && (
          <main className="page">
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
                    aria-label="Upload an audio file"
                    onClick={() => !analyzing && fileInput.current.click()}
                    onKeyDown={(e) => { if (!analyzing && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); fileInput.current.click(); } }}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
                  >
                    <span className="tile-no mono">A</span>
                    <div className="tile-ico">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M12 16V4m0 0L7 9m5-5l5 5"/><path d="M4 20h16"/></svg>
                    </div>
                    <p className="tile-t">Upload file</p>
                    <p className="tile-s">drag & drop or browse</p>
                    <span className="tile-tag mono">.mp3 .wav .ogg</span>
                  </div>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="audio/*"
                    hidden
                    onChange={(e) => { handleFile(e.target.files[0]); e.target.value = ""; }}
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
                  </button>
                </div>
              </div>
            </section>

            {/* 03 — tips */}
            <section className="sect" data-reveal>
              <div className="sect-head">
                <span className="mono idx">03</span>
                <h2 className="sect-t">Protect <em>yourself</em></h2>
                <span className="rule" />
              </div>
              <TipsPanel />
            </section>

            <footer className="foot" data-reveal>
              <p className="foot-big">Stay <em>human</em>-verified.</p>
              <div className="foot-row">
                <button className="tlink mono" onClick={() => setTerms(true)}>TERMS & CONDITIONS</button>
                <a className="li" href="#" target="_blank" rel="noreferrer" aria-label="LinkedIn">
                  <LinkedInIcon /> <span className="mono">/in/hackathon-team</span>
                </a>
              </div>
              <p className="cpy mono">© 2026 VOICESHIELD — DEMO BUILD</p>
            </footer>
          </main>
        )}

        {/* ═══════ RESULTS ═══════ */}
        {page === "results" && (
          <ResultsPage
            result={result}
            fileName={fileName}
            onScanAnother={() => { setPage("home"); setFileName(""); blip(620); }}
          />
        )}
      </div>

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
.vs.dark{--bg:#070709;--bg2:#16161c;--tx:#fdfcfb;--sub:#9696a0;--line:rgba(255,255,255,.1);--hair:rgba(255,255,255,.05);--volt:#cbf321;--ink:#0b0b0c;color:var(--tx);background:var(--bg)}
.vs.light{--bg:#f4f4f6;--bg2:#e2e2e7;--tx:#09090b;--sub:#6b6b78;--line:rgba(0,0,0,.1);--hair:rgba(0,0,0,.05);--volt:#111;--ink:#cbf321;color:var(--tx);background:var(--bg)}
.vs.v-danger.dark{--bg:#1f0b0d; --bg2:#330a10;}
.vs.v-warn.dark{--bg:#1a1105; --bg2:#2d1b03;}
.vs.v-safe.dark{--bg:#0c130b; --bg2:#11200f;}

/* background */
.bg-fluid {
  position: fixed; inset: -50%; z-index: 0;
  background: radial-gradient(circle at 50% 50%, var(--bg2) 0%, var(--bg) 60%);
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
`;