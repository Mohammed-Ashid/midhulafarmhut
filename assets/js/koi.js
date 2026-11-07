/* ==========================================================================
   Koi — procedural, physically-steered fish.
   Body is a follow-the-leader spine with a travelling swim wave; fins and
   tail lag behind it. Behaviour: wander, loose schooling, wall avoidance,
   curiosity toward a resting cursor, fleeing fast movement, chasing food.
   ========================================================================== */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const wrap = (a) => {
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a;
  };

  // Top-down body width profile (s along body 0 = nose, 1 = tail root)
  const PROFILE = [
    [0.0, 0.16], [0.03, 0.44], [0.07, 0.65], [0.12, 0.8], [0.2, 0.92],
    [0.3, 0.99], [0.38, 1.0], [0.48, 0.95], [0.6, 0.8], [0.71, 0.6],
    [0.81, 0.41], [0.9, 0.27], [1.0, 0.19],
  ];
  const KOI_PROF=[0.42,0.62,0.75,0.84,0.91,0.96,0.99,1.0,0.97,0.92,0.84,0.74,0.62,0.5,0.39,0.3,0.23,0.19];
  function widthAt(s) {
    for (let i = 1; i < PROFILE.length; i++) {
      if (s <= PROFILE[i][0]) {
        const [s0, w0] = PROFILE[i - 1];
        const [s1, w1] = PROFILE[i];
        const t = (s - s0) / (s1 - s0);
        return lerp(w0, w1, 0.5 - 0.5 * Math.cos(t * Math.PI));
      }
    }
    return PROFILE[PROFILE.length - 1][1];
  }

  const C = {
    white: '#f2ede4',
    cream: '#f5efe2',
    red: '#d3381e',
    red2: '#c42c17',
    orange: '#e8672a',
    black: '#141518',
    gold: '#e3a838',
    plat: '#e5e6e3',
    blue: '#9aaebe',
  };

  function hexToRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function shade(hex, f) {
    const [r, g, b] = hexToRgb(hex);
    const m = (c) => Math.round(clamp(f < 0 ? c * (1 + f) : c + (255 - c) * f, 0, 255));
    return `rgb(${m(r)},${m(g)},${m(b)})`;
  }

  /* ---------------- Varieties ---------------- */

  function patch(blobs, s, len, o, width, color) {
    const n = 3 + Math.floor(len * 26);
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      blobs.push({
        s: s + (t - 0.5) * len + rand(-0.015, 0.015),
        o: o + rand(-0.22, 0.22),
        rs: rand(0.04, 0.07),
        rw: width * rand(0.6, 0.9),
        c: color,
      });
    }
  }

  function bodyPatches(blobs, color, count, wMin, wMax) {
    let s = rand(0.2, 0.3);
    for (let i = 0; i < count && s < 0.82; i++) {
      const len = rand(0.08, 0.2);
      patch(blobs, s + len / 2, len, rand(-0.3, 0.3), rand(wMin, wMax), color);
      s += len + rand(0.04, 0.12);
    }
  }

  function reticulation(blobs, color, rows) {
    let k = 0;
    for (let s = 0.14; s < 0.86; s += 0.034) {
      const shift = (k++ % 2) * 0.5;
      for (let j = 0; j < rows; j++) {
        const o = ((j + shift) / (rows - 0.5)) * 1.6 - 0.8;
        if (Math.abs(o) > 0.85) continue;
        blobs.push({ s: s + rand(-0.004, 0.004), o, rs: 0.011, rw: 0.13, c: color });
      }
    }
  }

  function makeVariety(name) {
    const v = { name, base: C.white, metallic: false, fin: [242, 236, 226], finStripe: false, scale: 0.07, blobs: [] };
    const b = v.blobs;
    switch (name) {
      case 'comet':
        v.base = '#e8561e'; v.metallic = true; v.fin = [238, 104, 46]; v.scale = 0.12; break;
      case 'sarasa':
        v.base = '#f4efe6'; v.metallic = true; v.fin = [242, 214, 196]; v.scale = 0.12;
        patch(b, 0.1, 0.12, 0, 1.0, '#dc3f17'); bodyPatches(b, '#dc3f17', 2, 0.9, 1.3); break;
      case 'shubunkin':
        v.base = '#8ea2b6'; v.fin = [150, 166, 186]; v.scale = 0.05;
        for (let i = 0; i < 4; i++) patch(b, rand(0.15, 0.8), rand(0.05, 0.12), rand(-0.6, 0.6), rand(0.5, 0.8), Math.random() < 0.5 ? '#e0662c' : '#a9a2c6');
        for (let i = 0; i < 3; i++) patch(b, rand(0.2, 0.8), rand(0.04, 0.08), rand(-0.5, 0.5), 0.5, '#e8ebe8');
        for (let i = 0; i < 3; i++) patch(b, rand(0.2, 0.85), rand(0.03, 0.07), rand(-0.6, 0.6), 0.45, 'rgba(38,52,86,0.45)');
        for (let i = 0; i < 70; i++) b.push({ s: rand(0.04, 0.97), o: rand(-0.95, 0.95), rs: rand(0.003, 0.008), rw: rand(0.035, 0.08), c: `rgba(20,22,32,${rand(0.45, 0.85).toFixed(2)})` });
        break;
      case 'ryukin':
        v.base = '#f4efe6'; v.metallic = true; v.fin = [244, 222, 208]; v.scale = 0.14;
        patch(b, 0.12, 0.14, 0, 1.0, '#d8401b'); patch(b, 0.55, 0.3, 0.1, 1.2, '#d8401b'); break;
      case 'redcap':
        v.base = '#f5f2ec'; v.metallic = true; v.fin = [246, 242, 236]; v.scale = 0.12; break;
      case 'kohaku':
        if (Math.random() < 0.75) patch(b, rand(0.07, 0.1), rand(0.05, 0.09), rand(-0.12, 0.12), 0.85, C.red);
        bodyPatches(b, C.red, 1 + Math.floor(rand(1, 3.5)), 0.75, 1.15);
        break;
      case 'sanke':
        if (Math.random() < 0.8) patch(b, 0.08, 0.07, rand(-0.1, 0.1), 0.85, C.red2);
        bodyPatches(b, C.red2, 2, 0.7, 1.05);
        for (let i = 0, n = 4 + Math.floor(Math.random() * 6); i < n; i++) {
          b.push({ s: rand(0.24, 0.84), o: rand(-0.65, 0.65), rs: rand(0.014, 0.034), rw: rand(0.13, 0.32), c: C.black });
        }
        v.finStripe = true;
        break;
      case 'showa':
        v.base = C.black;
        v.fin = [40, 40, 44];
        v.finStripe = true;
        patch(b, 0.08, 0.08, rand(-0.15, 0.15), 0.9, C.red);
        bodyPatches(b, C.red, 2, 0.75, 1.1);
        for (let i = 0; i < 3; i++) patch(b, rand(0.25, 0.8), rand(0.05, 0.1), rand(-0.6, 0.6), 0.55, C.white);
        b.push({ s: 0.02, o: 0, rs: 0.03, rw: 0.45, c: C.white });
        break;
      case 'tancho':
        b.push({ s: 0.085, o: rand(-0.05, 0.05), rs: 0.058, rw: 0.47, c: C.red });
        break;
      case 'ogon':
        v.base = C.gold;
        v.metallic = true;
        v.fin = [236, 176, 66];
        v.scale = 0.16;
        break;
      case 'platinum':
        v.base = C.plat;
        v.metallic = true;
        v.fin = [238, 238, 234];
        v.scale = 0.14;
        break;
      case 'orange':
        v.base = C.orange;
        v.metallic = true;
        v.fin = [240, 128, 58];
        v.scale = 0.14;
        break;
      case 'goshiki':
        patch(b, 0.08, 0.06, 0, 0.8, C.red);
        bodyPatches(b, C.red, 2, 0.6, 0.95);
        reticulation(b, 'rgba(58,74,96,0.55)', 6);
        v.scale = 0.12;
        break;
      case 'asagi':
        v.base = C.blue;
        v.fin = [226, 118, 74];
        v.scale = 0.1;
        reticulation(b, 'rgba(48,64,86,0.6)', 6);
        for (let s = 0.12; s < 0.9; s += 0.05) {
          b.push({ s, o: 1.0, rs: 0.06, rw: 0.38, c: C.orange });
          b.push({ s, o: -1.0, rs: 0.06, rw: 0.38, c: C.orange });
        }
        b.push({ s: 0.05, o: 0, rs: 0.05, rw: 0.6, c: '#c9d3da' });
        break;
    }
    return v;
  }

  /* ---------------- Scale texture ---------------- */
  let scaleCanvas = null;
  const patternCache = new WeakMap();
  function getScaleCanvas() {
    if (scaleCanvas) return scaleCanvas;
    const c = document.createElement('canvas');
    const S = 24;
    c.width = S;
    c.height = S;
    const g = c.getContext('2d');
    g.strokeStyle = 'rgba(0,0,0,1)';
    g.lineWidth = 1.4;
    const r = S / 2;
    const arcs = [[0, 0], [S, 0], [r, r], [0, S], [S, S]];
    for (const [x, y] of arcs) {
      g.beginPath();
      g.arc(x, y, r, 0.15 * Math.PI, 0.85 * Math.PI);
      g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = 'rgba(255,255,255,0.0)';
    scaleCanvas = c;
    return c;
  }

  /* ---------------- Species (body plan + motion character) ---------------- */
  const KOI_E = { s: 0.1, lat: 0.97, ra: 0.085, rc: 0.062, bulge: 1.4 };
  const GOLD_PROF = [0.44, 0.66, 0.8, 0.89, 0.95, 0.99, 1.0, 0.98, 0.93, 0.86, 0.77, 0.66, 0.55, 0.44, 0.35, 0.28, 0.22, 0.18];
  const FANCY_PROF = [0.5, 0.72, 0.85, 0.93, 0.98, 1.0, 0.99, 0.96, 0.9, 0.82, 0.72, 0.62, 0.52, 0.44, 0.38, 0.33, 0.3, 0.28];
  const FAN = [[0.05, 0.38], [0.1, 0.85], [0.28, 0.95], [0.45, 0.86], [0.58, 0.72], [0.75, 0.88], [0.98, 0.88], [1.25, 0.66], [1.3, 0.32]];
  const KOI_MOTION = { cruise: [0.32, 0.48], h0: 0.008, h1: 0.075, k: 5.2, f0: 0.75, f1: 1.25, turn: 1.2, accel: 2.6, glide: true };
  const COMET_MOTION = { cruise: [0.55, 0.75], h0: 0.008, h1: 0.085, k: 5.6, f0: 1.0, f1: 1.6, turn: 1.9, accel: 4.0, glide: true, dart: true, wander: 1.4 };
  const FANCY_MOTION = { cruise: [0.16, 0.26], h0: 0.03, h1: 0.05, k: 3.0, f0: 1.6, f1: 0.8, turn: 1.4, accel: 2.0, glide: false, minAmp: 0.5, finHz: 2.2, finFlap: 0.45, finOpen: 1.1, burstMax: 1.0 };
  const SPECIES = {
    koi: { prof: KOI_PROF, capK: 0.85, E: KOI_E, spec: {}, motion: KOI_MOTION },
    butterfly: {
      prof: KOI_PROF, capK: 0.85, E: KOI_E, motion: Object.assign({}, KOI_MOTION, { cruise: [0.28, 0.4] }),
      spec: { bodyFrac: 0.58, w: [0.105, 0.115], TL: 0.52, spread: 0.46, tipA: -0.08, tipR: 1.1, innerA: 0.14, innerR: 0.92, notchR: 0.5, c2R: 0.7, curlK: 1.0, pect: [0.25, 0.26, 0.09], pelv: [0.52, 0.16, 0.05], dorsal: [0.3, 0.72, 0.09] },
    },
    comet: {
      prof: GOLD_PROF, capK: 0.8, E: { s: 0.1, lat: 1.0, ra: 0.1, rc: 0.076, bulge: 1.4 }, motion: COMET_MOTION,
      spec: { bodyFrac: 0.52, w: [0.095, 0.1], TL: 0.46, spread: 0.44, tipA: -0.13, tipR: 1.14, innerA: 0.07, innerR: 0.98, notchR: 0.36, c2R: 0.62, curlK: 0.95, pect: [0.24, 0.13, 0.06], pelv: [0.5, 0.1, 0.035], dorsal: [0.32, 0.64, 0.07] },
    },
    ryukin: {
      prof: FANCY_PROF, capK: 0.75, E: { s: 0.1, lat: 1.02, ra: 0.1, rc: 0.08, bulge: 1.4 }, motion: FANCY_MOTION,
      spec: { bodyFrac: 0.42, w: [0.115, 0.125], tail: 'twin', TL: 0.46, fan: FAN, curlK: 1.0, pect: [0.27, 0.12, 0.06], pelv: [0.5, 0.1, 0.04], dorsal: [0.28, 0.62, 0.1] },
    },
  };
  SPECIES.shubunkin = Object.assign({}, SPECIES.comet, {
    motion: Object.assign({}, COMET_MOTION, { cruise: [0.5, 0.65] }),
    spec: Object.assign({}, SPECIES.comet.spec, { TL: 0.42, spread: 0.6, tipA: -0.04, tipR: 1.02, innerA: 0.12, innerR: 0.9, notchR: 0.55, c2R: 0.7 }),
  });
  SPECIES.oranda = Object.assign({}, SPECIES.ryukin, {
    prof: [0.56, 0.76, 0.87, 0.94, 0.98].concat(FANCY_PROF.slice(5)), capK: 0.7,
    E: { s: 0.13, lat: 1.04, ra: 0.1, rc: 0.08, bulge: 1.4 },
    spec: Object.assign({}, SPECIES.ryukin.spec, { wen: '#d42f18', dorsal: [0.3, 0.6, 0.08] }),
  });

  /* ---------------- Koi ---------------- */

  const SEGMENTS = 18;

  class Koi {
    constructor(o) {
      this.L = o.length;
      const SPX = SPECIES[o.species || 'koi'] || SPECIES.koi;
      this.species = o.species || 'koi';
      this.mo = SPX.motion;
      this.sp = Object.assign({ bodyFrac: 0.66, w: [0.12, 0.134], tail: 'single', TL: 0.3, spread: 0.52, tipA: -0.07, tipR: 1.06, innerA: 0.16, innerR: 0.92, notchR: 0.64, c2R: 0.74, curlK: 0.7, pect: [0.25, 0.17, 0.075], pelv: [0.52, 0.11, 0.042], dorsal: [0.3, 0.72, 0.075], wen: null }, SPX.spec || {});
      this.W = this.L * rand(this.sp.w[0], this.sp.w[1]);
      this.x = o.x;
      this.y = o.y;
      this.angle = o.angle;
      this.cruise = this.L * rand(this.mo.cruise[0], this.mo.cruise[1]);
      this.dartT = rand(6, 14);
      this.dartLeft = 0;
      this.speed = this.cruise;
      this.angVel = 0;
      this.homeDepth = o.depth;
      this.depth = o.depth;
      this.phase = rand(0, TAU);
      this.amp = 0.6;
      this.finPhase = rand(0, TAU);
      this.seed = rand(0, 1000);
      this.orbitDir = o.orbitDir || 1;
      this.fear = 0;
      this.fleeX = 0;
      this.fleeY = 0;
      this.thrust = 0.5;
      this.wakeTimer = 0;
      this.variety = makeVariety(o.variety);

      this.prof = SPX.prof; this.capK = SPX.capK; this.E = SPX.E;
      this.N = SEGMENTS;
      this.seg = (this.L * this.sp.bodyFrac) / (this.N - 1);
      this.P = [];
      this.D = [];
      this.T = [];
      this.Nn = [];
      this.Wd = [];
      for (let i = 0; i < this.N; i++) {
        this.P.push({ x: this.x - Math.cos(this.angle) * this.seg * i, y: this.y - Math.sin(this.angle) * this.seg * i });
        this.D.push({ x: 0, y: 0 });
        this.T.push({ x: 0, y: 0 });
        this.Nn.push({ x: 0, y: 0 });
        this.Wd.push(this.prof[i] * this.W);
      }
    }

    get mouthX() { return this.D[0].x + this.T[0].x * this.W * 0.45; }
    get mouthY() { return this.D[0].y + this.T[0].y * this.W * 0.45; }

    startle(x, y, radius, power) {
      const dx = this.x - x;
      const dy = this.y - y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > radius) return;
      const f = power * (1 - d / radius);
      if (f > this.fear) {
        this.fear = clamp(f, 0, 1.2);
        this.fleeX = dx / d;
        this.fleeY = dy / d;
      }
    }

    update(dt, world) {
      const t = world.time;
      let dx = 0;
      let dy = 0;
      let speedGoal = this.cruise * (0.85 + 0.3 * Math.sin(t * 0.21 + this.seed));
      let depthGoal = this.homeDepth + Math.sin(t * 0.17 + this.seed) * 0.12;
      let turnBoost = 1;

      // Wander — smooth pseudo-noise heading changes.
      const wr = this.mo.wander || 1;
      const wa = this.angle + Math.sin(t * 0.41 * wr + this.seed) * 0.9 + Math.sin(t * 0.17 * wr + this.seed * 1.7) * 0.6;
      dx += Math.cos(wa) * 0.9;
      dy += Math.sin(wa) * 0.9;

      // Loose orbit around a slowly drifting gathering point.
      const cx = world.center.x;
      const cy = world.center.y;
      const R = world.orbitRadius;
      const ox = this.x - cx;
      const oy = this.y - cy;
      const od = Math.hypot(ox, oy) || 1;
      const radial = clamp((od - R) / R, -1, 2);
      dx += (-oy / od) * this.orbitDir * 0.65 - (ox / od) * radial * 0.9;
      dy += (ox / od) * this.orbitDir * 0.65 - (oy / od) * radial * 0.9;

      // Stay in the pond (soft walls).
      const m = this.L * 0.85;
      const w = world.width;
      const h = world.height;
      if (this.x < m) dx += ((m - this.x) / m) * 3.5;
      if (this.x > w - m) dx -= ((this.x - (w - m)) / m) * 3.5;
      if (this.y < m) dy += ((m - this.y) / m) * 3.5;
      if (this.y > h - m) dy -= ((this.y - (h - m)) / m) * 3.5;

      // Separation + alignment with neighbours at similar depth.
      // Checks the other fish's head and mid-body so they don't pile up.
      const mid = this.P[(this.N / 2) | 0];
      for (const o of world.fish) {
        if (o === this) continue;
        const dz = Math.abs(this.depth - o.depth);
        const om = o.P[(o.N / 2) | 0];
        const range = (this.L + o.L) * 0.42;
        for (const q of [o.P[0], om]) {
          const ex = this.x - q.x;
          const ey = this.y - q.y;
          const d = Math.hypot(ex, ey) || 1;
          if (d < range && dz < 0.4) {
            const f = ((range - d) / range) * 4.2 * (1 - dz / 0.4) * clamp(o.L / this.L, 0.5, 2);
            dx += (ex / d) * f;
            dy += (ey / d) * f;
          }
        }
        const ex = this.x - o.x;
        const ey = this.y - o.y;
        const d = Math.hypot(ex, ey) || 1;
        if (d < this.L * 1.5) {
          dx += Math.cos(o.angle) * 0.18;
          dy += Math.sin(o.angle) * 0.18;
        }
        // Soft-body contact: physically nudge overlapping bodies apart.
        const mx2 = mid.x - om.x;
        const my2 = mid.y - om.y;
        const md = Math.hypot(mx2, my2) || 1;
        const minD = (this.W + o.W) * 1.1;
        if (md < minD && dz < 0.25) {
          const push = (minD - md) * 0.5 * Math.min(1, dt * 8);
          this.x += (mx2 / md) * push;
          this.y += (my2 / md) * push;
          // and drift apart vertically, so stacked fish layer naturally
          this.depth += (this.depth >= o.depth ? 1 : -1) * dt * 0.25;
        }
      }

      // Other creatures (the turtle) to swim around
      if (world.obstacles) {
        for (const ob of world.obstacles) {
          if (Math.abs(ob.depth - this.depth) > 0.35) continue;
          const ex = this.x - ob.x;
          const ey = this.y - ob.y;
          const d = Math.hypot(ex, ey) || 1;
          const R = ob.r + this.L * 0.4;
          if (d < R) {
            const f = ((R - d) / R) * 4;
            dx += (ex / d) * f;
            dy += (ey / d) * f;
          }
        }
      }

      // Pointer: fast movement scares, a resting hand invites curiosity.
      const p = world.pointer;
      if (p.active) {
        const pdx = p.x - this.x;
        const pdy = p.y - this.y;
        const pd = Math.hypot(pdx, pdy) || 1;
        if (p.speed > 650 && pd < this.L * 1.5) {
          this.startle(p.x, p.y, this.L * 1.5, clamp(p.speed / 1400, 0.5, 1.1));
        } else if (p.still > 0.45 && this.fear < 0.05 && pd < Math.max(340, this.L * 2.6)) {
          const near = this.L * 0.6;
          const k = pd > near ? 1.6 : -0.8;
          dx += (pdx / pd) * k;
          dy += (pdy / pd) * k;
          speedGoal = this.cruise * (pd > this.L * 1.2 ? 1.15 : 0.45);
          depthGoal = 0.08;
        }
      }

      // Food — koi rise and race to pellets.
      let best = null;
      let bd = Infinity;
      const mx = this.mouthX;
      const my = this.mouthY;
      for (const f of world.food) {
        if (f.eaten || !f.landed || f.onPad) continue;
        const d = Math.hypot(f.x - mx, f.y - my);
        if (d < bd) {
          bd = d;
          best = f;
        }
      }
      if (best && bd < Math.max(world.width, world.height) * 0.6 && this.fear < 0.3) {
        const k = 2.6;
        dx += ((best.x - mx) / bd) * k;
        dy += ((best.y - my) / bd) * k;
        speedGoal = this.cruise * (bd > this.L ? 2.4 : 1.1);
        depthGoal = 0;
        turnBoost = 1.8;
        if (bd < this.W * 0.75 && this.depth < 0.3) {
          best.eaten = true;
          world.drop(best.x, best.y, this.W * 0.9, -0.05);
          world.drop(best.x, best.y, this.W * 0.5, 0.03);
          this.gulp = 1;
        }
      }

      // Comets dart now and then
      if (this.mo.dart) {
        this.dartT -= dt;
        if (this.dartT <= 0) {
          this.dartT = rand(6, 14);
          this.dartLeft = 0.6;
        }
        if (this.dartLeft > 0) {
          this.dartLeft -= dt;
          speedGoal = Math.max(speedGoal, this.cruise * 3);
          turnBoost = Math.max(turnBoost, 2);
        }
      }

      // Fear overrides everything.
      if (this.fear > 0) {
        dx += this.fleeX * 6 * this.fear;
        dy += this.fleeY * 6 * this.fear;
        speedGoal = Math.max(speedGoal, Math.min(this.cruise + this.L * 2.6 * this.fear, this.L * (this.mo.burstMax || 9)));
        depthGoal = Math.min(0.95, this.homeDepth + 0.35);
        turnBoost = 3;
        this.fear = Math.max(0, this.fear - dt * 0.85);
      }

      // Steering with angular inertia.
      const desired = Math.atan2(dy, dx);
      const diff = wrap(desired - this.angle);
      const maxTurn = (this.mo.turn + (this.speed / this.L) * 0.9) * turnBoost;
      const targetAV = clamp(diff * 2.2, -maxTurn, maxTurn);
      this.angVel += (targetAV - this.angVel) * Math.min(1, dt * 3.2 * turnBoost);
      this.angle = wrap(this.angle + this.angVel * dt);

      const accel = speedGoal > this.speed ? this.mo.accel : this.mo.glide ? 0.7 : 1.6; // koi glide when slowing
      const prevSpeed = this.speed;
      this.speed += (speedGoal - this.speed) * Math.min(1, dt * accel);
      const acc = (this.speed - prevSpeed) / Math.max(dt, 1e-4);
      this.thrust = clamp(0.3 + (acc / this.L) * 0.8 + Math.abs(this.angVel) * 0.25, 0.12, 1.4);

      this.x += Math.cos(this.angle) * this.speed * dt;
      this.y += Math.sin(this.angle) * this.speed * dt;
      this.depth += clamp(depthGoal - this.depth, -dt * 0.5, dt * 0.5);
      this.depth = clamp(this.depth, 0, 1);

      // Tail beat frequency follows speed; amplitude follows thrust.
      const freq = this.mo.f0 + (this.speed / this.L) * this.mo.f1;
      this.phase += TAU * freq * dt;
      this.amp += (clamp(0.25 + this.thrust * 0.65, this.mo.minAmp || 0.2, 1.15) - this.amp) * Math.min(1, dt * 3);
      this.finPhase += TAU * (this.mo.finHz || 0.45 + (1 - clamp(this.speed / (this.L * 1.2), 0, 1)) * 0.35) * dt;
      if (this.gulp) this.gulp = Math.max(0, this.gulp - dt * 3);

      // Surface wake for fish swimming near the top.
      if (this.depth < 0.5) {
        const near = 1 - this.depth / 0.5;
        const sp = this.speed / this.L;
        this.wakeTimer -= dt;
        if (this.wakeTimer <= 0) {
          this.wakeTimer = 1 / 30;
          world.drop(this.mouthX, this.mouthY, this.W * 1.1, 0.0045 * sp * near);
          // Tail flick
          const tail = this.D[this.N - 1];
          world.drop(tail.x, tail.y, this.W * 0.9, -0.0035 * sp * near * this.amp * Math.sin(this.phase));
        }
      }

      this._updateSpine();
      this._buildGeometry();
    }

    _updateSpine() {
      const P = this.P;
      P[0].x = this.x;
      P[0].y = this.y;
      let prevA = this.angle + Math.PI;
      for (let i = 1; i < this.N; i++) {
        const s = i / (this.N - 1);
        const maxB = 0.015 + 0.2 * Math.pow(s, 1.6);
        let a = Math.atan2(P[i].y - P[i - 1].y, P[i].x - P[i - 1].x);
        const d = wrap(a - prevA);
        if (d > maxB) a = prevA + maxB;
        else if (d < -maxB) a = prevA - maxB;
        P[i].x = P[i - 1].x + Math.cos(a) * this.seg;
        P[i].y = P[i - 1].y + Math.sin(a) * this.seg;
        prevA = a;
      }
    }

    _tangents(src) {
      const N = this.N;
      for (let i = 0; i < N; i++) {
        const a = src[Math.max(0, i - 1)];
        const b = src[Math.min(N - 1, i + 1)];
        let fx = a.x - b.x;
        let fy = a.y - b.y;
        const l = Math.hypot(fx, fy) || 1;
        fx /= l;
        fy /= l;
        this.T[i].x = fx;
        this.T[i].y = fy;
        this.Nn[i].x = -fy;
        this.Nn[i].y = fx;
      }
    }

    _buildGeometry() {
      const N = this.N;
      const P = this.P;
      const D = this.D;
      this._tangents(P);
      for (let i = 0; i < N; i++) {
        const s = i / (N - 1);
        const lat = this.L * this.amp * (this.mo.h0 + this.mo.h1 * Math.pow(Math.max(0, s - 0.15) / 0.85, 2)) * Math.sin(this.phase - s * this.mo.k);
        D[i].x = P[i].x + this.Nn[i].x * lat;
        D[i].y = P[i].y + this.Nn[i].y * lat;
      }
      this._tangents(D);

      const T = this.T;
      const Nn = this.Nn;
      const Wd = this.Wd;
      const Lp = [];
      const Rp = [];
      const bend = this._bend || (this._bend = new Float32Array(N));
      for (let i = 1; i < N - 1; i++) {
        // vector toward the concave side; |m| ≈ κ·seg²/2
        const mx = (D[i - 1].x + D[i + 1].x) / 2 - D[i].x;
        const my = (D[i - 1].y + D[i + 1].y) / 2 - D[i].y;
        bend[i] = ((mx * Nn[i].x + my * Nn[i].y) * 2) / (this.seg * this.seg); // signed curvature
      }
      bend[0] = 0;
      bend[N - 1] = bend[N - 2];
      for (let i = 0; i < N; i++) {
        const kb = (bend[Math.max(0, i - 1)] + bend[i] * 2 + bend[Math.min(N - 1, i + 1)]) / 4;
        const c = clamp(Math.abs(kb) * Wd[i], 0, 1);
        const inner = 1 - 0.42 * c;  // concave flank compresses
        const outer = 1 - 0.08 * c;  // convex flank stretches thinner
        const wl = Wd[i] * (kb > 0 ? inner : outer);
        const wr = Wd[i] * (kb > 0 ? outer : inner);
        Lp.push({ x: D[i].x + Nn[i].x * wl, y: D[i].y + Nn[i].y * wl });
        Rp.push({ x: D[i].x - Nn[i].x * wr, y: D[i].y - Nn[i].y * wr });
      }

      // ---- Body outline
      const body = new Path2D();
      const lam = this.capK;
      const c1x = Rp[0].x + (Rp[0].x - Rp[1].x) * lam, c1y = Rp[0].y + (Rp[0].y - Rp[1].y) * lam;
      const c2x = Lp[0].x + (Lp[0].x - Lp[1].x) * lam, c2y = Lp[0].y + (Lp[0].y - Lp[1].y) * lam;
      body.moveTo(Rp[0].x, Rp[0].y);
      body.bezierCurveTo(c1x, c1y, c2x, c2y, Lp[0].x, Lp[0].y);
      const cap = new Path2D(); cap.moveTo(Rp[0].x, Rp[0].y); cap.bezierCurveTo(c1x, c1y, c2x, c2y, Lp[0].x, Lp[0].y);
      this._cap = cap;
      smoothThrough(body, Lp, 1, N - 1, 1);
      const kt = this.W * 0.28;
      body.bezierCurveTo(Lp[N - 1].x - T[N - 1].x * kt, Lp[N - 1].y - T[N - 1].y * kt, Rp[N - 1].x - T[N - 1].x * kt, Rp[N - 1].y - T[N - 1].y * kt, Rp[N - 1].x, Rp[N - 1].y);
      smoothThrough(body, Rp, N - 2, 0, -1);
      body.closePath();

      // ---- Tail fin
      const base = D[N - 1];
      const bx = D[N - 1].x - D[N - 2].x;
      const by = D[N - 1].y - D[N - 2].y;
      const bl = Math.hypot(bx, by) || 1;
      const baseA = Math.atan2(by / bl, bx / bl);
      const sw = Math.sin(this.phase - 6.4) * 0.38 * this.amp;
      const speedN = clamp(this.speed / (this.L * 1.5), 0, 1);
      const sp = this.sp; const spread = sp.spread - speedN * 0.16;
      const TL = this.L * sp.TL;
      // the fin is soft: points further from the root lag further behind the beat
      const curl = Math.sin(this.phase - 7.6) * sp.curlK * this.amp;
      const dir = (a, r) => {
        const ang = baseA + sw + a + curl * Math.pow(r / TL, 1.6);
        return { x: base.x + Math.cos(ang) * r, y: base.y + Math.sin(ang) * r };
      };
      // Determine sign so the "L" lobe sits on the Lp side.
      const w0 = this.W * 0.3;
      const sgn = (Math.cos(baseA + 0.5) * Nn[N - 1].x + Math.sin(baseA + 0.5) * Nn[N - 1].y) > 0 ? 1 : -1;
      let tail = new Path2D();
      if (sp.tail === 'twin') {
        // two caudal fans, splayed left/right, each with its own lagging curl
        const open = 1 - speedN * 0.35;
        for (const side of [sgn, -sgn]) {
          const cs = Math.sin(this.phase - 7.6 + side * 0.7) * sp.curlK * this.amp;
          const d2 = (a, r) => { const ang = baseA + sw * 0.6 + side * a * open + cs * Math.pow(r / TL, 1.4); return { x: base.x + Math.cos(ang) * r, y: base.y + Math.sin(ang) * r }; };
          const side0 = side === sgn ? Lp : Rp, nn = side === sgn ? 1 : -1;
          const r0 = { x: base.x + Nn[N - 1].x * nn * w0 * 0.3, y: base.y + Nn[N - 1].y * nn * w0 * 0.3 };
          const pts = sp.fan.map(([a, r]) => d2(a, r * TL));
          tail.moveTo(side0[N - 3].x, side0[N - 3].y);
          tail.quadraticCurveTo(r0.x, r0.y, pts[0].x, pts[0].y);
          for (let j = 1; j < pts.length - 1; j += 2) tail.quadraticCurveTo(pts[j].x, pts[j].y, pts[j + 1].x, pts[j + 1].y);
          tail.quadraticCurveTo(r0.x, r0.y, side0[N - 3].x, side0[N - 3].y);
          tail.closePath();
        }
      } else {
      const lobe = (side) => ({
        c1: dir(side * spread * 0.95, TL * 0.42),
        outer: dir(side * (spread + 0.03), TL * 0.9),
        tip: dir(side * (spread + sp.tipA), TL * sp.tipR),
        inner: dir(side * sp.innerA, TL * sp.innerR),
        c2: dir(side * 0.06, TL * sp.c2R),
      });
      const A = lobe(sgn);
      const B = lobe(-sgn);
      const notch = dir(0, TL * sp.notchR);
      tail.moveTo(Lp[N - 3].x, Lp[N - 3].y);
      tail.quadraticCurveTo(A.c1.x + Nn[N - 1].x * w0, A.c1.y + Nn[N - 1].y * w0, A.outer.x, A.outer.y);
      tail.quadraticCurveTo(A.tip.x, A.tip.y, A.inner.x, A.inner.y);
      tail.quadraticCurveTo(A.c2.x, A.c2.y, notch.x, notch.y);
      tail.quadraticCurveTo(B.c2.x, B.c2.y, B.inner.x, B.inner.y);
      tail.quadraticCurveTo(B.tip.x, B.tip.y, B.outer.x, B.outer.y);
      tail.quadraticCurveTo(B.c1.x - Nn[N - 1].x * w0, B.c1.y - Nn[N - 1].y * w0, Rp[N - 3].x, Rp[N - 3].y);
      tail.closePath();
      }
      const tailRays = [];
      for (let r = 0; r <= 14; r++) {
        const u = (r / 14) * 2 - 1;
        tailRays.push(sp.tail === 'twin' ? dir(u * 1.0, TL * 0.8) : dir(u * spread * 0.95, TL * (0.68 + 0.4 * Math.pow(Math.abs(u), 0.9))));
      }
      const flex = sw;

      // ---- Pectoral & pelvic fins
      const fins = [];
      const openBase = (this.mo.finOpen || 1.0) - speedN * 0.55 + Math.max(0, -this.thrust + 0.4) * 0.3;
      const pIdx = Math.round(sp.pect[0] * (N - 1));
      const vIdx = Math.round(sp.pelv[0] * (N - 1));
      for (const side of [1, -1]) {
        const flap = Math.sin(this.finPhase + (side > 0 ? 0 : 0.9)) * (this.mo.finFlap || 0.28) * (1 - speedN * 0.7);
        fins.push(this._fin(pIdx, side, openBase + flap, this.L * sp.pect[1], this.L * sp.pect[2]));
        fins.push(this._fin(vIdx, side, 0.6 - speedN * 0.25 + flap * 0.4, this.L * sp.pelv[1], this.L * sp.pelv[2]));
      }

      // ---- Dorsal ridge
      const dorsal = new Path2D();
      const dl = [];
      const dr = [];
      const [ds0, ds1, dw] = sp.dorsal || [0.3, 0.72, 0]; for (let s = ds0; s <= ds1 + 1e-4; s += (ds1 - ds0) / 14) {
        const q = this.at(s);
        const off = this.W * 0.16 * this.amp * Math.sin(this.phase - s * 5.2 - 0.8);
        const hw = this.W * dw * Math.sin((Math.PI * (s - ds0)) / (ds1 - ds0)) + (dw ? 0.5 : 0);
        const cxp = q.x + q.nx * off;
        const cyp = q.y + q.ny * off;
        dl.push({ x: cxp + q.nx * hw, y: cyp + q.ny * hw });
        dr.push({ x: cxp - q.nx * hw, y: cyp - q.ny * hw });
      }
      dorsal.moveTo(dl[0].x, dl[0].y);
      smoothThrough(dorsal, dl, 1, dl.length - 1, 1);
      smoothThrough(dorsal, dr, dr.length - 1, 0, -1);
      dorsal.closePath();

      // Spine highlight path
      const spine = new Path2D();
      const off = this.W * 0.1;
      spine.moveTo(D[4].x + Nn[4].x * off, D[4].y + Nn[4].y * off);
      for (let i = 5; i < Math.round(N * 0.82); i++) spine.lineTo(D[i].x + Nn[i].x * off, D[i].y + Nn[i].y * off);

      this.geom = { body, tail, tailBase: base, tailA: baseA + flex + curl * 0.5, TL, tailRays, fins, dorsal, spine, Lp, Rp };
    }

    _fin(idx, side, open, len, wid) {
      const D = this.D[idx];
      const T = this.T[idx];
      const n = this.Nn[idx];
      const w = this.Wd[idx] * 0.82;
      const bx = D.x + n.x * side * w;
      const by = D.y + n.y * side * w;
      // direction: backward (−T) rotated outward
      const fx = -T.x * Math.cos(open) + n.x * side * Math.sin(open);
      const fy = -T.y * Math.cos(open) + n.y * side * Math.sin(open);
      const px = -fy;
      const py = fx;
      const tx = bx + fx * len;
      const ty = by + fy * len;
      const path = new Path2D();
      path.moveTo(bx + px * wid * 0.18 + T.x * wid * 0.2, by + py * wid * 0.18 + T.y * wid * 0.2);
      path.quadraticCurveTo(bx + fx * len * 0.55 + px * wid * 0.8, by + fy * len * 0.55 + py * wid * 0.8, tx + px * wid * 0.3, ty + py * wid * 0.3);
      path.quadraticCurveTo(tx + fx * wid * 0.55, ty + fy * wid * 0.55, tx - px * wid * 0.35, ty - py * wid * 0.35);
      path.quadraticCurveTo(bx + fx * len * 0.5 - px * wid * 0.5, by + fy * len * 0.5 - py * wid * 0.5, bx - px * wid * 0.15 - T.x * wid * 0.25, by - py * wid * 0.15 - T.y * wid * 0.25);
      path.closePath();
      const rays = [];
      for (let r = -2; r <= 2; r++) {
        const a = r * 0.16;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        rays.push({ x: bx + (fx * ca - fy * sa) * len * 0.95, y: by + (fy * ca + fx * sa) * len * 0.95 });
      }
      return { path, bx, by, tx, ty, rays, len };
    }

    /** Interpolated spine sample: point, tangent, normal, half-width */
    at(s) {
      const f = clamp(s, 0, 1) * (this.N - 1);
      const i = Math.min(this.N - 2, Math.floor(f));
      const t = f - i;
      const a = this.D[i];
      const b = this.D[i + 1];
      const na = this.Nn[i];
      const nb = this.Nn[i + 1];
      const ta = this.T[i];
      const tb = this.T[i + 1];
      return {
        x: lerp(a.x, b.x, t),
        y: lerp(a.y, b.y, t),
        nx: lerp(na.x, nb.x, t),
        ny: lerp(na.y, nb.y, t),
        tx: lerp(ta.x, tb.x, t),
        ty: lerp(ta.y, tb.y, t),
        w: lerp(this.Wd[i], this.Wd[i + 1], t),
      };
    }

    drawShadow(ctx) {
      const g = this.geom;
      ctx.fill(g.body);
      ctx.fill(g.tail);
      for (const f of g.fins) ctx.fill(f.path);
    }

    draw(ctx) {
      const g = this.geom;
      const v = this.variety;
      const fade = 1 - this.depth * 0.45;
      const [fr, fg, fb] = v.fin;
      const dark = v.base === C.black;

      // ---- Fins below the body
      ctx.lineCap = 'round';
      for (const f of g.fins) {
        const grad = ctx.createLinearGradient(f.bx, f.by, f.tx, f.ty);
        grad.addColorStop(0, `rgba(${fr},${fg},${fb},${0.88 * fade})`);
        grad.addColorStop(0.65, `rgba(${fr},${fg},${fb},${0.5 * fade})`);
        grad.addColorStop(1, `rgba(${fr},${fg},${fb},${0.22 * fade})`);
        ctx.fillStyle = grad;
        ctx.fill(f.path);
        ctx.save();
        ctx.clip(f.path);
        ctx.strokeStyle = dark ? `rgba(255,255,255,${0.1 * fade})` : `rgba(40,30,20,${0.12 * fade})`;
        ctx.lineWidth = Math.max(0.6, this.L * 0.0035);
        ctx.beginPath();
        for (const r of f.rays) {
          ctx.moveTo(f.bx, f.by);
          ctx.lineTo(r.x, r.y);
        }
        ctx.stroke();
        if (v.finStripe) {
          ctx.strokeStyle = `rgba(18,18,20,${0.55 * fade})`;
          ctx.lineWidth = this.L * 0.012;
          ctx.beginPath();
          const r = f.rays[1];
          ctx.moveTo(f.bx, f.by);
          ctx.lineTo(lerp(f.bx, r.x, 0.6), lerp(f.by, r.y, 0.6));
          ctx.stroke();
        }
        ctx.restore();
      }

      // ---- Tail
      const b = g.tailBase;
      const ex = b.x + Math.cos(g.tailA) * g.TL;
      const ey = b.y + Math.sin(g.tailA) * g.TL;
      const tg = ctx.createLinearGradient(b.x, b.y, ex, ey);
      tg.addColorStop(0, `rgba(${fr},${fg},${fb},${0.9 * fade})`);
      tg.addColorStop(0.55, `rgba(${fr},${fg},${fb},${0.5 * fade})`);
      tg.addColorStop(1, `rgba(${fr},${fg},${fb},${0.18 * fade})`);
      ctx.fillStyle = tg;
      ctx.fill(g.tail);
      ctx.save();
      ctx.clip(g.tail);
      ctx.strokeStyle = dark ? `rgba(255,255,255,${0.1 * fade})` : `rgba(40,30,20,${0.1 * fade})`;
      ctx.lineWidth = Math.max(0.6, this.L * 0.0032);
      ctx.beginPath();
      for (const r of g.tailRays) {
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(r.x, r.y);
      }
      ctx.stroke();
      ctx.restore();

      // ---- Eye orbits drawn BEHIND the body: only the part outside the outline shows
      { const E = this.E, e = this.at(E.s), ea = Math.atan2(e.ty, e.tx);
        for (const side of [1, -1]) {
          const ex2 = e.x + e.nx * side * e.w * E.lat, ey2 = e.y + e.ny * side * e.w * E.lat;
          ctx.beginPath();
          ctx.ellipse(ex2, ey2, this.W * E.ra * E.bulge, this.W * E.rc * E.bulge, ea, 0, TAU);
          ctx.fillStyle = shade(v.base, -0.22);
          ctx.fill();
        } }

      // ---- Body
      ctx.save();
      ctx.clip(g.body);
      const mid = this.at(0.35);
      const lw = mid.w * 1.05;
      const bg = ctx.createLinearGradient(mid.x + mid.nx * lw, mid.y + mid.ny * lw, mid.x - mid.nx * lw, mid.y - mid.ny * lw);
      if (v.metallic) {
        bg.addColorStop(0, shade(v.base, -0.35));
        bg.addColorStop(0.36, shade(v.base, 0.45));
        bg.addColorStop(0.5, shade(v.base, 0.1));
        bg.addColorStop(1, shade(v.base, -0.4));
      } else {
        bg.addColorStop(0, shade(v.base, -0.12));
        bg.addColorStop(0.4, shade(v.base, dark ? 0.06 : 0.04));
        bg.addColorStop(1, shade(v.base, -0.18));
      }
      ctx.fillStyle = bg;
      ctx.fill(g.body);

      for (const p of v.blobs) {
        const q = this.at(p.s);
        const cx = q.x + q.nx * p.o * q.w;
        const cy = q.y + q.ny * p.o * q.w;
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.max(0.5, p.rs * this.L), Math.max(0.5, p.rw * this.W), Math.atan2(q.ty, q.tx), 0, TAU);
        ctx.fillStyle = p.c;
        ctx.fill();
      }

      // Scale shimmer
      if (v.scale > 0 && typeof DOMMatrix !== 'undefined') {
        let pat = patternCache.get(ctx);
        if (!pat) {
          pat = ctx.createPattern(getScaleCanvas(), 'repeat');
          patternCache.set(ctx, pat);
        }
        if (pat && pat.setTransform) {
          const sc = (this.W * 0.42) / 24;
          const h0 = this.D[0];
          pat.setTransform(new DOMMatrix().translate(h0.x, h0.y).rotate((Math.atan2(this.T[3].y, this.T[3].x) * 180) / Math.PI + 90).scale(sc, sc));
          ctx.save();
          const sm = new Path2D(); const D = this.D, Nn = this.Nn, Wd = this.Wd, N = this.N;
          sm.moveTo(D[4].x + Nn[4].x * Wd[4] * 2, D[4].y + Nn[4].y * Wd[4] * 2);
          for (let i = 5; i < N; i++) sm.lineTo(D[i].x + Nn[i].x * Wd[i] * 2, D[i].y + Nn[i].y * Wd[i] * 2);
          for (let i = N - 1; i >= 4; i--) sm.lineTo(D[i].x - Nn[i].x * Wd[i] * 2, D[i].y - Nn[i].y * Wd[i] * 2);
          ctx.clip(sm);
          ctx.globalAlpha = v.scale;
          ctx.fillStyle = pat;
          ctx.fill(g.body);
          ctx.globalAlpha = 1;
          ctx.restore();
        }
      }

      // Volume: soft rim darkening + dorsal sheen
      ctx.lineJoin = 'round';
      const hA = this.at(0), hB = this.at(0.3);
      const rim = (a) => { const g = ctx.createLinearGradient(hA.x, hA.y, hB.x, hB.y); g.addColorStop(0, `rgba(4,14,22,${a*0.3})`); g.addColorStop(1, `rgba(4,14,22,${a})`); return g; };
      ctx.strokeStyle = rim(0.13); ctx.lineWidth = this.W * 1.0; ctx.stroke(g.body);
      ctx.strokeStyle = rim(0.16); ctx.lineWidth = this.W * 0.5; ctx.stroke(g.body);
      ctx.strokeStyle = rim(0.22); ctx.lineWidth = this.W * 0.16; ctx.stroke(g.body);
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,0.09)';
      ctx.lineWidth = this.W * 0.6;
      ctx.stroke(g.spine);
      ctx.strokeStyle = v.metallic ? 'rgba(255,250,235,0.22)' : 'rgba(255,255,255,0.12)';
      ctx.lineWidth = this.W * 0.22;
      ctx.stroke(g.spine);

      // Domed cranium highlight, centred between/behind the eyes
      const hd = this.at(0.14);
      const hg = ctx.createRadialGradient(hd.x, hd.y, 0, hd.x, hd.y, hd.w * 1.0);
      hg.addColorStop(0, v.metallic ? 'rgba(255,250,235,0.24)' : 'rgba(255,255,255,0.15)');
      hg.addColorStop(0.55, 'rgba(255,255,255,0.05)');
      hg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hg;
      ctx.fillRect(hd.x - hd.w * 1.1, hd.y - hd.w * 1.1, hd.w * 2.2, hd.w * 2.2);
      // lip: a light (never dark) rim along the snout
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = this.W * 0.14; ctx.stroke(this._cap);
      // Operculum: short crescent at the back of the head
      const g0 = this.at(0.245), g1 = this.at(0.2);
      for (const side of [1, -1]) {
        const ax = g0.x + g0.nx * side * g0.w * 1.02, ay = g0.y + g0.ny * side * g0.w * 1.02;
        const cx = g0.x + g0.nx * side * g0.w * 0.6, cy = g0.y + g0.ny * side * g0.w * 0.6;
        const bx = g1.x + g1.nx * side * g1.w * 0.42, by = g1.y + g1.ny * side * g1.w * 0.42;
        ctx.lineWidth = Math.max(0.8, this.W * 0.04);
        ctx.strokeStyle = 'rgba(10,18,24,0.15)';
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(cx, cy, bx, by); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        const fx = -g0.tx * this.W * 0.045, fy = -g0.ty * this.W * 0.045;
        ctx.beginPath(); ctx.moveTo(ax - fx, ay - fy); ctx.quadraticCurveTo(cx - fx, cy - fy, bx - fx, by - fy); ctx.stroke();
      }
      ctx.restore();

      // ---- Dorsal fin ridge
      ctx.fillStyle = dark ? 'rgba(200,200,205,0.18)' : `rgba(${fr * 0.55 | 0},${fg * 0.5 | 0},${fb * 0.5 | 0},0.28)`;
      ctx.fill(g.dorsal);
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = Math.max(0.6, this.W * 0.03);
      ctx.stroke(g.dorsal);

      if (this.sp.wen) {
        const wc = this.sp.wen;
        if (!this._wen) { this._wen = []; for (let j = 0; j < 26; j++) { const a = rand(0, TAU), r = Math.sqrt(Math.random()); this._wen.push({ s: 0.13 + Math.sin(a) * r * 0.13, o: Math.cos(a) * r * 0.7, r: rand(0.09, 0.15) }); } this._wen.sort((p, q) => q.s - p.s); }
        const c0 = this.at(0.13), cw = c0.w * 0.8, cl = this.L * this.sp.bodyFrac * 0.15, ca = Math.atan2(c0.ty, c0.tx);
        const capP = new Path2D(); capP.ellipse(c0.x + c0.tx * cl * 0.15, c0.y + c0.ty * cl * 0.15, cl, cw, ca, 0, TAU);
        const cg = ctx.createRadialGradient(c0.x, c0.y, 0, c0.x, c0.y, cw);
        cg.addColorStop(0, shade(wc, 0.08)); cg.addColorStop(0.75, shade(wc, -0.04)); cg.addColorStop(1, shade(wc, -0.2));
        ctx.fillStyle = cg; ctx.fill(capP);
        ctx.save(); ctx.clip(capP);
        for (const b of this._wen) {
          const q = this.at(b.s); const cx = q.x + q.nx * b.o * q.w, cy = q.y + q.ny * b.o * q.w, rr = b.r * this.W * 1.2;
          const gw = ctx.createRadialGradient(cx - rr * 0.3, cy - rr * 0.35, 0, cx, cy, rr);
          gw.addColorStop(0, 'rgba(255,235,220,0.28)'); gw.addColorStop(0.55, 'rgba(255,220,200,0.05)'); gw.addColorStop(0.8, 'rgba(60,0,0,0.0)'); gw.addColorStop(1, 'rgba(60,0,0,0.22)');
          ctx.fillStyle = gw; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.fill();
        }
        ctx.restore();
      }
      // ---- Eyes: domes on the side of the skull, just breaking the outline
      const E = this.E;
      const e = this.at(E.s);
      const ea = Math.atan2(e.ty, e.tx);
      for (const side of [1, -1]) {
        const ex2 = e.x + e.nx * side * e.w * E.lat;
        const ey2 = e.y + e.ny * side * e.w * E.lat;
        ctx.beginPath();
        ctx.ellipse(ex2, ey2, this.W * E.ra, this.W * E.rc, ea, 0, TAU);
        ctx.fillStyle = '#0b0c0e';
        ctx.fill();
        ctx.strokeStyle = 'rgba(150,118,64,0.5)'; ctx.lineWidth = this.W * 0.014; ctx.stroke();
        ctx.beginPath();
        ctx.arc(ex2 - e.tx * this.W * 0.025 - e.nx * side * this.W * 0.012, ey2 - e.ty * this.W * 0.025 - e.ny * side * this.W * 0.012, this.W * 0.022, 0, TAU);
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fill();
      }

      // ---- Depth: water column tints deeper fish
      if (this.depth > 0.02) {
        ctx.fillStyle = `rgba(6,28,40,${this.depth * 0.55})`;
        ctx.fill(g.body);
        ctx.fillStyle = `rgba(6,28,40,${this.depth * 0.3})`;
        ctx.fill(g.tail);
      }
    }
  }

  /** Smooth quadratic curve through pts[from..to] (inclusive), step ±1. */
  function smoothThrough(path, pts, from, to, step) {
    let i = from;
    while (i !== to) {
      const a = pts[i];
      const b = pts[i + step];
      path.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
      i += step;
    }
    path.lineTo(pts[to].x, pts[to].y);
  }

  window.MFH = window.MFH || {};
  window.MFH.Koi = Koi;
})();
