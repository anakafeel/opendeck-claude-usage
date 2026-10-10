#!/usr/bin/env node
// Claude Usage ring for OpenDeck / Stream Deck.
// Reads ~/.claude/.credentials.json (read-only, never refreshes or writes it)
// and polls the Claude usage endpoint. Draws an animated SVG ring per key.
// Press: toggle 5-hour / 7-day. Hold (>0.6s): force refresh.
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ENDPOINT = "https://api.anthropic.com/api/oauth/usage";
const POLL_MS = 90_000;
const BACKOFF_MS = 300_000;
const FRAME_MS = 100;
const HOLD_MS = 600;
const CRED_PATH = path.join(
  process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude"),
  ".credentials.json",
);

// ---------- args ----------
const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^-+/, "")] = process.argv[i + 1];

// ---------- usage data ----------
const usage = {
  status: "loading", // loading | ok | expired | nologin | error
  data: null, // { "5h": {pct, reset}, "7d": {pct, reset} }
  lastError: false,
  nextPoll: 0,
  flashUntil: 0,
};

function readToken() {
  try {
    const j = JSON.parse(fs.readFileSync(CRED_PATH, "utf8"));
    const o = j.claudeAiOauth || {};
    if (!o.accessToken) return { state: "nologin" };
    const exp = Number(o.expiresAt || 0);
    if (exp > 0 && Date.now() > exp) return { state: "expired" };
    return { state: "ok", token: o.accessToken };
  } catch {
    return { state: "nologin" };
  }
}

function node(n) {
  if (!n || typeof n.utilization !== "number") return null;
  return { pct: Math.max(0, Math.min(100, n.utilization)), reset: n.resets_at ? Date.parse(n.resets_at) : null };
}

