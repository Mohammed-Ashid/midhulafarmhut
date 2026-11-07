/* ==========================================================================
   Small aquarium fish — cardinal tetras, zebra danios, fancy guppies, betta.
   Cheap spines on typed arrays, drawn as nested silhouettes (no clipping),
   batched per school. Boids schooling with fear propagation, koi avoidance,
   cautious curiosity and pellet nibbling.
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
  const LIGHT = -2.2; // upper-left

  function widthAt(prof, s) {
    for (let i = 1; i < prof.length; i++) {
      if (s <= prof[i][0]) {
        const [s0, w0] = prof[i - 1];
        const [s1, w1] = prof[i];
        const t = (s - s0) / (s1 - s0);
        return lerp(w0, w1, 0.5 - 0.5 * Math.cos(t * Math.PI));
      }
    }
    return prof[prof.length - 1][1];
  }

  // Palette tinted toward the water colour by depth (cached per 0.05 bucket)
  const mixCache = new Map();
  function tint(hex, depth) {
    const b = Math.round(clamp(depth, 0, 1) * 20);
    const key = hex + b;
    let v = mixCache.get(key);
    if (v) return v;
    const n = parseInt(hex.slice(1), 16);
    const t = (b / 20) * 0.5;
    const r = Math.round(lerp((n >> 16) & 255, 6, t));
    const g = Math.round(lerp((n >> 8) & 255, 28, t));
    const bl = Math.round(lerp(n & 255, 40, t));
    v = `rgb(${r},${g},${bl})`;
    mixCache.set(key, v);
    return v;
  }

  /* ---------------- Species ---------------- */
  const SPECIES = {
    cardinal: {
      sizeK: 0.13, minL: 15, body: 0.78, W: 0.08, N: 6, depth: 0.32,
      prof: [[0, 0.32], [0.06, 0.72], [0.15, 0.93], [0.28, 1], [0.45, 0.9], [0.65, 0.62], [0.85, 0.36], [1, 0.26]],
      tail: 'fork', tip: 0.42, tipR: 0.24, notch: 0.13, oc: [0.3, 0.1], ic: [0.12, 0.2],
      tailFill: 'rgba(200,70,70,0.28)',
      layers: [[1, '#b8303a'], [0.86, '#1d7fd0'], [0.58, '#27302d']],
      shimmer: true, eyeS: 0.1, eyeR: 0.3, batch: true,
      nR: 4, sepR: 1.2, ws: 1.6, wa: 1.0, wc: 0.6, cruise: 1.2, burst: 7, accel: 25, turn: 7, fearTurn: 2.5, rest: 3.5, mill: 1.2,
    },
    danio: {
      sizeK: 0.15, minL: 16, body: 0.8, W: 0.065, N: 6, depth: 0.08,
      prof: [[0, 0.25], [0.08, 0.62], [0.2, 0.9], [0.36, 1], [0.56, 0.86], [0.76, 0.58], [0.9, 0.4], [1, 0.3]],
      tail: 'fork', tip: 0.38, tipR: 0.26, notch: 0.11, oc: [0.28, 0.1], ic: [0.1, 0.2],
      tailFill: 'rgba(215,215,200,0.3)', tailStripes: '#2a3870',
      layers: [[1, '#cfd2c8'], [0.8, '#27356a'], [0.6, '#d6c68c'], [0.38, '#6b6a4a']],
      eyeS: 0.1, eyeR: 0.24, batch: true, dart: true,
      nR: 5, sepR: 1.0, ws: 1.4, wa: 1.4, wc: 0.8, cruise: 2.5, burst: 10, accel: 40, turn: 10, fearTurn: 1.5, rest: 2,
    },
    guppy: {
      sizeK: 0.16, minL: 18, body: 0.58, W: 0.07, N: 7, depth: 0.18,
      prof: [[0, 0.36], [0.08, 0.78], [0.2, 0.98], [0.32, 1], [0.5, 0.85], [0.7, 0.62], [0.88, 0.48], [1, 0.45]],
      tail: 'delta', edgeA: 0.78, edgeR: 0.42, curlK: 0.9,
      layers: [[1, '#8d8f7a']], eyeS: 0.1, eyeR: 0.24, batch: false,
      nR: 6, sepR: 2.5, ws: 1.0, wa: 0.2, wc: 0.25, cruise: 0.6, burst: 4, accel: 12, turn: 5, fearTurn: 1.5, rest: 1.5,
    },
    betta: {
      sizeK: 0.26, minL: 28, body: 0.55, W: 0.085, N: 9, depth: 0.1,
      prof: [[0, 0.42], [0.07, 0.82], [0.18, 0.98], [0.32, 1], [0.5, 0.92], [0.7, 0.74], [0.88, 0.58], [1, 0.52]],
      tail: 'betta', edgeA: 1.1, edgeR: 0.5, curlK: 1.2,
      layers: [[1, '#1f3f9a'], [0.5, '#16245e']], eyeS: 0.09, eyeR: 0.22, batch: false, slowBeat: true,
      nR: 0, sepR: 4, ws: 1, wa: 0, wc: 0, cruise: 0.35, burst: 2.5, accel: 6, turn: 2.5, fearTurn: 1.5, rest: 1.2,
    },
  };

  const GUPPY_STRAINS = [
    { outer: '#c8262f', inner: '#8c1020', edge: 'rgba(26,12,12,0.5)', shoulder: '#4fd1c5' },
    { outer: '#2f6fd8', inner: '#1b3f8f', dots: '#0d1d3a', shoulder: '#f08a3c' },
    { outer: '#f1c040', inner: '#d9861c', edge: 'rgba(90,50,10,0.4)', shoulder: '#4fd1c5' },
  ];

  /* ---------------- Fish ---------------- */
  class SmallFish {
    constructor(sp, L, x, y, a, style) {
      this.sp = sp;
      this.L = L;
      this.W = L * sp.W;
      this.x = x;
      this.y = y;
      this.a = a;
      this.speed = sp.cruise * L;
      this.av = 0;
      this.phase = rand(0, TAU);
      this.amp = 0.6;
      this.fear = 0;
      this.fx = 0;
      this.fy = 0;
      this.nib = 0;
      this.regroup = 0;
      this.dartT = rand(1.5, 4);
      this.dartLeft = 0;
      this.dartA = 0;
      this.flare = 0;
      this.gulpT = rand(20, 40);
      this.seed = rand(0, 1000);
      this.depth = sp.depth + rand(-0.05, 0.05);
      this.homeDepth = this.depth;
      this.style = style || null;
      if (style && style.dots) {
        this.dots = [];
        for (let i = 0; i < 6; i++) this.dots.push([rand(-0.6, 0.6), rand(0.2, 0.4)]);
      }
      const N = (this.N = sp.N);
      this.seg = (L * sp.body) / (N - 1);
      for (const k of ['px', 'py', 'dx', 'dy', 'tx', 'ty', 'nx', 'ny', 'wd']) this[k] = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        this.px[i] = x - Math.cos(a) * this.seg * i;
        this.py[i] = y - Math.sin(a) * this.seg * i;
        this.wd[i] = widthAt(sp.prof, i / (N - 1)) * this.W;
      }
      this.spine();
    }

    get mouthX() { return this.dx[0] + this.tx[0] * this.W * 0.5; }
    get mouthY() { return this.dy[0] + this.ty[0] * this.W * 0.5; }

    _tangents(X, Y) {
      const N = this.N;
      for (let i = 0; i < N; i++) {
        const a = Math.max(0, i - 1);
        const b = Math.min(N - 1, i + 1);
        let fx = X[a] - X[b];
        let fy = Y[a] - Y[b];
        const l = Math.hypot(fx, fy) || 1;
        fx /= l;
        fy /= l;
        this.tx[i] = fx;
        this.ty[i] = fy;
        this.nx[i] = -fy;
        this.ny[i] = fx;
      }
    }

    spine() {
      const { px, py, N } = this;
      px[0] = this.x;
      py[0] = this.y;
      let prevA = this.a + Math.PI;
      for (let i = 1; i < N; i++) {
        const s = i / (N - 1);
        const maxB = 0.05 + 0.35 * Math.pow(s, 1.4);
        let ang = Math.atan2(py[i] - py[i - 1], px[i] - px[i - 1]);
        const d = wrap(ang - prevA);
        if (d > maxB) ang = prevA + maxB;
        else if (d < -maxB) ang = prevA - maxB;
        px[i] = px[i - 1] + Math.cos(ang) * this.seg;
        py[i] = py[i - 1] + Math.sin(ang) * this.seg;
        prevA = ang;
      }
      this._tangents(px, py);
      for (let i = 0; i < N; i++) {
        const s = i / (N - 1);
        const q = Math.max(0, (s - 0.2) / 0.8);
        const lat = this.L * this.amp * (0.01 + 0.1 * q * q) * Math.sin(this.phase - 4.5 * s);
        this.dx[i] = px[i] + this.nx[i] * lat;
        this.dy[i] = py[i] + this.ny[i] * lat;
      }
      this._tangents(this.dx, this.dy);
    }

    integrate(dx, dy, goal, turnK, dt, depthGoal) {
      const sp = this.sp;
      const L = this.L;
      const diff = wrap(Math.atan2(dy, dx) - this.a);
      const maxTurn = sp.turn * turnK;
      this.av += (clamp(diff * 4, -maxTurn, maxTurn) - this.av) * Math.min(1, dt * 8);
      this.a = wrap(this.a + this.av * dt);
      const acc = (goal > this.speed ? sp.accel : sp.accel * 0.3) * L * dt;
      const prev = this.speed;
      this.speed += clamp(goal - this.speed, -acc, acc);
      const thrust = clamp(0.3 + ((this.speed - prev) / Math.max(dt, 1e-4) / L) * 0.08 + Math.abs(this.av) * 0.08, 0.15, 1.3);
      this.amp += (clamp(0.3 + thrust * 0.6, 0.25, 1.1) - this.amp) * Math.min(1, dt * 5);
      this.x += Math.cos(this.a) * this.speed * dt;
      this.y += Math.sin(this.a) * this.speed * dt;
      const f = sp.slowBeat ? 0.6 + (1.2 * this.speed) / L : Math.min(8, 1.5 + (2.2 * this.speed) / L);
      this.phase += TAU * f * dt;
      this.depth += clamp(depthGoal - this.depth, -dt * 0.6, dt * 0.6);
      this.spine();
    }

    /** sample at s: [x, y, tx, ty, nx, ny, w] */
    at(s) {
      const f = clamp(s, 0, 1) * (this.N - 1);
      const i = Math.min(this.N - 2, Math.floor(f));
      const t = f - i;
      return [
        lerp(this.dx[i], this.dx[i + 1], t), lerp(this.dy[i], this.dy[i + 1], t),
        lerp(this.tx[i], this.tx[i + 1], t), lerp(this.ty[i], this.ty[i + 1], t),
        lerp(this.nx[i], this.nx[i + 1], t), lerp(this.ny[i], this.ny[i + 1], t),
        lerp(this.wd[i], this.wd[i + 1], t),
      ];
    }

    /** Body outline at width scale k, appended to the current path. */
    body(ctx, k) {
      const { dx, dy, nx, ny, tx, ty, wd, N } = this;
      const lx = (i) => dx[i] + nx[i] * wd[i] * k;
      const ly = (i) => dy[i] + ny[i] * wd[i] * k;
      const rx = (i) => dx[i] - nx[i] * wd[i] * k;
      const ry = (i) => dy[i] - ny[i] * wd[i] * k;
      const cap = wd[0] * k * 2.1 + this.W * 0.15 * k;
      ctx.moveTo(rx(0), ry(0));
      ctx.quadraticCurveTo(dx[0] + tx[0] * cap, dy[0] + ty[0] * cap, lx(0), ly(0));
      for (let i = 1; i < N - 1; i++) {
        ctx.quadraticCurveTo(lx(i), ly(i), (lx(i) + lx(i + 1)) / 2, (ly(i) + ly(i + 1)) / 2);
      }
      ctx.lineTo(lx(N - 1), ly(N - 1));
      ctx.lineTo(rx(N - 1), ry(N - 1));
      for (let i = N - 2; i > 0; i--) {
        ctx.quadraticCurveTo(rx(i), ry(i), (rx(i) + rx(i - 1)) / 2, (ry(i) + ry(i - 1)) / 2);
      }
      ctx.closePath();
    }

    _tailFrame() {
      const N = this.N;
      const bx = this.dx[N - 1];
      const by = this.dy[N - 1];
      const baseA = Math.atan2(by - this.dy[N - 2], bx - this.dx[N - 2]);
      const nxe = this.nx[N - 1];
      const nye = this.ny[N - 1];
      const sgn = Math.cos(baseA + 0.5) * nxe + Math.sin(baseA + 0.5) * nye > 0 ? 1 : -1;
      const tw = 0.7 + 0.3 * Math.abs(Math.cos(this.phase - 6));
      const sw = Math.sin(this.phase - 6) * 0.3 * this.amp;
      const curl = Math.sin(this.phase - 7) * (this.sp.curlK || 0.6) * this.amp;
      const L = this.L;
      const TL = (this.sp.tipR || this.sp.edgeR) * 1.05;
      return {
        bx, by, nxe, nye,
        dir: (a, r) => {
          const ang = baseA + sw + sgn * a * tw + curl * Math.pow(r / TL, 1.6);
          return [bx + Math.cos(ang) * r * L, by + Math.sin(ang) * r * L];
        },
      };
    }

    tailFork(ctx) {
      const sp = this.sp;
      const N = this.N;
      const { dir } = this._tailFrame();
      const w = this.wd[N - 1];
      const ex = this.dx[N - 1];
      const ey = this.dy[N - 1];
      ctx.moveTo(ex + this.nx[N - 1] * w, ey + this.ny[N - 1] * w);
      let c = dir(sp.oc[0], sp.oc[1]);
      let p = dir(sp.tip, sp.tipR);
      ctx.quadraticCurveTo(c[0], c[1], p[0], p[1]);
      c = dir(sp.ic[0], sp.ic[1]);
      p = dir(0, sp.notch);
      ctx.quadraticCurveTo(c[0], c[1], p[0], p[1]);
      c = dir(-sp.ic[0], sp.ic[1]);
      p = dir(-sp.tip, sp.tipR);
      ctx.quadraticCurveTo(c[0], c[1], p[0], p[1]);
      c = dir(-sp.oc[0], sp.oc[1]);
      ctx.quadraticCurveTo(c[0], c[1], ex - this.nx[N - 1] * w, ey - this.ny[N - 1] * w);
      ctx.closePath();
    }

    /** Delta / halfmoon fan tail; rs scales radius (inner tone). */
    tailFan(ctx, rs, spread) {
      const sp = this.sp;
      const N = this.N;
      const { dir } = this._tailFrame();
      const E = sp.edgeA * spread;
      const R = sp.edgeR * rs;
      const bl = (th) => 0.025 * Math.sin(this.phase * 0.8 + th * 4);
      const rw = this.W * 0.5;
      const ex = this.dx[N - 1];
      const ey = this.dy[N - 1];
      ctx.moveTo(ex + this.nx[N - 1] * rw, ey + this.ny[N - 1] * rw);
      for (const side of [1, -1]) {
        const s = side;
        if (s === -1) {
          // trailing edge: centre → right half, mirrored
        }
        if (s === 1) {
          let c = dir(E * 0.64, R * 0.43);
          let p = dir(E, R + bl(E));
          ctx.quadraticCurveTo(c[0], c[1], p[0], p[1]);
          c = dir(E * 0.77, (R + 0.02) * 1.06);
          p = dir(E * 0.5, R * 1.05 + bl(E * 0.5));
          ctx.quadraticCurveTo(c[0], c[1], p[0], p[1]);
          c = dir(E * 0.25, R * 1.13);
          p = dir(0, R * 1.07 + bl(0));
          ctx.quadraticCurveTo(c[0], c[1], p[0], p[1]);
        } else {
          let c = dir(-E * 0.25, R * 1.13);
          let p = dir(-E * 0.5, R * 1.05 + bl(-E * 0.5));
          ctx.quadraticCurveTo(c[0], c[1], p[0], p[1]);
          c = dir(-E * 0.77, (R + 0.02) * 1.06);
          p = dir(-E, R + bl(-E));
          ctx.quadraticCurveTo(c[0], c[1], p[0], p[1]);
          c = dir(-E * 0.64, R * 0.43);
          ctx.quadraticCurveTo(c[0], c[1], ex - this.nx[N - 1] * rw, ey - this.ny[N - 1] * rw);
        }
      }
      ctx.closePath();
    }

    eyes(ctx) {
      const e = this.at(this.sp.eyeS);
      const r = this.sp.eyeR * this.W;
      for (const side of [1, -1]) {
        const x = e[0] + e[4] * side * e[6] * 0.85;
        const y = e[1] + e[5] * side * e[6] * 0.85;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, TAU);
      }
    }

    shimmerAlpha(side) {
      const m = this.at(0.4);
      const aMid = Math.atan2(m[3], m[2]);
      const c = Math.max(0, Math.cos(aMid + (side * Math.PI) / 2 - LIGHT));
      return c * c * 0.8 + 0.2 * Math.max(0, Math.sin(this.phase - 2));
    }

    stripe(ctx, side) {
      const N = this.N;
      for (let i = 1; i < N - 1; i++) {
        const x = this.dx[i] + this.nx[i] * side * this.wd[i] * 0.66;
        const y = this.dy[i] + this.ny[i] * side * this.wd[i] * 0.66;
        if (i === 1) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    }

    // ---- Per-fish drawing for guppies and the betta ----
    drawFancy(ctx, depth) {
      const sp = this.sp;
      const st = this.style;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (sp.tail === 'betta') {
        const fl = 1 + this.flare * 0.25;
        // pelvic streamers
        const pv = this.at(0.25);
        ctx.strokeStyle = tint(st.fin, depth);
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = this.W * 0.25;
        ctx.beginPath();
        for (const side of [1, -1]) {
          const bx = pv[0] + pv[4] * side * this.W * 0.9;
          const by = pv[1] + pv[5] * side * this.W * 0.9;
          const lag = Math.sin(this.phase * 0.7 + side) * 0.12 * this.L;
          ctx.moveTo(bx, by);
          ctx.quadraticCurveTo(
            bx - pv[2] * this.L * 0.15 + pv[4] * (side * this.L * 0.05 + lag), by - pv[3] * this.L * 0.15 + pv[5] * (side * this.L * 0.05 + lag),
            bx - pv[2] * this.L * 0.3 + pv[4] * side * this.L * 0.1, by - pv[3] * this.L * 0.3 + pv[5] * side * this.L * 0.1
          );
        }
        ctx.stroke();
        // anal-fin skirt, visible on both sides from above
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = tint(st.fin, depth);
        ctx.beginPath();
        const i0 = Math.round(0.4 * (this.N - 1));
        const pts = [];
        for (let i = i0; i < this.N; i++) {
          const s = i / (this.N - 1);
          const w = this.W * lerp(1.0, 2.3, (s - 0.4) / 0.6) * fl * (1 + 0.06 * Math.sin(this.phase * 0.8 + i));
          pts.push(i);
          if (i === i0) ctx.moveTo(this.dx[i] + this.nx[i] * w, this.dy[i] + this.ny[i] * w);
          else ctx.lineTo(this.dx[i] + this.nx[i] * w, this.dy[i] + this.ny[i] * w);
        }
        for (let j = pts.length - 1; j >= 0; j--) {
          const i = pts[j];
          const s = i / (this.N - 1);
          const w = this.W * lerp(1.0, 2.3, (s - 0.4) / 0.6) * fl * (1 + 0.06 * Math.sin(this.phase * 0.8 + i + 2));
          ctx.lineTo(this.dx[i] - this.nx[i] * w, this.dy[i] - this.ny[i] * w);
        }
        ctx.closePath();
        ctx.fill();
        // caudal
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        this.tailFan(ctx, 1, fl);
        ctx.fill();
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = st.edge;
        ctx.lineWidth = Math.max(0.8, this.W * 0.12);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        // guppy delta tail, two-tone
        ctx.globalAlpha = 0.78;
        ctx.fillStyle = tint(st.outer, depth);
        ctx.beginPath();
        this.tailFan(ctx, 1, 1);
        ctx.fill();
        if (st.edge) {
          ctx.globalAlpha = 1;
          ctx.strokeStyle = st.edge;
          ctx.lineWidth = Math.max(0.6, this.W * 0.1);
          ctx.stroke();
        }
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = tint(st.inner, depth);
        ctx.beginPath();
        this.tailFan(ctx, 0.55, 1);
        ctx.fill();
        if (this.dots) {
          const { dir } = this._tailFrame();
          ctx.fillStyle = st.dots;
          ctx.globalAlpha = 0.7;
          ctx.beginPath();
          for (const [a, r] of this.dots) {
            const p = dir(a, r);
            ctx.moveTo(p[0] + this.W * 0.18, p[1]);
            ctx.arc(p[0], p[1], this.W * 0.18, 0, TAU);
          }
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // body layers
      for (const [k, c] of sp.layers) {
        ctx.fillStyle = tint(c, depth);
        ctx.beginPath();
        this.body(ctx, k);
        ctx.fill();
      }
      // dorsal ribbon trailing back over the tail
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = tint(sp.tail === 'betta' ? st.fin : st.outer, depth);
      ctx.lineWidth = this.W * (sp.tail === 'betta' ? 1 : 0.6);
      ctx.beginPath();
      const d0 = this.at(0.45);
      ctx.moveTo(d0[0], d0[1]);
      for (let i = Math.ceil(0.45 * (this.N - 1)); i < this.N; i++) ctx.lineTo(this.dx[i], this.dy[i]);
      const { dir } = this._tailFrame();
      const pe = dir(0, 0.18);
      ctx.lineTo(pe[0], pe[1]);
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (st.shoulder) {
        const sh = this.at(0.3);
        ctx.fillStyle = st.shoulder;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(sh[0] + sh[4] * sh[6] * 0.35, sh[1] + sh[5] * sh[6] * 0.35, this.W * 0.28, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = 'rgba(4,14,22,0.25)';
      ctx.lineWidth = this.W * 0.35;
      ctx.beginPath();
      this.body(ctx, 1);
      ctx.stroke();
      ctx.fillStyle = '#0b0d0f';
      ctx.beginPath();
      this.eyes(ctx);
      ctx.fill();
    }
  }

  /* ---------------- School ---------------- */
  class School {
    constructor(name, count, home, world, styles) {
      const sp = SPECIES[name];
      this.name = name;
      this.sp = sp;
      const w = world.width;
      const h = world.height;
      const m = Math.min(w, h);
      const Lk = 0.285 * m * (w < 700 ? 1.1 : 1);
      this.L = Math.max(sp.minL, sp.sizeK * Lk);
      this.home0 = { x: home[0] * w, y: home[1] * h };
      this.homeSeed = rand(0, 100);
      this.migrateT = rand(25, 45);
      this.dropCD = 0;
      this.wakeT = 0;
      this.f = [];
      for (let i = 0; i < count; i++) {
        const a = rand(0, TAU);
        const r = rand(0, 3) * this.L;
        const st = styles ? styles[i % styles.length] : null;
        this.f.push(new SmallFish(sp, this.L * rand(0.9, 1.1), this.home0.x + Math.cos(a) * r, this.home0.y + Math.sin(a) * r, rand(-Math.PI, Math.PI), st));
      }
      this.depth = sp.depth;
    }

    homeAt(t, world) {
      const m = Math.min(world.width, world.height);
      const s = this.homeSeed;
      return {
        x: this.home0.x + Math.sin(t / 9 + s) * 0.08 * m + Math.sin(t / 14 + s * 2) * 0.04 * m,
        y: this.home0.y + Math.cos(t / 11 + s) * 0.08 * m,
      };
    }

    startle(x, y, R, p) {
      for (const f of this.f) {
        const ex = f.x - x;
        const ey = f.y - y;
        const d = Math.hypot(ex, ey) || 1;
        if (d < R) {
          const v = p * (1 - d / R);
          if (v > f.fear) {
            f.fear = v;
            f.fx = ex / d;
            f.fy = ey / d;
          }
        }
      }
    }

    _migrate(world) {
      const w = world.width;
      const h = world.height;
      const mobile = w < 700;
      const spots = mobile
        ? [[0.6, 0.24], [0.35, 0.14], [0.75, 0.38], [0.3, 0.32], [0.55, 0.12]]
        : [[0.72, 0.3], [0.5, 0.15], [0.84, 0.7], [0.88, 0.18], [0.62, 0.55], [0.4, 0.12]];
      const s = spots[Math.floor(Math.random() * spots.length)];
      this.home0.x = s[0] * w;
      this.home0.y = s[1] * h;
    }

    update(dt, W) {
      const sp = this.sp;
      const P = W.pointer;
      const L = this.L;
      const m = Math.min(W.width, W.height);
      const w = W.width;
      const h = W.height;
      const mobile = w < 700;

      this.migrateT -= dt;
      if (this.migrateT <= 0) {
        this.migrateT = rand(25, 45);
        this._migrate(W);
      }
      const home = this.homeAt(W.time, W);
      this.dropCD -= dt;

      // Fast pointer → fountain effect
      if (P.active && P.speed > 650) {
        const R = Math.max(8 * L, 0.14 * m);
        const pv = Math.hypot(P.vx, P.vy) || 1;
        let hit = false;
        for (const f of this.f) {
          const ex = f.x - P.x;
          const ey = f.y - P.y;
          const d = Math.hypot(ex, ey) || 1;
          if (d < R) {
            const fear = 1.2 * (1 - d / R);
            if (fear > f.fear) {
              const side = Math.sign(P.vx * ey - P.vy * ex) || 1;
              let fx = ex / d + 0.8 * side * (-P.vy / pv);
              let fy = ey / d + 0.8 * side * (P.vx / pv);
              const l = Math.hypot(fx, fy) || 1;
              f.fear = fear;
              f.fx = fx / l;
              f.fy = fy / l;
              hit = true;
            }
          }
        }
        if (hit && this.dropCD <= 0) {
          this.dropCD = 0.5;
          const c = this._centroid();
          W.drop(c.x, c.y, 3 * L, 0.01);
        }
      }

      // Nearest pellet (shared by the school)
      let pellet = null;
      let guarded = false;
      {
        const c = this._centroid();
        let bd = 0.35 * m;
        for (const fd of W.food) {
          if (fd.eaten || !fd.landed || fd.onPad) continue;
          const d = Math.hypot(fd.x - c.x, fd.y - c.y);
          if (d < bd) {
            bd = d;
            pellet = fd;
          }
        }
        if (pellet) {
          for (const k of W.fish) {
            if (Math.hypot(k.P[0].x - pellet.x, k.P[0].y - pellet.y) < k.W * 3 + 2 * L) {
              guarded = true;
              break;
            }
          }
        }
      }

      let depthSum = 0;
      for (const a of this.f) {
        let sx = 0, sy = 0, ax = 0, ay = 0, cx = 0, cy = 0, n = 0, maxF = 0;
        for (const b of this.f) {
          if (a === b) continue;
          const ex = a.x - b.x;
          const ey = a.y - b.y;
          const d = Math.hypot(ex, ey) || 1;
          if (d < sp.sepR * L) {
            const k = 1 - d / (sp.sepR * L);
            sx += (ex / d) * k;
            sy += (ey / d) * k;
          }
          if (d < sp.nR * L) {
            ax += Math.cos(b.a);
            ay += Math.sin(b.a);
            cx += b.x;
            cy += b.y;
            n++;
          }
          if (d < 2.5 * L && b.fear > maxF) maxF = b.fear;
        }
        // fear travels through the school
        const tgt = 0.75 * maxF;
        if (tgt > a.fear) {
          a.fear += (tgt - a.fear) * Math.min(1, 10 * dt);
          if (a.fx === 0 && a.fy === 0) {
            a.fx = Math.cos(a.a);
            a.fy = Math.sin(a.a);
          }
        }
        const wasAfraid = a.fear >= 0.3;
        const calm = a.fear < 0.3;
        if (a.regroup > 0) a.regroup -= dt;
        const coh = calm ? sp.wc * (a.regroup > 0 ? 2 : 1) : 0;
        const ali = sp.wa * (calm ? 1 : 0.2);
        let sepW = sp.ws;
        let goal = sp.cruise * L * (0.85 + 0.3 * Math.sin(W.time * 0.3 + a.seed));
        let depthGoal = a.homeDepth;
        let turnK = 1;

        // wander
        const wa = a.a + Math.sin(W.time * 0.9 + a.seed) * 0.8 + Math.sin(W.time * 0.37 + a.seed * 2) * 0.5;
        let dx = Math.cos(wa) * 0.5;
        let dy = Math.sin(wa) * 0.5;
        if (n) {
          dx += (ax / n) * ali + ((cx / n - a.x) / L) * coh * 0.3;
          dy += (ay / n) * ali + ((cy / n - a.y) / L) * coh * 0.3;
        }

        // home
        {
          const ex = home.x - a.x;
          const ey = home.y - a.y;
          const d = Math.hypot(ex, ey) || 1;
          const pull = Math.min(2, (0.4 * d) / (0.18 * m));
          dx += (ex / d) * pull;
          dy += (ey / d) * pull;
        }
        // walls
        const mg = 2 * L;
        if (a.x < mg) dx += ((mg - a.x) / mg) * 3.5;
        if (a.x > w - mg) dx -= ((a.x - (w - mg)) / mg) * 3.5;
        if (a.y < mg) dy += ((mg - a.y) / mg) * 3.5;
        if (a.y > h - mg) dy -= ((a.y - (h - mg)) / mg) * 3.5;
        // keep the headline area calm
        if (mobile ? a.y > 0.5 * h : a.x < Math.min(720, 0.5 * w) && a.y > 0.42 * h) {
          if (!mobile) dx += 1.5;
          dy -= 1.5;
        }

        // koi: part around them like a curtain
        for (const k of W.fish) {
          const dz = Math.abs(k.depth - a.depth);
          const depthK = clamp(1 - dz / 0.45, 0.15, 1);
          const hx = k.P[0].x;
          const hy = k.P[0].y;
          const tx = Math.cos(k.angle);
          const ty = Math.sin(k.angle);
          const pts = [
            [hx, hy, k.W * 1.8 + 1.5 * L],
            [hx + tx * k.speed * 0.4, hy + ty * k.speed * 0.4, k.W * 1.8 + 1.5 * L],
            [k.P[(k.N / 2) | 0].x, k.P[(k.N / 2) | 0].y, k.W * 1.4 + L],
          ];
          for (const [qx, qy, R] of pts) {
            const ex = a.x - qx;
            const ey = a.y - qy;
            const d = Math.hypot(ex, ey) || 1;
            if (d < R) {
              const f = 5 * Math.pow(1 - d / R, 2) * depthK;
              dx += (ex / d) * f;
              dy += (ey / d) * f;
            }
          }
          const ex = a.x - hx;
          const ey = a.y - hy;
          const d = Math.hypot(ex, ey) || 1;
          const R = k.W * 1.8 + 1.5 * L;
          if (d < 1.6 * R && (ex * tx + ey * ty) / d > 0.5 && dz < 0.45 && a.fear < 0.5) {
            const side = Math.sign(tx * ey - ty * ex) || 1;
            a.fear = 0.5;
            a.fx = -ty * side;
            a.fy = tx * side;
          }
          if (Math.hypot(k.mouthX - a.x, k.mouthY - a.y) < 1.5 * k.W && a.fear < 0.8) {
            a.fear = 0.8;
            a.fx = ex / d;
            a.fy = ey / d;
          }
        }

        // resting pointer: cautious curiosity
        if (P.active && P.still > 0.8 && a.fear < 0.1) {
          const ex = P.x - a.x;
          const ey = P.y - a.y;
          const d = Math.hypot(ex, ey) || 1;
          if (d < 0.22 * m) {
            const ring = sp.rest * L;
            const k = d > ring ? 1.2 : -1;
            dx += (ex / d) * k;
            dy += (ey / d) * k;
            if (sp.mill) {
              dx += (-ey / d) * sp.mill;
              dy += (ex / d) * sp.mill;
            }
            if (d < ring * 1.3) goal *= 0.6;
            if (sp.tail === 'betta') a.flare = Math.min(1, a.flare + dt * 2.5);
          }
        }
        if (sp.tail === 'betta') a.flare = Math.max(0, a.flare - dt * 0.8);

        // food
        if (pellet && a.fear < 0.3) {
          const ex = pellet.x - a.mouthX;
          const ey = pellet.y - a.mouthY;
          const d = Math.hypot(ex, ey) || 1;
          if (guarded) {
            const ring = 3 * L + 40;
            const k = d > ring ? 1.5 : -1.2;
            dx += (ex / d) * k;
            dy += (ey / d) * k;
          } else {
            dx += (ex / d) * 3;
            dy += (ey / d) * 3;
            goal = 4 * L;
            sepW *= 0.5;
            turnK = 1.5;
            depthGoal = 0.02;
            a.nib -= dt;
            if (d < 0.6 * pellet.size + 0.15 * L && a.nib <= 0) {
              a.nib = 0.4;
              pellet.size -= 0.35;
              W.drop(pellet.x, pellet.y, 0.6 * L, 0.006);
              if (pellet.size < 1.4) pellet.eaten = true;
            }
          }
        }
        dx += sx * sepW;
        dy += sy * sepW;

        // danio darts
        if (sp.dart) {
          a.dartT -= dt;
          if (a.dartT <= 0) {
            a.dartT = rand(1.5, 4);
            a.dartLeft = 0.3;
            a.dartA = rand(-0.6, 0.6);
          }
          if (a.dartLeft > 0) {
            a.dartLeft -= dt;
            goal *= 2;
            dx += Math.cos(a.a + a.dartA) * 2;
            dy += Math.sin(a.a + a.dartA) * 2;
          }
        }
        // betta breathes at the surface
        if (sp.tail === 'betta') {
          a.gulpT -= dt;
          if (a.gulpT < 2) depthGoal = 0;
          if (a.gulpT <= 0) {
            a.gulpT = rand(20, 40);
            W.drop(a.mouthX, a.mouthY, 1.2 * a.W, 0.02);
          }
        }

        if (a.fear > 0) {
          dx += a.fx * 8 * a.fear;
          dy += a.fy * 8 * a.fear;
          goal = Math.max(goal, sp.burst * L * a.fear);
          turnK = 1 + 2 * a.fear * sp.fearTurn;
          if (a.fear > 0.3) depthGoal = a.homeDepth + 0.2;
          a.fear = Math.max(0, a.fear - dt * 0.9);
          if (wasAfraid && a.fear < 0.3) a.regroup = 1.5;
          if (a.fear === 0) {
            a.fx = 0;
            a.fy = 0;
          }
        }

        a.integrate(dx, dy, goal, turnK, dt, depthGoal);
        depthSum += a.depth;
      }
      this.depth = depthSum / this.f.length;

      // light surface wake from shallow schools
      if (this.depth < 0.15) {
        this.wakeT -= dt;
        if (this.wakeT <= 0) {
          this.wakeT = 0.1;
          const f = this.f[(Math.random() * this.f.length) | 0];
          W.drop(f.mouthX, f.mouthY, 0.6 * f.L, 0.0015 * (f.speed / f.L));
        }
      }
    }

    _centroid() {
      let x = 0;
      let y = 0;
      for (const f of this.f) {
        x += f.x;
        y += f.y;
      }
      return { x: x / this.f.length, y: y / this.f.length };
    }

    drawShadow(ctx) {
      ctx.beginPath();
      for (const f of this.f) {
        const m = f.at(0.45);
        const ang = Math.atan2(m[3], m[2]);
        ctx.moveTo(m[0] + Math.cos(ang) * f.L * 0.42, m[1] + Math.sin(ang) * f.L * 0.42);
        ctx.ellipse(m[0], m[1], f.L * 0.42, f.W * 1.1, ang, 0, TAU);
      }
      ctx.fill();
    }

    draw(ctx) {
      const sp = this.sp;
      const dep = this.depth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (!sp.batch) {
        for (const f of this.f) f.drawFancy(ctx, f.depth);
        return;
      }
      const W0 = this.f[0].W;
      // tails
      ctx.fillStyle = sp.tailFill;
      ctx.beginPath();
      for (const f of this.f) f.tailFork(ctx);
      ctx.fill();
      if (sp.tailStripes) {
        ctx.strokeStyle = tint(sp.tailStripes, dep);
        ctx.lineWidth = W0 * 0.12;
        ctx.beginPath();
        for (const f of this.f) {
          const { dir, bx, by } = f._tailFrame();
          for (const s of [1, -1]) {
            const p = dir(s * sp.tip * 0.85, sp.tipR * 0.7);
            ctx.moveTo(bx, by);
            ctx.lineTo(p[0], p[1]);
          }
        }
        ctx.stroke();
      }
      // nested colour layers
      for (const [k, c] of sp.layers) {
        ctx.fillStyle = tint(c, dep);
        ctx.beginPath();
        for (const f of this.f) f.body(ctx, k);
        ctx.fill();
      }
      // iridescent stripe (cardinal)
      if (sp.shimmer) {
        const buckets = [[], [], []];
        for (const f of this.f) {
          for (const side of [1, -1]) {
            const al = f.shimmerAlpha(side);
            const b = al < 0.2 ? -1 : al < 0.45 ? 0 : al < 0.7 ? 1 : 2;
            if (b >= 0) buckets[b].push([f, side]);
          }
        }
        ctx.strokeStyle = '#8fe9ff';
        ctx.lineWidth = W0 * 0.18 * 2;
        [0.25, 0.5, 0.75].forEach((al, i) => {
          if (!buckets[i].length) return;
          ctx.globalAlpha = al * (1 - dep * 0.5);
          ctx.beginPath();
          for (const [f, side] of buckets[i]) f.stripe(ctx, side);
          ctx.stroke();
        });
        ctx.globalAlpha = 1;
      }
      // rim
      ctx.strokeStyle = 'rgba(4,14,22,0.25)';
      ctx.lineWidth = W0 * 0.35;
      ctx.beginPath();
      for (const f of this.f) f.body(ctx, 1);
      ctx.stroke();
      // eyes
      ctx.fillStyle = '#0b0d0f';
      ctx.beginPath();
      for (const f of this.f) f.eyes(ctx);
      ctx.fill();
    }
  }

  /** Composition: which schools live in the pond, and where. */
  function createSchools(world) {
    const mobile = world.width < 700;
    const betta = [{ fin: '#7a1430', edge: 'rgba(79,134,230,0.6)' }];
    if (mobile) {
      return [
        new School('cardinal', 10, [0.6, 0.24], world),
        new School('danio', 5, [0.4, 0.12], world),
        new School('guppy', 3, [0.28, 0.4], world, GUPPY_STRAINS),
        new School('betta', 1, [0.82, 0.34], world, betta),
      ];
    }
    return [
      new School('cardinal', 14, [0.72, 0.3], world),
      new School('danio', 7, [0.5, 0.14], world),
      new School('guppy', 3, [0.8, 0.55], world, GUPPY_STRAINS),
      new School('betta', 1, [0.88, 0.18], world, betta),
    ];
  }

  window.MFH = window.MFH || {};
  window.MFH.School = School;
  window.MFH.SmallFish = SmallFish;
  window.MFH.SMALL_SPECIES = SPECIES;
  window.MFH.GUPPY_STRAINS = GUPPY_STRAINS;
  window.MFH.createSchools = createSchools;
})();
