// Hero: "The Signature Line" (roteiro p.2 + ROTEIRO-DE-MONTAGEM).
//
// One smoothed scroll value drives everything, so the scene is a pure function of the scroll
// position and runs backwards as cleanly as forwards:
//   0–20 %  presence   the client in profile, headline and Book appointment; a light runs
//                      along the fade
//   20–40 % the line   a silver line traces the fade while the camera moves in, then a match
//                      cut turns the hairline into the lit edge of the razor (macro)
//   40–60 % the edge   the camera pulls back from the edge to the open razor; blade, support
//                      and handle separate on one axis
//   60–80 % the signature  the parts realign, the razor closes and swings into the O of the
//                      monogram; the final portrait appears in an oval inside the O
//   80–100% the result the oval opens and the portrait becomes the first card of
//                      "Find your signature"; after the pin, it settles into the gallery.
//
// Every layer is placed with a 2D similarity (scale, in-plane angle, offset) from its own
// pixels to the screen; razor.json (scripts/register-razor.py) says how the layers fit.
//
// Modes (picked in index.html before first paint, kept in sync here):
//   scroll  – desktop: sticky stage over ~2 extra screens
//   compact – small screens: shorter track, own framing (hero-mobile)
//   static  – prefers-reduced-motion: no pin; the final portrait is simply in the gallery
import razor from '../data/razor.json';
import { media, lerp, range, smooth, easeInOut, windowed } from './state.js';

const IMG = import.meta.glob('../assets/img/*.webp', { eager: true, query: '?url', import: 'default' });
const url = (name) => IMG[`../assets/img/${name}.webp`];

// Scroll script, in fractions of the pinned distance.
const T = {
  sheen: [0.02, 0.16], // a light runs along the fade
  intro: [0.08, 0.17], // headline and intro step aside
  draw: [0.18, 0.3], // the silver line traces the fade
  push: [0.18, 0.4], // the camera moves in on the line
  cut: [0.36, 0.42], // match cut: photo -> macro, hairline -> edge
  macroPush: [0.4, 0.48],
  lineOut: [0.44, 0.5], // the line runs off along the edge
  razorIn: [0.497, 0.52], // only once the razor is near its own resolution (it starts at ~3.5x)
  pullBack: [0.46, 0.57], // macro -> the whole open razor
  macroOut: [0.5, 0.526],
  toParts: [0.54, 0.57],
  open: [0.555, 0.63],
  close: [0.635, 0.69],
  toOpen: [0.67, 0.7],
  toClosed: [0.7, 0.74],
  swing: [0.72, 0.82], // the closed razor swings into the O
  razorOut: [0.78, 0.82],
  monoIn: [0.77, 0.82],
  ring: [0.76, 0.84],
  oval: [0.8, 0.87], // the portrait appears inside the O
  monoOut: [0.88, 0.94],
  expand: [0.87, 0.95], // the oval opens to the whole frame …
  shrink: [0.86, 0.97], // … while the portrait becomes a card
  cardFill: [0.88, 0.95],
  frame: [0.9, 0.97],
  steps: [
    [0.17, 0.21, 0.36, 0.4],
    [0.4, 0.44, 0.5, 0.54],
    [0.55, 0.59, 0.68, 0.72],
  ],
  final: [0.88, 0.96],
};

// Geometry in fractions of the stage (W × H).
const LAYOUT = {
  scroll: {
    focus: { x: 0.2, y: 0.4 }, // keeps the client clear of the headline
    match: { x: 0.6, y: 0.5, angle: -8 }, // where the fade line and the edge meet; degrees on screen
    zoom: 2.1, // photo scale at the match cut, × its cover scale
    macroPush: 1.07,
    razor: { x: 0.62, y: 0.53, len: 0.5, maxH: 0.6, rot: 0 }, // open razor: box width × W, capped × H
    mono: { h: 0.62 }, // O height × H, centred on the head's place in the card
    gain: 1.12, // separation, × the spacing of navalha-explodida.png
  },
  compact: {
    focus: { x: 0.5, y: 0.6 },
    match: { x: 0.5, y: 0.4, angle: -8 },
    zoom: 2.0,
    macroPush: 1.07,
    razor: { x: 0.5, y: 0.38, len: 0.84, maxH: 0.34, rot: 0 },
    mono: { h: 0.4 },
    gain: 1.12,
  },
};