async function poll() {
  const cred = readToken();
  if (cred.state !== "ok") {
    usage.status = cred.state;
    usage.nextPoll = Date.now() + 30_000; // Claude Code may refresh the file soon
    return;
  }
  try {
    const res = await fetch(ENDPOINT, {
      headers: {
        Authorization: `Bearer ${cred.token}`,
        "anthropic-beta": "oauth-2025-04-20",
        "User-Agent": "opendeck-claude-usage/1.0.0 (+https://github.com/anakafeel/opendeck-claude-usage)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 401) {
      usage.status = "expired";
      usage.nextPoll = Date.now() + 30_000;
      return;
    }
    if (!res.ok) throw new Error(`http ${res.status}`);
    const j = await res.json();
    usage.data = { "5h": node(j.five_hour), "7d": node(j.seven_day) };
    usage.status = "ok";
    usage.lastError = false;
    usage.nextPoll = Date.now() + POLL_MS;
  } catch (e) {
    usage.lastError = true;
    if (!usage.data) usage.status = "error";
    usage.nextPoll = Date.now() + (String(e.message).includes("429") ? BACKOFF_MS : 60_000);
  }
}

// ---------- vector glyphs (4x6 grid, y down) ----------
// Each glyph: [width, strokes]; a stroke is a list of x,y pairs, or {dot:[x,y]}.
const G = {
  "0": [4, [[0, 0, 4, 0, 4, 6, 0, 6, 0, 0]]],
  "1": [3, [[0, 1, 1.5, 0, 1.5, 6], [0, 6, 3, 6]]],
  "2": [4, [[0, 0, 4, 0, 4, 3, 0, 3, 0, 6, 4, 6]]],
  "3": [4, [[0, 0, 4, 0, 4, 6, 0, 6], [1, 3, 4, 3]]],
  "4": [4, [[0, 0, 0, 3, 4, 3], [4, 0, 4, 6]]],
  "5": [4, [[4, 0, 0, 0, 0, 3, 4, 3, 4, 6, 0, 6]]],
  "6": [4, [[4, 0, 0, 0, 0, 6, 4, 6, 4, 3, 0, 3]]],
  "7": [4, [[0, 0, 4, 0, 1.5, 6]]],
  "8": [4, [[0, 0, 4, 0, 4, 6, 0, 6, 0, 0], [0, 3, 4, 3]]],
  "9": [4, [[4, 3, 0, 3, 0, 0, 4, 0, 4, 6, 0, 6]]],
  "%": [4, [[0, 6, 4, 0], { dot: [0.4, 0.6] }, { dot: [3.6, 5.4] }]],
  H: [4, [[0, 0, 0, 6], [4, 0, 4, 6], [0, 3, 4, 3]]],
  D: [4, [[0, 0, 3, 0, 4, 1, 4, 5, 3, 6, 0, 6, 0, 0]]],
  M: [4, [[0, 6, 0, 0, 2, 3, 4, 0, 4, 6]]],
  E: [4, [[4, 0, 0, 0, 0, 6, 4, 6], [0, 3, 3, 3]]],
  X: [4, [[0, 0, 4, 6], [4, 0, 0, 6]]],
  P: [4, [[0, 6, 0, 0, 4, 0, 4, 3, 0, 3]]],
  R: [4, [[0, 6, 0, 0, 4, 0, 4, 3, 0, 3], [1.5, 3, 4, 6]]],
  N: [4, [[0, 6, 0, 0, 4, 6, 4, 0]]],
  O: [4, [[0, 0, 4, 0, 4, 6, 0, 6, 0, 0]]],
  L: [4, [[0, 0, 0, 6, 4, 6]]],
  I: [2, [[1, 0, 1, 6], [0, 0, 2, 0], [0, 6, 2, 6]]],
  G: [4, [[4, 0, 0, 0, 0, 6, 4, 6, 4, 3, 2, 3]]],
  S: [4, [[4, 0, 0, 0, 0, 3, 4, 3, 4, 6, 0, 6]]],
  T: [4, [[0, 0, 4, 0], [2, 0, 2, 6]]],
  A: [4, [[0, 6, 0, 0, 4, 0, 4, 6], [0, 3, 4, 3]]],
  U: [4, [[0, 0, 0, 6, 4, 6, 4, 0]]],
  C: [4, [[4, 0, 0, 0, 0, 6, 4, 6]]],
  W: [4, [[0, 0, 1, 6, 2, 3, 3, 6, 4, 0]]],
  F: [4, [[4, 0, 0, 0, 0, 6], [0, 3, 3, 3]]],
  "-": [3, [[0, 3, 3, 3]]],
  ":": [1, [{ dot: [0.5, 1.6] }, { dot: [0.5, 4.4] }]],
  " ": [2, []],
};

function textWidth(str, h) {
  const chars = [...String(str).toUpperCase()].filter((c) => G[c]);
  return chars.reduce((w, c) => w + G[c][0] + 1.6, -1.6) * (h / 6);
}

function text(str, cx, y, h, color, sw, opacity = 1) {
  const s = h / 6;
  const gap = 1.6;
  const chars = [...String(str).toUpperCase()].filter((c) => G[c]);
  let x = cx - textWidth(str, h) / 2;
  let d = "";
  let dots = "";
  for (const c of chars) {
    const [w, strokes] = G[c];
    for (const st of strokes) {
      if (st.dot) {
        dots += `<circle cx="${(x + st.dot[0] * s).toFixed(1)}" cy="${(y + st.dot[1] * s).toFixed(1)}" r="${(sw * 0.62).toFixed(1)}" fill="${color}"/>`;
        continue;
      }
      for (let i = 0; i < st.length; i += 2) d += `${i ? "L" : "M"}${(x + st[i] * s).toFixed(1)} ${(y + st[i + 1] * s).toFixed(1)}`;
    }
    x += (w + gap) * s;
  }
  return `<g opacity="${opacity}"><path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>${dots}</g>`;
}

// ---------- rendering ----------
const C = 72, CY = 64, R = 48, CIRC = 2 * Math.PI * R;
const CLAUDE = "#D97757";

function levelColor(p) {
  // green -> amber -> coral -> red, as [h, s, l]
  const stops = [[0, 152, 70, 58], [55, 88, 80, 58], [75, 40, 95, 58], [90, 12, 90, 60], [100, 0, 85, 58]];
  let a = stops[0], b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) if (p >= stops[i][0] && p <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
  const k = b[0] === a[0] ? 0 : (p - a[0]) / (b[0] - a[0]);
  const mix = (i) => a[i] + (b[i] - a[i]) * k;
  return [mix(1), mix(2), mix(3)];
}
const hsl = ([h, s, l], dl = 0) => `hsl(${h.toFixed(0)},${s.toFixed(0)}%,${Math.max(0, Math.min(100, l + dl)).toFixed(0)}%)`;

// Local wall-clock reset time: "10:20P", or "THU 7P" when it isn't today.
const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
function fmtReset(ms) {
  if (ms == null) return "";
  const d = new Date(Math.round(ms / 60000) * 60000);
  const h = d.getHours() % 12 || 12;
  const min = d.getMinutes();
  const clock = `${h}${min ? ":" + String(min).padStart(2, "0") : ""}${d.getHours() < 12 ? "A" : "P"}`;
  return d.toDateString() === new Date().toDateString() ? clock : `${DAYS[d.getDay()]} ${clock}`;
}

function star(cx, cy, r, rot, color, opacity) {
  // Claude-style 8-ray spark
  let d = "";
  for (let i = 0; i < 8; i++) {
    const a = rot + (i * Math.PI) / 4;
    const len = i % 2 ? r * 0.62 : r;
    d += `M${(cx + Math.cos(a) * r * 0.22).toFixed(1)} ${(cy + Math.sin(a) * r * 0.22).toFixed(1)}L${(cx + Math.cos(a) * len).toFixed(1)} ${(cy + Math.sin(a) * len).toFixed(1)}`;
  }
  return `<path d="${d}" stroke="${color}" stroke-width="${(r * 0.26).toFixed(1)}" stroke-linecap="round" opacity="${opacity}"/>`;
}

// ---------- meme mode ----------
// 90%+: sweating face. 100%: "touch grass" with the reset countdown.
function sweatingFace(cx, cy, t) {
  const r = 17;
  const drop = (t * 0.7) % 1; // sweat drop slides down, then respawns
  const dy = drop * 12, dOp = (1 - drop) * 0.95;
  const jitter = Math.sin(t * 31) * 0.6; // nervous shake
  const x = cx + jitter;
  return `<g>
<circle cx="${x.toFixed(1)}" cy="${cy}" r="${r}" fill="#FFC83D"/>
<circle cx="${x.toFixed(1)}" cy="${cy}" r="${r}" fill="none" stroke="#C98A12" stroke-width="1.5"/>
<path d="M${(x - 11).toFixed(1)} ${cy - 7}L${(x - 4).toFixed(1)} ${cy - 10}M${(x + 11).toFixed(1)} ${cy - 7}L${(x + 4).toFixed(1)} ${cy - 10}" stroke="#5a3a00" stroke-width="2" stroke-linecap="round"/>
<ellipse cx="${(x - 6).toFixed(1)}" cy="${cy - 2}" rx="2" ry="2.8" fill="#3a2500"/>
<ellipse cx="${(x + 6).toFixed(1)}" cy="${cy - 2}" rx="2" ry="2.8" fill="#3a2500"/>
<path d="M${(x - 7).toFixed(1)} ${cy + 9}Q${(x - 3.5).toFixed(1)} ${cy + 6} ${x.toFixed(1)} ${cy + 9}T${(x + 7).toFixed(1)} ${cy + 9}" fill="none" stroke="#5a3a00" stroke-width="2" stroke-linecap="round"/>
<path d="M${(x + 14).toFixed(1)} ${(cy - 10 + dy).toFixed(1)}q-3.5 5 0 7q3.5 -2 0 -7z" fill="#7cc8ff" stroke="#3d9be0" stroke-width="0.8" opacity="${dOp.toFixed(2)}"/>
</g>`;
}

function touchGrass(entry, t) {
  let s = text("TOUCH", 72, 12, 15, "#ffffff", 3);
  s += text("GRASS", 72, 34, 15, "#7ee08a", 3);
  const reset = entry && entry.reset ? fmtReset(entry.reset) : "";
  if (reset) {
    s += text("RESETS AT", 72, 60, 7, "#ffffff", 1.6, 0.55);
    const h = Math.min(16, (16 * 136) / textWidth(reset, 16));
    s += text(reset, 72, 72, h, CLAUDE, 3);
  }
  // swaying grass along the bottom
  let blades = "";
  for (let i = 0; i < 22; i++) {
    const bx = 2 + i * 6.6 + (i % 3) * 1.3;
    const h = 22 + ((i * 37) % 17);
    const sway = Math.sin(t * 2.2 + i * 0.7) * 4;
    const tipX = bx + sway, tipY = 144 - h;
    blades += `<path d="M${(bx - 3).toFixed(1)} 145Q${(bx - 1 + sway / 2).toFixed(1)} ${(144 - h / 2).toFixed(1)} ${tipX.toFixed(1)} ${tipY}Q${(bx + 1 + sway / 2).toFixed(1)} ${(144 - h / 2).toFixed(1)} ${(bx + 3).toFixed(1)} 145Z" fill="hsl(${110 + ((i * 13) % 30)},60%,${38 + ((i * 7) % 14)}%)"/>`;
  }
  return s + blades;
}

function render(key, t) {
  const now = Date.now();
  const entry = usage.data && usage.data[key.mode];
  const live = usage.data && usage.status !== "nologin";
  const target = entry ? entry.pct : 0;
  key.shown += (target - key.shown) * 0.14;
  if (Math.abs(target - key.shown) < 0.05) key.shown = target;
  const p = key.shown;

  const stale = usage.status === "expired" || usage.lastError;
  const col = stale ? [230, 8, 55] : levelColor(p);
  const danger = !stale && p >= 90;
  const breathe = 0.5 + 0.5 * Math.sin(t * (danger ? 7 : 2.2));
  const flash = now < usage.flashUntil ? (usage.flashUntil - now) / 400 : 0;

  const bgTint = danger ? `rgba(255,60,60,${(0.10 + 0.12 * breathe).toFixed(2)})` : "rgba(217,119,87,0.07)";
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
<defs>
<radialGradient id="bg" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#1d1a26"/><stop offset="1" stop-color="#07070b"/></radialGradient>
<linearGradient id="arc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hsl(col, 14)}"/><stop offset="1" stop-color="${hsl(col, -6)}"/></linearGradient>
<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>
<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter>
</defs>
<rect width="144" height="144" fill="url(#bg)"/>
<rect width="144" height="144" fill="${bgTint}"/>`;

  if (live && !stale && p >= 99.5) return s + touchGrass(entry, t) + "</svg>";

  s += `<circle cx="${C}" cy="${CY}" r="${R}" fill="none" stroke="#ffffff" stroke-opacity="0.07" stroke-width="12"/>`;

  // tick marks every 10%
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r1 = R + 9, r2 = R + 12;
    s += `<path d="M${(C + Math.cos(a) * r1).toFixed(1)} ${(CY + Math.sin(a) * r1).toFixed(1)}L${(C + Math.cos(a) * r2).toFixed(1)} ${(CY + Math.sin(a) * r2).toFixed(1)}" stroke="#fff" stroke-opacity="${live && p >= i * 10 ? 0.35 : 0.1}" stroke-width="1.6" stroke-linecap="round"/>`;
  }

  if (usage.status === "loading" && !usage.data) {
    const rot = (t * 240) % 360;
    s += `<circle cx="${C}" cy="${CY}" r="${R}" fill="none" stroke="${CLAUDE}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${(CIRC * 0.22).toFixed(1)} ${CIRC.toFixed(1)}" transform="rotate(${rot.toFixed(1)} ${C} ${CY})"/>`;
    s += star(C, CY, 16, t * 3, CLAUDE, 0.9);
    s += text(key.mode, C, 122, 13, "#ffffff", 2.6, 0.5);
    return s + "</svg>";
  }

  if (live) {
    const len = Math.max(0.001, (CIRC * p) / 100);
    const arc = `<circle cx="${C}" cy="${CY}" r="${R}" fill="none" stroke="url(#arc)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${len.toFixed(1)} ${CIRC.toFixed(1)}" transform="rotate(-90 ${C} ${CY})"/>`;
    if (p > 0.3) {
      s += `<g filter="url(#glow)" opacity="${Math.min(1, 0.35 + 0.35 * breathe + flash * 0.5).toFixed(2)}">${arc}</g>`;
      s += arc;
      // spark riding the end of the arc
      const ea = -Math.PI / 2 + (2 * Math.PI * p) / 100;
      const ex = C + Math.cos(ea) * R, ey = CY + Math.sin(ea) * R;
      s += `<circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="${(7 + 2 * breathe).toFixed(1)}" fill="${hsl(col, 25)}" filter="url(#soft)" opacity="0.9"/>`;
      s += `<circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="3.2" fill="#fff"/>`;
    }
    // comet orbiting the empty part of the track
    const ca = -Math.PI / 2 + ((t * 0.9) % (2 * Math.PI));
    const caPct = (((ca + Math.PI / 2) / (2 * Math.PI)) * 100 + 100) % 100;
    if (caPct > p + 3) {
      for (let k = 0; k < 6; k++) {
        const a = ca - k * 0.07;
        s += `<circle cx="${(C + Math.cos(a) * R).toFixed(1)}" cy="${(CY + Math.sin(a) * R).toFixed(1)}" r="${(2.4 - k * 0.3).toFixed(1)}" fill="${CLAUDE}" opacity="${(0.55 - k * 0.09).toFixed(2)}"/>`;
      }
    }
    if (flash > 0) s += `<circle cx="${C}" cy="${CY}" r="${R}" fill="none" stroke="#fff" stroke-width="12" opacity="${(flash * 0.6).toFixed(2)}"/>`;

    const num = String(Math.round(p));
    if (danger) {
      // meme mode: sweating face + small percentage
      s += sweatingFace(C, CY - 8, t);
      s += text(num + "%", C, CY + 15, 11, "#ffffff", 2.4);
    } else {
      // center: small spinning spark + percentage
      s += star(C, CY - 23, 6, t * 0.8, CLAUDE, 0.85);
      const numW = textWidth(num, 26);
      const pctW = textWidth("%", 11);
      const x0 = C - (numW + 4 + pctW) / 2;
      s += text(num, x0 + numW / 2, CY - 11, 26, "#ffffff", 3.6);
      s += text("%", x0 + numW + 4 + pctW / 2, CY + 4, 11, hsl(col, 15), 2.2);
    }
    if (stale) s += text(usage.status === "expired" ? "STALE" : "OFFLINE", C, CY + 22, 7, "#ffffff", 1.6, 0.55);
  } else {
    const msg = usage.status === "nologin" ? "LOGIN" : "ERR";
    s += star(C, CY - 14, 9, t * 0.6, CLAUDE, 0.8);
    s += text(msg, C, CY + 4, 14, "#ffffff", 2.6, 0.8);
  }

  // footer: window label + reset clock time (shrinks to fit long "WED 11:59P")
  const reset = entry && entry.reset ? fmtReset(entry.reset) : "";
  const label = key.mode === "5h" ? "5H" : "7D";
  if (reset) {
    const fh = Math.min(13, (13 * 128) / (textWidth(label, 13) + 9 + textWidth(reset, 13)));
    const lw = textWidth(label, fh), rw = textWidth(reset, fh), gap = 9 * (fh / 13);
    const x0 = C - (lw + gap + rw) / 2;
    s += text(label, x0 + lw / 2, 122, fh, CLAUDE, 2.6);
    s += text(reset, x0 + lw + gap + rw / 2, 122, fh, "#ffffff", 2.6, 0.9);
  } else {
    s += text(label, C, 122, 13, CLAUDE, 2.6);
  }
  if (usage.lastError && usage.data) s += `<circle cx="132" cy="12" r="5" fill="#ff5555" opacity="${(0.5 + 0.5 * breathe).toFixed(2)}"/>`;
  return s + "</svg>";
}

// ---------- Stream Deck / OpenDeck protocol ----------
const keys = new Map(); // context -> { mode, shown, downAt }
let ws;

function send(obj) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function onMessage(msg) {
  const { event, context, payload } = msg;
  if (event === "willAppear") {
    const mode = payload?.settings?.mode === "7d" ? "7d" : "5h";
    keys.set(context, { mode, shown: 0, downAt: 0 });
    send({ event: "setTitle", context, payload: { title: "", target: 0 } });
  } else if (event === "willDisappear") {
    keys.delete(context);
  } else if (event === "keyDown") {
    const k = keys.get(context);
    if (k) k.downAt = Date.now();
  } else if (event === "keyUp") {
    const k = keys.get(context);
    if (!k) return;
    if (Date.now() - k.downAt >= HOLD_MS) {
      usage.flashUntil = Date.now() + 400;
      usage.nextPoll = 0;
    } else {
      k.mode = k.mode === "5h" ? "7d" : "5h";
      k.shown = 0; // re-sweep the ring for the new window
      send({ event: "setSettings", context, payload: { mode: k.mode } });
    }
  } else if (event === "didReceiveSettings") {
    const k = keys.get(context);
    if (k && payload?.settings?.mode) k.mode = payload.settings.mode === "7d" ? "7d" : "5h";
  }
}

function connect() {
  ws = new WebSocket(`ws://127.0.0.1:${args.port}`);
  ws.onopen = () => send({ event: args.registerEvent, uuid: args.pluginUUID });
  ws.onmessage = (e) => {
    try { onMessage(JSON.parse(e.data)); } catch {}
  };
  ws.onclose = () => process.exit(0);
}

let polling = false;
const t0 = Date.now();
function frame() {
  const now = Date.now();
  if (!polling && now >= usage.nextPoll && keys.size) {
    polling = true;
    poll().finally(() => (polling = false));
  }
  const t = (now - t0) / 1000;
  for (const [context, key] of keys) {
    const svg = render(key, t);
    send({ event: "setImage", context, payload: { image: "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64"), target: 0 } });
  }
}

if (args.preview) {
  // node plugin.js --preview <outdir> : write sample frames, no network
  const out = args.preview;
  fs.mkdirSync(out, { recursive: true });
  const samples = [
    ["low", "5h", { pct: 23, reset: Date.now() + 134 * 60000 }],
    ["mid", "5h", { pct: 64, reset: Date.now() + 52 * 60000 }],
    ["high", "7d", { pct: 87, reset: Date.now() + 3.2 * 86400000 }],
    ["danger", "5h", { pct: 96, reset: Date.now() + 18 * 60000 }],
    ["grass", "5h", { pct: 100, reset: Date.now() + 74 * 60000 }],
  ];
  for (const [name, mode, e] of samples) {
    usage.status = "ok";
    usage.data = { "5h": e, "7d": e };
    fs.writeFileSync(path.join(out, `${name}.svg`), render({ mode, shown: e.pct }, 1.3));
  }
  usage.data = null;
  usage.status = "loading";
  fs.writeFileSync(path.join(out, "loading.svg"), render({ mode: "5h", shown: 0 }, 0.4));
  usage.status = "nologin";
  fs.writeFileSync(path.join(out, "nologin.svg"), render({ mode: "5h", shown: 0 }, 0.4));
} else {
  connect();
  setInterval(frame, FRAME_MS);
}