// per-frame catch-up of the scrubbed scroll position (`?nosmooth` turns it off, for captures)
const SMOOTH = new URLSearchParams(location.search).has('nosmooth') ? 1 : 0.14;
const deg = Math.PI / 180;
const root = document.documentElement;

// ---------- 2D similarities: p' = (x, y) + s·R(r)·p ----------
const sim = (s, r, x, y) => ({ s, r, x, y });
const apply = (A, [px, py]) => [A.x + A.s * (Math.cos(A.r) * px - Math.sin(A.r) * py), A.y + A.s * (Math.sin(A.r) * px + Math.cos(A.r) * py)];
const compose = (A, B) => {
  const [x, y] = apply(A, [B.x, B.y]);
  return sim(A.s * B.s, A.r + B.r, x, y);
};
const invert = (A) => {
  const s = 1 / A.s;
  const c = Math.cos(-A.r);
  const n = Math.sin(-A.r);
  return sim(s, -A.r, -s * (c * A.x - n * A.y), -s * (n * A.x + c * A.y));
};
// the similarity that puts local point q on screen point C
const placeAt = (s, r, q, C) => {
  const [qx, qy] = apply(sim(s, r, 0, 0), q);
  return sim(s, r, C[0] - qx, C[1] - qy);
};
// the similarity taking a1 -> b1 and a2 -> b2
const fromPairs = (a1, a2, b1, b2) => {
  const s = Math.hypot(b2[0] - b1[0], b2[1] - b1[1]) / Math.hypot(a2[0] - a1[0], a2[1] - a1[1]);
  const r = Math.atan2(b2[1] - b1[1], b2[0] - b1[0]) - Math.atan2(a2[1] - a1[1], a2[0] - a1[0]);
  return placeAt(s, r, a1, b1);
};
// blend two placements of one layer; its point `q` travels in a straight line, scale is eased in log space
const mix = (A, B, t, q) => {
  if (t <= 0) return A;
  if (t >= 1) return B;
  const s = Math.exp(lerp(Math.log(A.s), Math.log(B.s), t));
  const r = A.r + Math.atan2(Math.sin(B.r - A.r), Math.cos(B.r - A.r)) * t;
  const pa = apply(A, q);
  const pb = apply(B, q);
  return placeAt(s, r, q, [lerp(pa[0], pb[0], t), lerp(pa[1], pb[1], t)]);
};
const matrix = (A) => {
  const a = A.s * Math.cos(A.r);
  const b = A.s * Math.sin(A.r);
  return `matrix(${a.toFixed(5)}, ${b.toFixed(5)}, ${(-b).toFixed(5)}, ${a.toFixed(5)}, ${A.x.toFixed(2)}, ${A.y.toFixed(2)})`;
};

// ---------- polylines ----------
// Catmull-Rom through measured points, n samples
function spline(points, n) {
  const out = [];
  const segs = points.length - 1;
  for (let i = 0; i < n; i++) {
    const u = (i / (n - 1)) * segs;
    const k = Math.min(segs - 1, Math.floor(u));
    const t = u - k;
    const p0 = points[Math.max(0, k - 1)];
    const p1 = points[k];
    const p2 = points[k + 1];
    const p3 = points[Math.min(segs, k + 2)];
    const t2 = t * t;
    const t3 = t2 * t;
    out.push([0, 1].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
  }
  return out;
}
const lengths = (poly) => {
  const acc = [0];
  for (let i = 1; i < poly.length; i++) acc.push(acc[i - 1] + Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]));
  return acc;
};
function at(poly, acc, l) {
  const L = Math.min(Math.max(l, 0), acc[acc.length - 1]);
  let i = 1;
  while (i < acc.length - 1 && acc[i] < L) i++;
  const f = (L - acc[i - 1]) / (acc[i] - acc[i - 1] || 1);
  return [lerp(poly[i - 1][0], poly[i][0], f), lerp(poly[i - 1][1], poly[i][1], f)];
}
// n evenly spaced points between arc lengths l0 and l1
function slice(poly, l0, l1, n) {
  const acc = lengths(poly);
  return Array.from({ length: n }, (_, i) => at(poly, acc, lerp(l0, l1, i / (n - 1))));
}

const N = 48; // samples on the line
const OPEN = razor.open;
const OPEN_BOX = OPEN.box;
const OPEN_CENTRE = [(OPEN_BOX[0] + OPEN_BOX[2]) / 2, (OPEN_BOX[1] + OPEN_BOX[3]) / 2];
const ACROSS = razor.across;
const MONO = razor.mono;
const MONO_LOCAL = (p) => [p[0] - MONO.box[0], p[1] - MONO.box[1]];
const COUNTER = MONO_LOCAL([MONO.counter.cx, MONO.counter.cy]);
const PORTRAIT = razor.portrait;
const HEAD = [PORTRAIT.head.cx, PORTRAIT.head.cy];
const MACRO = razor.macro;
const EDGE = spline(MACRO.edge, N);
const EDGE_ACC = lengths(EDGE);
// macro px -> razor canvas px: the blade's end and the pivot on both
const Q = fromPairs(MACRO.tip, MACRO.pivot, OPEN.tip, OPEN.pivot);

// a layer's own pixels (its alpha box) -> razor canvas, from a pose (centre, angle, scale)
function poseSim(p) {
  const w = p.box[2] - p.box[0];
  const h = p.box[3] - p.box[1];
  return placeAt(p.scale, p.rot * deg, [w / 2, h / 2], [p.x, p.y]);
}

export function initHero() {
  const track = document.querySelector('[data-hero-track]');
  const stage = document.querySelector('[data-stage]');
  if (!track || !stage) return;

  const el = {
    ambient: stage.querySelector('[data-ambient]'),
    photo: stage.querySelector('[data-photo]'),
    frame: stage.querySelector('[data-photo-frame]'),
    sheen: stage.querySelector('[data-sheen]'),
    macro: stage.querySelector('[data-macro]'),
    line: stage.querySelector('[data-line]'),
    linePath: stage.querySelector('[data-line] path'),
    razor: stage.querySelector('[data-razor]'),
    open: stage.querySelector('[data-rz="open"]'),
    closed: stage.querySelector('[data-rz="closed"]'),
    parts: {
      handle: stage.querySelector('[data-rz="handle"]'),
      support: stage.querySelector('[data-rz="support"]'),
      blade: stage.querySelector('[data-rz="blade"]'),
    },
    mono: stage.querySelector('[data-mono]'),
    mover: stage.querySelector('[data-card-mover]'),
    cardPhoto: stage.querySelector('[data-card-photo]'),
    cutout: stage.querySelector('[data-card-cutout]'),
    title: stage.querySelector('#hero-title'),
    eyebrow: stage.querySelector('.hero-eyebrow'),
    intro: stage.querySelector('[data-hero-intro]'),
    steps: [...stage.querySelectorAll('[data-step]')],
    final: stage.querySelector('[data-hero-final]'),
    bar: stage.querySelector('[data-progress-bar]'),
    cue: stage.querySelector('[data-cue]'),
    slot: document.querySelector('[data-look-slot]'),
  };

  // ---------- razor layers: fixed canvas, poses from register-razor.py ----------
  const partSim = {};
  let closedSim;
  function placeLayers() {
    el.razor.style.width = `${razor.canvas.width}px`;
    el.razor.style.height = `${razor.canvas.height}px`;
    const [x0, y0, x1, y1] = OPEN_BOX;
    Object.assign(el.open.style, { left: `${x0}px`, top: `${y0}px`, width: `${x1 - x0}px`, height: `${y1 - y0}px` });
    for (const [name, img] of Object.entries(el.parts)) {
      const p = razor.parts[name];
      img.style.width = `${p.box[2] - p.box[0]}px`;
      img.style.height = `${p.box[3] - p.box[1]}px`;
      partSim[name] = poseSim(p);
    }
    const c = razor.closed;
    el.closed.style.width = `${c.box[2] - c.box[0]}px`;
    el.closed.style.height = `${c.box[3] - c.box[1]}px`;
    closedSim = poseSim(c);
    el.closed.style.transform = matrix(closedSim);
    el.mono.style.width = `${MONO.box[2] - MONO.box[0]}px`;
    el.mono.style.height = `${MONO.box[3] - MONO.box[1]}px`;
    el.mover.style.width = `${PORTRAIT.width}px`;
    el.mover.style.height = `${PORTRAIT.height}px`;
  }

  function loadScene() {
    el.ambient.srcset = `${url('graphite-960')} 960w, ${url('graphite-1672')} 1672w`;
    el.ambient.sizes = '100vw';
    el.ambient.src = url('graphite-1672');
    el.macro.srcset = `${url('macro-1000')} 1000w, ${url('macro-1672')} 1672w`;
    el.macro.sizes = '160vw';
    el.macro.src = url('macro-1672');
    el.open.srcset = `${url('razor-open-760')} 760w, ${url(`razor-open-${OPEN_BOX[2] - OPEN_BOX[0]}`)} ${OPEN_BOX[2] - OPEN_BOX[0]}w`;
    el.open.sizes = '(min-width: 900px) 60vw, 100vw';
    el.open.src = url(`razor-open-${OPEN_BOX[2] - OPEN_BOX[0]}`);
    const cw = razor.closed.box[2] - razor.closed.box[0];
    el.closed.srcset = `${url('razor-closed-760')} 760w, ${url(`razor-closed-${cw}`)} ${cw}w`;
    el.closed.sizes = '(min-width: 900px) 50vw, 90vw';
    el.closed.src = url(`razor-closed-${cw}`);
    for (const [name, img] of Object.entries(el.parts)) {
      const w = razor.parts[name].box[2] - razor.parts[name].box[0];
      img.srcset = `${url(`razor-${name}-640`)} 640w, ${url(`razor-${name}-${w}`)} ${w}w`;
      img.sizes = '(min-width: 900px) 50vw, 90vw';
      img.src = url(`razor-${name}-${w}`);
    }
    el.cutout.srcset = `${url('portrait-cutout-720')} 720w, ${url('portrait-cutout-1086')} 1086w`;
    el.cutout.sizes = '(min-width: 900px) 50vw, 100vw';
    el.cutout.src = url('portrait-cutout-1086');
    el.cardPhoto.srcset = `${url('look-signature-fade-640')} 640w, ${url('look-signature-fade-1086')} 1086w`;
    el.cardPhoto.sizes = '(min-width: 900px) 36vw, 92vw';
    el.cardPhoto.src = url('look-signature-fade-1086');
  }

  // ---------- state ----------
  let mode = '';
  let L = LAYOUT.scroll;
  let W = 1;
  let H = 1;
  let G = {};
  let sy = window.scrollY;
  let target = sy;
  let raf = 0;
  let docked = null;

  function currentMode() {
    if (media.reduced.matches) return 'static';
    return media.wide.matches ? 'scroll' : 'compact';
  }

  // smallest scale at which a w × h image, turned by r with its point q on screen point C, covers the stage
  function coverScale(w, h, q, r, C) {
    let s = 0;
    const c = Math.cos(-r);
    const n = Math.sin(-r);
    for (const [X, Y] of [[0, 0], [W, 0], [0, H], [W, H]]) {
      const dx = X - C[0];
      const dy = Y - C[1];
      const u = c * dx - n * dy;
      const v = n * dx + c * dy;
      s = Math.max(s, u > 0 ? u / (w - q[0]) : u / -q[0], v > 0 ? v / (h - q[1]) : v / -q[1]);
    }
    return s;
  }

  // ---------- measuring ----------
  function measure() {
    W = stage.clientWidth || window.innerWidth;
    H = stage.clientHeight || window.innerHeight;
    const F = razor.fade[media.narrow.matches ? 'mobile' : 'desktop'];
    el.frame.style.width = `${F.width}px`;
    el.frame.style.height = `${F.height}px`;

    // the photo, cover-fitted with the layout's focus point
    const k0 = Math.max(W / F.width, H / F.height);
    const photo0 = sim(k0, 0, (W - F.width * k0) * L.focus.x, (H - F.height * k0) * L.focus.y);

    // the fade line (photo px) and where it meets the edge of the macro
    const fade = spline(F.points, N);
    const fa = F.points[0];
    const fb = F.points[F.points.length - 1];
    const mid = [(fa[0] + fb[0]) / 2, (fa[1] + fb[1]) / 2];
    const C = [L.match.x * W, L.match.y * H];
    const phi = L.match.angle * deg;
    const rp = phi - Math.atan2(fb[1] - fa[1], fb[0] - fa[0]);
    const kp = Math.max(k0 * L.zoom, coverScale(F.width, F.height, mid, rp, C));
    const photoMatch = placeAt(kp, rp, mid, C);

    // the macro: its edge on the same screen line, the whole frame covered
    const eA = EDGE[0];
    const eB = EDGE[N - 1];
    const lA = EDGE_ACC[N - 1] * 0.45;
    const qa = at(EDGE, EDGE_ACC, lA);
    const rm = phi - Math.atan2(eB[1] - eA[1], eB[0] - eA[0]);
    const km = coverScale(MACRO.width, MACRO.height, qa, rm, C) * 1.03;
    const macroMatch = placeAt(km, rm, qa, C);
    const macroEnd = placeAt(km * L.macroPush, rm, qa, C);
    // the stretch of the edge the fade line lands on: same screen length, centred on qa
    const chord = Math.hypot(fb[0] - fa[0], fb[1] - fa[1]) * kp;
    const edge = slice(EDGE, lA - chord / (2 * km), lA + chord / (2 * km), N);

    // the razor: from the macro's framing to a product shot
    const razorMatch = compose(macroEnd, invert(Q));
    const bw = OPEN_BOX[2] - OPEN_BOX[0];
    const bh = OPEN_BOX[3] - OPEN_BOX[1];
    const sProd = Math.min((L.razor.len * W) / bw, (L.razor.maxH * H) / bh);
    const razorProd = placeAt(sProd, L.razor.rot * deg, OPEN_CENTRE, [L.razor.x * W, L.razor.y * H]);

    // the card it all ends in: same size as the first gallery card
    const header = document.querySelector('[data-header]')?.offsetHeight || 72;
    const trackTop = track.getBoundingClientRect().top + window.scrollY;
    const S0 = trackTop + track.offsetHeight - H; // the pin releases here
    let card = { w: W * 0.34, h: W * 0.34 * (PORTRAIT.height / PORTRAIT.width), left: W * 0.06, top: header + 24 };
    let dock = null;
    if (el.slot) {
      const r = el.slot.getBoundingClientRect();
      // phones: right under the header, so the closing caption and buttons fit below the card
      const top = mode === 'compact' ? header + 16 : Math.max(header + 24, (H - r.height) / 2 + 16);
      card = { w: r.width, h: r.height, left: r.left + window.scrollX, top };
      const slotTop = r.top + window.scrollY;
      // done once the slot sits where the card is, or as soon as it is fully in view
      const S1 = Math.max(S0 + H * 0.3, slotTop - top);
      dock = { S0, S1, to: { left: r.left + window.scrollX, top: slotTop - S0 } };
      // a jump to the gallery (nav link, #looks) lands exactly where the card has docked
      const section = el.slot.closest('section');
      if (section) section.style.scrollMarginTop = `${Math.max(0, Math.floor(section.getBoundingClientRect().top + window.scrollY - S1))}px`;
    }
    const sc = card.w / PORTRAIT.width;
    const cardSim = sim(sc, 0, card.left, card.top);

    // the O, with its counter on the head's place in the card (kept clear of the header)
    const mh = MONO.box[3] - MONO.box[1];
    const ms = (L.mono.h * H) / mh;
    const head = apply(cardSim, HEAD);
    const mc = [head[0], Math.min(Math.max(head[1], header + 12 + COUNTER[1] * ms), H - 12 - (mh - COUNTER[1]) * ms)];
    const monoSim = placeAt(ms, 0, COUNTER, mc);
    // the closed razor lands on the razor of the monogram: pivot on pivot, handle along the blade
    const razorMono = fromPairs(OPEN.pivot, OPEN.handleEnd, apply(monoSim, MONO_LOCAL(MONO.pivot)), apply(monoSim, MONO_LOCAL(MONO.tip)));

    // the portrait in the oval: the head fills the counter
    const sp = (2 * MONO.counter.ry * ms * 0.98) / PORTRAIT.head.h;
    const bigSim = placeAt(sp, 0, HEAD, mc);
    const rx = (MONO.counter.rx * ms) / sp;
    const ry = (MONO.counter.ry * ms) / sp;
    let cover = 0;
    for (const [x, y] of [[0, 0], [PORTRAIT.width, 0], [0, PORTRAIT.height], [PORTRAIT.width, PORTRAIT.height]]) {
      cover = Math.max(cover, Math.hypot((x - HEAD[0]) / rx, (y - HEAD[1]) / ry));
    }

    G = { photo0, photoMatch, mid, fade, edge, macroMatch, macroEnd, qa, razorMatch, razorProd, razorMono, monoSim, bigSim, cardSim, sc, rx, ry, cover: cover * 1.02, card, dock, trackTop };
  }

  // ---------- render ----------
  const show = (n, v) => {
    n.style.opacity = v;
    n.style.visibility = v <= 0 ? 'hidden' : 'visible';
  };
  const toPath = (pts) => (pts.length < 2 ? '' : `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}`);

  function render() {
    const scrollable = track.offsetHeight - H;
    const p = scrollable > 0 ? Math.min(1, Math.max(0, (sy - G.trackTop) / scrollable)) : 0;

    // photo: the camera moves in on the fade line, then hands over to the macro
    const ep = easeInOut(range(p, ...T.push));
    const photo = mix(G.photo0, G.photoMatch, ep, G.mid);
    el.frame.style.transform = matrix(photo);
    const cut = easeInOut(range(p, ...T.cut));
    show(el.photo, 1 - cut);

    // a light runs along the fade
    const st = range(p, ...T.sheen);
    const sp = apply(photo, at(G.fade, lengths(G.fade), st * lengths(G.fade)[N - 1]));
    el.sheen.style.transform = `translate3d(${sp[0].toFixed(1)}px, ${sp[1].toFixed(1)}px, 0)`;
    el.sheen.style.opacity = st > 0 && st < 1 ? Math.sin(st * Math.PI) : 0;

    // macro: in on the cut, a slow push, then it follows the razor while it fades
    const pull = easeInOut(range(p, ...T.pullBack));
    const g0 = mix(G.razorMatch, G.razorProd, pull, OPEN_CENTRE);
    let macro = mix(G.macroMatch, G.macroEnd, easeInOut(range(p, ...T.macroPush)), G.qa);
    if (pull > 0) macro = compose(g0, Q);
    el.macro.style.transform = matrix(macro);
    show(el.macro, cut * (1 - smooth(range(p, ...T.macroOut))));

    // the silver line: drawn along the fade, morphed onto the edge, then runs off along it
    const d = range(p, ...T.draw);
    const onPhoto = G.fade.map((q) => apply(photo, q));
    const onEdge = G.edge.map((q) => apply(macro, q));
    let pts = cut > 0 ? onPhoto.map((a, i) => [lerp(a[0], onEdge[i][0], cut), lerp(a[1], onEdge[i][1], cut)]) : onPhoto;
    const off = easeInOut(range(p, ...T.lineOut));
    const from = Math.floor(off * (N - 1));
    const to = Math.max(from, Math.ceil(d * (N - 1)));
    pts = pts.slice(from, to + 1);
    if (pts.length >= 2 && d < 1) {
      // partial last segment while drawing
      const f = d * (N - 1) - (to - 1);
      const a = pts[pts.length - 2];
      const b = pts[pts.length - 1];
      pts[pts.length - 1] = [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
    }
    el.linePath.setAttribute('d', toPath(pts));
    show(el.line, d > 0 && off < 1 ? 1 - smooth(range(off, 0.6, 1)) : 0);

    // razor group: from the macro's framing to the product shot, then into the O
    const swing = easeInOut(range(p, ...T.swing));
    const group = swing > 0 ? mix(G.razorProd, G.razorMono, swing, OPEN.pivot) : g0;
    el.razor.style.transform = matrix(group);
    const razorAlpha = smooth(range(p, ...T.razorIn)) * (1 - smooth(range(p, ...T.razorOut)));
    show(el.razor, razorAlpha);

    // open razor -> parts -> open razor -> closed razor
    const partsOn = smooth(range(p, ...T.toParts)) * (1 - smooth(range(p, ...T.toOpen)));
    const closedOn = smooth(range(p, ...T.toClosed));
    el.open.style.opacity = (1 - partsOn) * (1 - closedOn);
    el.closed.style.opacity = closedOn;
    const opened = easeInOut(range(p, ...T.open)) * (1 - easeInOut(range(p, ...T.close)));
    for (const [name, img] of Object.entries(el.parts)) {
      const k = razor.parts[name].spread * L.gain * opened;
      const ps = partSim[name];
      img.style.transform = matrix(sim(ps.s, ps.r, ps.x + ACROSS[0] * k, ps.y + ACROSS[1] * k));
      img.style.opacity = partsOn;
    }

    // the O monogram: the ring is drawn round from the razor, then it steps back
    el.mono.style.transform = matrix(G.monoSim);
    show(el.mono, smooth(range(p, ...T.monoIn)) * (1 - smooth(range(p, ...T.monoOut))));
    el.mono.style.setProperty('--sweep', `${(easeInOut(range(p, ...T.ring)) * 360).toFixed(1)}deg`);

    // the final portrait: an oval inside the O, opening to the frame while it becomes a card
    const ov = easeInOut(range(p, ...T.oval));
    const ex = easeInOut(range(p, ...T.expand));
    // the oval opens from a third of the counter, fading in, rather than from a point
    const f = lerp(0.35, 1, ov) * lerp(1, G.cover, ex);
    const shrinkT = easeInOut(range(p, ...T.shrink));
    let card = mix(G.bigSim, G.cardSim, shrinkT, [0, 0]);
    const dockT = G.dock ? range(sy, G.dock.S0, G.dock.S1) : 0;
    if (dockT > 0 && G.dock) {
      // linear on purpose: the card then stays still on screen while the gallery rises to meet it
      card = sim(G.sc, 0, lerp(G.card.left, G.dock.to.left, dockT), lerp(G.card.top, G.dock.to.top, dockT));
    }
    el.mover.style.transform = matrix(card);
    el.mover.style.clipPath = ex >= 1 ? 'none' : `ellipse(${(G.rx * f).toFixed(1)}px ${(G.ry * f).toFixed(1)}px at ${HEAD[0]}px ${HEAD[1]}px)`;
    el.mover.style.visibility = ov <= 0 || dockT >= 1 ? 'hidden' : 'visible';
    el.mover.style.opacity = smooth(range(ov, 0, 0.35)).toFixed(3);
    el.mover.style.setProperty('--fill', smooth(range(p, ...T.frame)).toFixed(3));
    el.mover.style.setProperty('--bw', `${(1.5 / card.s).toFixed(2)}px`);
    el.cardPhoto.style.opacity = smooth(range(p, ...T.cardFill));
    const isDocked = dockT >= 1;
    if (isDocked !== docked) {
      docked = isDocked;
      el.slot?.classList.toggle('is-docked', isDocked);
    }

    // copy: the text keeps its place; it only fades
    const io = range(p, ...T.intro);
    show(el.intro, 1 - io);
    show(el.title, 1 - io);
    show(el.eyebrow, 1 - io);
    el.steps.forEach((step, i) => {
      const v = windowed(p, ...T.steps[i]);
      show(step, v);
      step.style.transform = `translate3d(0, ${(1 - v) * 14}px, 0)`;
    });
    // gone before the rising stage carries it over the waiting card (phones)
    const fv = range(p, ...T.final) * (1 - range(dockT, 0, 0.12));
    show(el.final, fv);
    el.final.classList.toggle('is-live', fv > 0.6);
    el.bar.style.transform = `scaleX(${p})`;
    el.bar.parentElement.style.opacity = 1 - range(dockT, 0, 0.12);
    el.cue.style.opacity = 1 - range(p, 0, 0.04);
  }

  // ---------- loop ----------
  function frame() {
    raf = 0;
    const diff = target - sy;
    // long jumps (anchor links, hash on arrival) land at once instead of crawling through the scene
    sy = Math.abs(diff) < 0.5 || Math.abs(diff) > H * 1.5 ? target : sy + diff * SMOOTH;
    render();
    if (sy !== target) raf = requestAnimationFrame(frame);
  }
  function kick() {
    if (!raf && mode !== 'static') raf = requestAnimationFrame(frame);
  }

  // ---------- modes ----------
  const STYLED = () => [
    el.ambient, el.photo, el.frame, el.sheen, el.macro, el.line, el.razor, el.open, el.closed, ...Object.values(el.parts),
    el.mono, el.mover, el.cardPhoto, el.title, el.eyebrow, el.intro, el.final, el.bar, el.bar.parentElement, el.cue,
    ...el.steps,
  ];
  function setMode(next) {
    if (next === mode) return;
    mode = next;
    root.classList.remove('hero-scroll', 'hero-compact', 'hero-static');
    root.classList.add(`hero-${mode}`);
    root.classList.toggle('motion-ok', !media.reduced.matches);
    STYLED().forEach((n) => n?.removeAttribute('style'));
    el.slot?.classList.remove('is-docked');
    el.slot?.closest('section')?.style.removeProperty('scroll-margin-top');
    docked = null;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (mode === 'static') {
      root.classList.remove('hero-live');
      return;
    }
    L = LAYOUT[mode];
    root.classList.add('hero-live'); // hidden-until-animated states only apply from here
    placeLayers();
    loadScene();
    refresh();
  }
  function refresh() {
    if (mode === 'static') return;
    measure();
    target = sy = window.scrollY;
    render();
  }

  setMode(currentMode());

  window.addEventListener(
    'scroll',
    () => {
      target = window.scrollY;
      kick();
    },
    { passive: true },
  );
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const next = currentMode();
      if (next !== mode) setMode(next);
      else refresh();
    }, 120);
  });
  media.reduced.addEventListener?.('change', () => setMode(currentMode()));
  media.wide.addEventListener?.('change', () => setMode(currentMode()));
  window.addEventListener('load', refresh, { once: true });
  document.fonts?.ready.then(refresh);
  const content = document.querySelector('[data-content]');
  if (content && 'ResizeObserver' in window) {
    let last = 0;
    new ResizeObserver(() => {
      const h = content.offsetHeight;
      if (Math.abs(h - last) > 2) {
        last = h;
        refresh();
      }
    }).observe(content);
  }
}
