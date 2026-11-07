/* ==========================================================================
   Pond life — water lilies, a red-eared slider and a visiting dragonfly.
   Static art is pre-rendered to sprites; every
   frame only places sprites and a few short paths.
   ========================================================================== */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;
  const rand = (a, b) => a + Math.random() * (b - a);
  const randn = () => (Math.random() + Math.random() + Math.random() - 1.5) / 0.5;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t * t * (3 - 2 * t);
  const wrap = (a) => {
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a;
  };
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }
  function inRect(r, x, y, pad) {
    pad = pad || 0;
    return r && x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad;
  }
  function tintHex(hex, depth) {
    const n = parseInt(hex.slice(1), 16);
    const t = clamp(depth, 0, 1) * 0.5;
    return `rgb(${Math.round(lerp((n >> 16) & 255, 6, t))},${Math.round(lerp((n >> 8) & 255, 28, t))},${Math.round(lerp(n & 255, 40, t))})`;
  }

  /* ======================= Ripple log (JS-side wave model) ======================= */
  class RippleLog {
    constructor() { this.ev = []; }
    add(x, y, s, t) {
      if (Math.abs(s) < 0.01) return;
      this.ev.push({ x, y, s, t });
      if (this.ev.length > 32) this.ev.shift();
    }
    sample(x, y, t, c) {
      let h = 0, gx = 0, gy = 0;
      for (const e of this.ev) {
        const a = t - e.t;
        if (a > 3 || a < 0) continue;
        const dx = x - e.x;
        const dy = y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        const f = d - c * a;
        const env = e.s * Math.exp(-a / 1.2 - (f * f) / 800);
        h += env * Math.sin(f * 0.26);
        gx += (dx / d) * Math.abs(env);
        gy += (dy / d) * Math.abs(env);
      }
      return { h, gx, gy };
    }
  }

  /* ======================= Water lilies ======================= */
  function padPath(g, r, notchA, s1, s2, slit) {
    const half = slit ? 0.025 : 0.105;
    const a0 = notchA + half;
    const a1 = notchA + TAU - half;
    g.beginPath();
    g.moveTo(0, 0);
    for (let i = 0; i <= 72; i++) {
      const a = lerp(a0, a1, i / 72);
      const rr = r * (1 + 0.03 * Math.sin(3 * a + s1) + 0.015 * Math.sin(7 * a + s2));
      g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.closePath();
    return [a0, a1];
  }

  function renderPad(r, dpr) {
    const notchA = rand(0, TAU);
    const s1 = rand(0, TAU);
    const s2 = rand(0, TAU);
    const slit = Math.random() < 0.3;
    const old = Math.random() < 1 / 6;
    const young = Math.random() < 0.28; // young pads are bronze-red
    const S = r * 2.3;
    const c = makeCanvas(S * dpr, S * dpr);
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    g.translate(S / 2, S / 2);

    // water meniscus around the pad
    padPath(g, r, notchA, s1, s2, slit);
    g.strokeStyle = 'rgba(210,235,235,0.10)';
    g.lineWidth = 6;
    g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.28)';
    g.lineWidth = 3;
    g.stroke();

    const [a0, a1] = padPath(g, r, notchA, s1, s2, slit);
    const fill = g.createRadialGradient(-r * 0.15, -r * 0.15, 0, 0, 0, r);
    if (young) {
      fill.addColorStop(0, '#8a6232');
      fill.addColorStop(0.65, '#6b4423');
      fill.addColorStop(1, '#472a16');
    } else {
      const hue = rand(-8, 8);
      fill.addColorStop(0, `hsl(${84 + hue},30%,33%)`);
      fill.addColorStop(0.65, `hsl(${88 + hue},34%,24%)`);
      fill.addColorStop(1, `hsl(${92 + hue},38%,15%)`);
    }
    g.fillStyle = fill;
    g.fill();

    g.save();
    g.clip();
    // radial veins
    // bronze flecks like a real Nymphaea pad
    for (let i = 0; i < 40; i++) {
      const a = rand(0, TAU);
      const d = Math.sqrt(Math.random()) * r * 0.95;
      g.fillStyle = `rgba(${young ? 200 : 186},${young ? 96 : 104},${young ? 40 : 48},${rand(0.08, 0.26).toFixed(2)})`;
      g.beginPath();
      g.ellipse(Math.cos(a) * d, Math.sin(a) * d, rand(0.01, 0.05) * r, rand(0.006, 0.02) * r, a + 1.5, 0, TAU);
      g.fill();
    }
    // radial veins: dark groove with a lit edge
    for (let i = 0; i < 22; i++) {
      const a = lerp(a0 + 0.08, a1 - 0.08, i / 21);
      const bend = 0.06 * Math.sin(i * 1.7);
      for (const [col, off] of [['rgba(15,25,8,0.35)', 0], ['rgba(200,215,150,0.12)', 0.012]]) {
        g.strokeStyle = col;
        g.lineWidth = off ? 0.6 : 1;
        g.beginPath();
        g.moveTo(Math.cos(a + off) * r * 0.06, Math.sin(a + off) * r * 0.06);
        g.quadraticCurveTo(Math.cos(a + bend + off) * r * 0.5, Math.sin(a + bend + off) * r * 0.5, Math.cos(a + off) * r * 0.93, Math.sin(a + off) * r * 0.93);
        g.stroke();
      }
    }
    // glossy sheen
    const gl = g.createRadialGradient(-0.35 * r, -0.4 * r, 0, -0.35 * r, -0.4 * r, 0.9 * r);
    gl.addColorStop(0, 'rgba(255,255,235,0.16)');
    gl.addColorStop(1, 'rgba(255,255,235,0)');
    g.fillStyle = gl;
    g.fillRect(-r, -r, 2 * r, 2 * r);
    if (old) {
      g.fillStyle = 'rgba(138,122,58,0.35)';
      for (let i = 0; i < 5; i++) {
        const a = rand(0, TAU);
        const d = rand(0.4, 0.95) * r;
        g.beginPath();
        g.ellipse(Math.cos(a) * d, Math.sin(a) * d, rand(0.08, 0.2) * r, rand(0.05, 0.12) * r, a, 0, TAU);
        g.fill();
      }
    }
    g.fillStyle = 'rgba(255,255,235,0.07)';
    g.beginPath();
    g.ellipse(-0.3 * r, -0.35 * r, 0.45 * r, 0.3 * r, -0.6, 0, TAU);
    g.fill();
    // upturned rim
    padPath(g, r, notchA, s1, s2, slit);
    g.strokeStyle = young ? 'rgba(160,60,40,0.55)' : 'rgba(140,70,40,0.45)';
    g.lineWidth = 3;
    g.stroke();
    g.restore();

    // red underside showing at the notch
    g.strokeStyle = 'rgba(123,46,43,0.5)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(Math.cos(a0) * r, Math.sin(a0) * r);
    g.moveTo(0, 0);
    g.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
    g.stroke();

    // water droplets: shadow, refracting body, specular, caustic crescent
    for (let i = 0, n = 4 + Math.floor(Math.random() * 6); i < n; i++) {
      const a = rand(a0 + 0.3, a1 - 0.3);
      const d = rand(0.2, 0.8) * r;
      const x = Math.cos(a) * d;
      const y = Math.sin(a) * d;
      const br = rand(0.018, 0.06) * r + 1.2;
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.beginPath();
      g.arc(x + br * 0.35, y + br * 0.45, br, 0, TAU);
      g.fill();
      const bg = g.createRadialGradient(x - br * 0.2, y - br * 0.2, 0, x, y, br);
      bg.addColorStop(0, 'rgba(255,255,255,0.06)');
      bg.addColorStop(0.75, 'rgba(30,45,20,0.18)');
      bg.addColorStop(1, 'rgba(10,20,8,0.45)');
      g.fillStyle = bg;
      g.beginPath();
      g.arc(x, y, br, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(230,255,210,0.35)';
      g.lineWidth = Math.max(0.6, br * 0.18);
      g.beginPath();
      g.arc(x, y, br * 0.72, 0.15 * Math.PI, 0.65 * Math.PI);
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath();
      g.arc(x - br * 0.38, y - br * 0.38, Math.max(0.6, br * 0.22), 0, TAU);
      g.fill();
    }

    // blurred shadow silhouette
    const k = 0.2;
    const sh = makeCanvas(S * k, S * k);
    const sg = sh.getContext('2d');
    sg.scale(k, k);
    sg.translate(S / 2, S / 2);
    padPath(sg, r, notchA, s1, s2, slit);
    sg.fillStyle = '#000';
    sg.fill();
    return { img: c, shadow: sh, S };
  }

  function petal(g, ang, len, wid, c0, c1) {
    g.save();
    g.rotate(ang);
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(len * 0.45, wid, len, 0);
    g.quadraticCurveTo(len * 0.45, -wid, 0, 0);
    const gr = g.createLinearGradient(0, 0, len, 0);
    gr.addColorStop(0, c0);
    gr.addColorStop(1, c1);
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = 'rgba(150,60,80,0.2)';
    g.lineWidth = 0.6;
    g.stroke();
    g.restore();
  }

  const FLOWER_PALETTES = {
    pink: { sep: ['#6d7f45', '#8b5a62'], r1: ['#f6e9ea', '#e58fa8'], r2: ['#fbf1f0', '#efaabb'], r3: ['#fffaf6', '#fde8ea'] },
    crimson: { sep: ['#4b3a22', '#6e2230'], r1: ['#d8325a', '#a3102f'], r2: ['#ee4d70', '#c31c45'], r3: ['#ff8aa2', '#e33d63'] },
  };
  function renderFlower(D, dpr, palette) {
    const P = FLOWER_PALETTES[palette || 'pink'];
    const S = D * 1.3;
    const c = makeCanvas(S * dpr, S * dpr);
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    g.translate(S / 2, S / 2);
    const rot = rand(0, TAU);
    for (let i = 0; i < 8; i++) petal(g, rot + (i / 8) * TAU + 0.2, 0.5 * D, 0.09 * D, P.sep[0], P.sep[1]);
    const L1 = 0.48 * D;
    for (let i = 0; i < 12; i++) petal(g, rot + (i / 12) * TAU, L1, L1 * 0.15, P.r1[0], P.r1[1]);
    const L2 = 0.48 * D * Math.cos(40 * DEG);
    for (let i = 0; i < 10; i++) petal(g, rot + ((i + 0.5) / 10) * TAU, L2, L2 * 0.17, P.r2[0], P.r2[1]);
    const L3 = 0.48 * D * Math.cos(65 * DEG);
    for (let i = 0; i < 8; i++) petal(g, rot + (i / 8) * TAU + 0.15, L3, L3 * 0.2, P.r3[0], P.r3[1]);
    const sh = g.createRadialGradient(0, 0, 0, 0, 0, 0.25 * D);
    sh.addColorStop(0, 'rgba(90,30,40,0.18)');
    sh.addColorStop(1, 'rgba(90,30,40,0)');
    g.fillStyle = sh;
    g.beginPath();
    g.arc(0, 0, 0.25 * D, 0, TAU);
    g.fill();
    g.fillStyle = '#f1cf62';
    g.beginPath();
    g.arc(0, 0, 0.05 * D, 0, TAU);
    g.fill();
    g.strokeStyle = '#e3a92b';
    g.lineWidth = 0.7;
    g.beginPath();
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * TAU + rand(-0.05, 0.05);
      g.moveTo(Math.cos(a) * 0.055 * D, Math.sin(a) * 0.055 * D);
      g.lineTo(Math.cos(a) * 0.11 * D, Math.sin(a) * 0.11 * D);
    }
    g.stroke();
    g.fillStyle = '#f7da74';
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * TAU;
      g.beginPath();
      g.arc(Math.cos(a) * 0.11 * D, Math.sin(a) * 0.11 * D, 0.9, 0, TAU);
      g.fill();
    }
    const k = 0.2;
    const shc = makeCanvas(S * k, S * k);
    const sg = shc.getContext('2d');
    sg.scale(k, k);
    sg.fillStyle = '#000';
    sg.beginPath();
    sg.arc(S / 2, S / 2, 0.47 * D, 0, TAU);
    sg.fill();
    return { img: c, shadow: shc, S };
  }

  class Lilies {
    constructor(world) {
      const w = world.width;
      const h = world.height;
      const m = Math.min(w, h);
      const mobile = w < 700;
      const k = mobile ? 1.25 : 1;
      const dpr = world.dpr;
      // just a small, quiet cluster in the top-right corner
      const anchors = mobile
        ? [[0.86, 0.15], [0.97, 0.21]]
        : [[0.9, 0.17], [0.975, 0.25], [0.86, 0.28]];
      this.pads = anchors.map(([ax, ay]) => {
        const r = rand(0.045, 0.06) * m * k;
        const sp = renderPad(r, dpr);
        const rot0 = rand(0, TAU);
        return { ax: ax * w, ay: ay * h, x: ax * w, y: ay * h, vx: 0, vy: 0, r, rot: rot0, rot0, rotV: 0, h: 0, sp, dropT: 0 };
      });
      // one crimson water lily
      const D = 0.055 * m * k;
      const pad = this.pads[0];
      this.flower = { pad, ox: 0.15, oy: 0.1, x: pad.x, y: pad.y, sway: 0, sp: renderFlower(D, dpr, 'crimson'), D };
      this.flowers = [this.flower];
      this.bud = null;
    }

    hitPad(x, y) {
      for (const p of this.pads) if (Math.hypot(x - p.x, y - p.y) < p.r * 0.9) return p;
      return null;
    }

    update(dt, world) {
      const P = world.pointer;
      for (const p of this.pads) {
        const s = world.ripples.sample(p.x, p.y, world.time, world.waveC);
        p.h = s.h;
        let ax = s.gx * 900 - (p.x - p.ax) * 0.6 - p.vx * 1.2;
        let ay = s.gy * 900 - (p.y - p.ay) * 0.6 - p.vy * 1.2;
        p.rotV += (-(p.rot - p.rot0) * 0.8 - p.rotV * 1.2) * dt;
        p.dropT -= dt;
        if (P.active && P.speed > 80) {
          const d = Math.hypot(P.x - p.x, P.y - p.y);
          if (d < p.r) {
            const k = Math.min(1, dt * 10);
            p.vx += P.vx * 0.15 * k;
            p.vy += P.vy * 0.15 * k;
            p.rotV += ((P.x - p.x) * P.vy - (P.y - p.y) * P.vx) / (p.r * p.r) * 0.002;
            if (p.dropT <= 0) {
              p.dropT = 0.125;
              const a = Math.atan2(P.y - p.y, P.x - p.x);
              world.drop(p.x + Math.cos(a) * p.r, p.y + Math.sin(a) * p.r, 10, 0.008);
            }
          }
        }
        for (const f of world.fish) {
          if (f.depth > 0.2) continue;
          if (Math.hypot(f.x - p.x, f.y - p.y) < p.r) {
            const k = Math.min(1, dt * 10) * 0.1;
            p.vx += Math.cos(f.angle) * f.speed * k;
            p.vy += Math.sin(f.angle) * f.speed * k;
          }
        }
        p.vx += ax * dt;
        p.vy += ay * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const ox = p.x - p.ax;
        const oy = p.y - p.ay;
        const od = Math.hypot(ox, oy);
        const lim = p.r * 0.25;
        if (od > lim) {
          p.x = p.ax + (ox / od) * lim;
          p.y = p.ay + (oy / od) * lim;
          p.vx *= 0.5;
          p.vy *= 0.5;
        }
        p.rot += p.rotV * dt;
      }
      // flower trails its pad (~0.4 s lag) and sways
      const k = 1 - Math.exp(-dt / 0.4);
      for (const fl of this.flowers) {
        const tx = fl.pad.x + fl.ox * fl.pad.r;
        const ty = fl.pad.y + fl.oy * fl.pad.r;
        fl.x += (tx - fl.x) * k;
        fl.y += (ty - fl.y) * k;
        fl.sway = Math.sin(world.time * 0.8 + fl.D) * 3 * DEG + fl.pad.rotV * 0.3;
      }

      // pellets resting on pads ride along, then slide off
      for (const f of world.food) {
        if (!f.onPad) continue;
        const p = f.onPad;
        f.padT -= dt;
        if (f.slide == null && (f.padT <= 0 || Math.abs(p.h) > 0.02)) f.slide = 0;
        if (f.slide != null) {
          f.slide += dt / 0.6;
          const d = Math.hypot(f.relX, f.relY) || 1;
          const target = p.r * 1.05;
          const cur = lerp(d, target, ease(Math.min(1, f.slide)));
          f.relX = (f.relX / d) * cur;
          f.relY = (f.relY / d) * cur;
          if (f.slide >= 1) {
            f.onPad = null;
            f.slide = null;
            f.x = p.x + f.relX;
            f.y = p.y + f.relY;
            world.drop(f.x, f.y, 7, 0.025);
            continue;
          }
        }
        f.x = p.x + f.relX;
        f.y = p.y + f.relY;
      }
    }

    drawShadows(ctx) {
      ctx.save();
      ctx.globalAlpha = 0.38;
      for (const p of this.pads) {
        const S = p.sp.S;
        ctx.save();
        ctx.translate(p.x + 0.18 * p.r, p.y + 0.26 * p.r);
        ctx.rotate(p.rot);
        ctx.drawImage(p.sp.shadow, -S / 2, -S / 2, S, S);
        ctx.restore();
      }
      ctx.globalAlpha = 0.35;
      for (const fl of this.flowers) ctx.drawImage(fl.sp.shadow, fl.x + 0.12 * fl.D - fl.sp.S / 2, fl.y + 0.17 * fl.D - fl.sp.S / 2, fl.sp.S, fl.sp.S);
      ctx.restore();
    }

    draw(ctx) {
      for (const p of this.pads) {
        const S = p.sp.S;
        const sc = 1 + 0.6 * p.h;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(sc, sc);
        ctx.drawImage(p.sp.img, -S / 2, -S / 2, S, S);
        ctx.restore();
      }
      if (this.bud) {
        const b = this.bud;
        const p = b.pad;
        const x = p.x + Math.cos(p.rot + 1) * p.r * 0.35;
        const y = p.y + Math.sin(p.rot + 1) * p.r * 0.35;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(b.a + p.rot);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(b.len * 0.25, b.len * 0.35, b.len * 0.5, b.wid * 0.5, 0, 0, TAU);
        ctx.fill();
        const g = ctx.createLinearGradient(-b.len / 2, 0, b.len / 2, 0);
        g.addColorStop(0, '#6d7f45');
        g.addColorStop(0.6, '#a67a7e');
        g.addColorStop(1, '#e8a3b5');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-b.len / 2, 0);
        ctx.quadraticCurveTo(-b.len * 0.1, b.wid * 0.6, b.len / 2, 0);
        ctx.quadraticCurveTo(-b.len * 0.1, -b.wid * 0.6, -b.len / 2, 0);
        ctx.fill();
        ctx.restore();
      }
      for (const fl of this.flowers) {
        ctx.save();
        ctx.translate(fl.x, fl.y);
        ctx.rotate(fl.sway);
        ctx.drawImage(fl.sp.img, -fl.sp.S / 2, -fl.sp.S / 2, fl.sp.S, fl.sp.S);
        ctx.restore();
      }
    }
  }

  /* ======================= Red-eared slider ======================= */
  function shellPath(g, Lc, s) {
    const L = Lc * (s || 1);
    g.beginPath();
    g.moveTo(0.5 * L, 0);
    g.bezierCurveTo(0.5 * L, 0.3 * L, 0.2 * L, 0.39 * L, -0.05 * L, 0.39 * L);
    g.bezierCurveTo(-0.3 * L, 0.39 * L, -0.5 * L, 0.25 * L, -0.5 * L, 0);
    g.bezierCurveTo(-0.5 * L, -0.25 * L, -0.3 * L, -0.39 * L, -0.05 * L, -0.39 * L);
    g.bezierCurveTo(0.2 * L, -0.39 * L, 0.5 * L, -0.3 * L, 0.5 * L, 0);
    g.closePath();
  }

  function renderShell(Lc, dpr) {
    const S = Lc * 1.1;
    const c = makeCanvas(S * dpr, S * dpr);
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    g.translate(S / 2, S / 2);
    shellPath(g, Lc);
    const fill = g.createRadialGradient(-0.2 * Lc, -0.25 * Lc, 0, 0, 0, 0.55 * Lc);
    fill.addColorStop(0, '#5d6b34');
    fill.addColorStop(0.65, '#3e4a24');
    fill.addColorStop(1, '#2c3519');
    g.fillStyle = fill;
    g.fill();
    g.save();
    g.clip();
    const L = Lc;
    // yellow squiggles & algae first, seams on top
    g.strokeStyle = 'rgba(184,172,85,0.3)';
    g.lineWidth = 0.9;
    for (let i = 0; i < 16; i++) {
      const x = rand(-0.38, 0.38) * L;
      const y = (Math.random() < 0.5 ? -1 : 1) * rand(0.17, 0.32) * L;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + rand(-0.04, 0.04) * L, y + rand(-0.04, 0.04) * L, x + rand(-0.06, 0.06) * L, y + rand(-0.03, 0.03) * L);
      g.stroke();
    }
    g.fillStyle = 'rgba(110,122,58,0.15)';
    for (let i = 0; i < 26; i++) {
      g.beginPath();
      g.arc(rand(-0.45, 0.45) * L, rand(-0.35, 0.35) * L, rand(0.006, 0.02) * L, 0, TAU);
      g.fill();
    }
    g.strokeStyle = 'rgba(32,40,19,0.6)';
    g.lineWidth = 1;
    // vertebral scutes
    for (let i = 0; i < 5; i++) {
      const x = (0.32 - i * 0.16) * L;
      const hex = (sc) => {
        g.beginPath();
        g.moveTo(x - 0.08 * L * sc, -0.15 * L * sc);
        g.lineTo(x + 0.08 * L * sc, -0.15 * L * sc);
        g.lineTo(x + 0.1 * L * sc, 0);
        g.lineTo(x + 0.08 * L * sc, 0.15 * L * sc);
        g.lineTo(x - 0.08 * L * sc, 0.15 * L * sc);
        g.lineTo(x - 0.1 * L * sc, 0);
        g.closePath();
      };
      hex(1);
      g.stroke();
      g.save();
      g.globalAlpha = 0.15;
      hex(0.6);
      g.stroke();
      g.restore();
    }
    // costal seams radiating to the marginal ring
    for (const side of [1, -1]) {
      for (const xb of [0.24, 0.08, -0.08, -0.24]) {
        g.beginPath();
        g.moveTo(xb * L, side * 0.15 * L);
        g.lineTo((xb * 1.25 - 0.02) * L, side * 0.34 * L);
        g.stroke();
      }
    }
    // marginal ring + ticks
    shellPath(g, Lc, 0.86);
    g.stroke();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      g.beginPath();
      g.moveTo(Math.cos(a) * 0.43 * L * 0.86 * 1.02, Math.sin(a) * 0.34 * L);
      g.lineTo(Math.cos(a) * 0.5 * L, Math.sin(a) * 0.39 * L);
      g.stroke();
    }
    const hl = g.createRadialGradient(-0.25 * L, -0.25 * L, 0, -0.25 * L, -0.25 * L, 0.35 * L);
    hl.addColorStop(0, 'rgba(255,255,230,0.12)');
    hl.addColorStop(1, 'rgba(255,255,230,0)');
    g.fillStyle = hl;
    g.fillRect(-L, -L, 2 * L, 2 * L);
    g.restore();
    shellPath(g, Lc);
    g.strokeStyle = 'rgba(20,26,12,0.7)';
    g.lineWidth = 1.2;
    g.stroke();
    return { img: c, S };
  }

  class Turtle {
    constructor(world) {
      const w = world.width;
      const h = world.height;
      const m = Math.min(w, h);
      this.mobile = w < 700;
      const k = this.mobile ? 1.25 : 1;
      this.Lc = 0.11 * m * k;
      this.L = this.Lc * 1.4;
      this.x = (this.mobile ? 0.5 : 0.6) * w;
      this.y = (this.mobile ? 0.3 : 0.45) * h;
      this.angle = rand(-Math.PI, Math.PI);
      this.v = 0;
      this.depth = 0.75;
      this.depthGoal = 0.75;
      this.state = 'CRUISE';
      this.breathT = 6;
      this.phi = 0;
      this.period = 1.1;
      this.bout = 3;
      this.glide = 0;
      this.neck = 0.08;
      this.neckGoal = 0.08;
      this.fear = 0;
      this.fleeA = 0;
      this.headTurn = 0;
      this.snoutA = 0;
      this.wakeT = 0;
      this.holdT = 0;
      this.breathDropT = 0;
      this.bubbles = [];
      this.wp = null;
      this.lastP = 0;
      this.shell = renderShell(this.Lc, world.dpr);
    }

    get snout() {
      const d = (0.5 + this.neck + 0.22) * this.Lc;
      return { x: this.x + Math.cos(this.angle + this.headTurn * 0.3) * d, y: this.y + Math.sin(this.angle + this.headTurn * 0.3) * d };
    }

    _pickWaypoint(world) {
      const w = world.width;
      const h = world.height;
      for (let i = 0; i < 12; i++) {
        const x = this.mobile ? rand(0.2, 0.85) * w : rand(0.45, 0.85) * w;
        const y = this.mobile ? rand(0.12, 0.48) * h : rand(0.15, 0.75) * h;
        if (!inRect(world.textRect, x, y, 40)) return { x, y };
      }
      return { x: 0.7 * w, y: 0.3 * h };
    }

    dive(world) {
      const fx = Math.cos(this.angle);
      const fy = Math.sin(this.angle);
      world.drop(this.x - fx * 0.4 * this.Lc, this.y - fy * 0.4 * this.Lc, 0.5 * this.Lc, -0.02);
      world.drop(this.x + fx * 0.35 * this.Lc, this.y + fy * 0.35 * this.Lc, 0.35 * this.Lc, 0.012);
      const s = this.snout;
      for (let i = 0; i < 3; i++) this.bubbles.push({ x: s.x + rand(-6, 6), y: s.y + rand(-6, 6), delay: i * 0.33, t: 0, done: false });
      this.state = 'CRUISE';
      this.breathT = rand(28, 45);
      this.depthGoal = rand(0.6, 0.85);
      this.bout = 3;
      this.glide = 0;
    }

    update(dt, world) {
      const P = world.pointer;
      const Lc = this.Lc;
      const w = world.width;
      const h = world.height;
      let dx = 0;
      let dy = 0;
      let rateK = 1;
      let impK = 0.5;
      this.neckGoal = 0.08;
      let turnTarget = 0;

      // fright
      if (P.active && P.speed > 650 && Math.hypot(P.x - this.x, P.y - this.y) < 3 * Lc) {
        if (this.fear < 0.5) {
          this.bout = 4;
          this.glide = 0;
        }
        this.fear = 1;
        this.fleeA = Math.atan2(this.y - P.y, this.x - P.x);
        if (this.state === 'SURFACE' || this.state === 'ASCEND') this.dive(world);
      }
      const clk = world.lastClick;
      if (clk && world.time - clk.t < 0.05 && Math.hypot(clk.x - this.x, clk.y - this.y) < 1.5 * Lc && this.fear < 0.5) {
        this.fear = 0.8;
        this.fleeA = Math.atan2(this.y - clk.y, this.x - clk.x);
        this.bout = 3;
        this.glide = 0;
        if (this.state === 'SURFACE') this.dive(world);
      }
      this.fear = Math.max(0, this.fear - dt * 0.35);

      if (this.fear > 0.3) {
        dx += Math.cos(this.fleeA) * 3;
        dy += Math.sin(this.fleeA) * 3;
        this.depthGoal = 0.9;
        this.neckGoal = 0;
        rateK = 1.8;
        impK = 1.0;
      } else {
        // food
        let pellet = null;
        let bd = 0.35 * Math.max(w, h);
        const s = this.snout;
        for (const f of world.food) {
          if (f.eaten || !f.landed || f.onPad) continue;
          const d = Math.hypot(f.x - s.x, f.y - s.y);
          if (d < bd) {
            bd = d;
            pellet = f;
          }
        }
        if (pellet && this.state !== 'SURFACE') {
          dx += (pellet.x - s.x) / bd;
          dy += (pellet.y - s.y) / bd;
          this.depthGoal = 0;
          rateK = 1.6;
          if (bd < 0.25 * Lc) this.neckGoal = 0.2;
          if (bd < 0.12 * Lc + 4 && this.depth < 0.15) {
            pellet.eaten = true;
            world.drop(pellet.x, pellet.y, 8, -0.03);
            world.drop(pellet.x, pellet.y, 6, 0.02);
          }
        } else if (P.active && P.still > 1.5 && Math.hypot(P.x - this.x, P.y - this.y) < 300 && this.state === 'CRUISE') {
          const d = Math.hypot(P.x - this.x, P.y - this.y) || 1;
          if (d > 0.8 * Lc) {
            dx += (P.x - this.x) / d;
            dy += (P.y - this.y) / d;
            impK = 0.25;
          } else {
            this.bout = 0;
          }
          this.depthGoal = 0.3;
          turnTarget = clamp(wrap(Math.atan2(P.y - this.y, P.x - this.x) - this.angle), -0.5, 0.5);
        } else {
          if (!this.wp || Math.hypot(this.wp.x - this.x, this.wp.y - this.y) < Lc) this.wp = this._pickWaypoint(world);
          const d = Math.hypot(this.wp.x - this.x, this.wp.y - this.y) || 1;
          dx += (this.wp.x - this.x) / d;
          dy += (this.wp.y - this.y) / d;
        }
      }

      // give way to koi near the same depth
      for (const f of world.fish) {
        const d = Math.hypot(f.x - this.x, f.y - this.y) || 1;
        if (d < 0.5 * f.L + 0.5 * Lc && Math.abs(f.depth - this.depth) < 0.3) {
          dx -= ((f.x - this.x) / d) * 1.5;
          dy -= ((f.y - this.y) / d) * 1.5;
        }
      }
      // stay in the pond; stay out from under the copy unless deep
      const mg = Lc;
      if (this.x < mg) dx += 2;
      if (this.x > w - mg) dx -= 2;
      if (this.y < mg) dy += 2;
      if (this.y > h - mg) dy -= 2;
      if (this.depth < 0.6 && inRect(world.textRect, this.x, this.y, 20)) {
        dx += 1.5;
        dy -= 1;
      }

      // breathing cycle
      if (this.state === 'CRUISE') {
        this.breathT -= dt;
        if (this.breathT <= 0 && this.fear < 0.3 && !inRect(world.textRect, this.x, this.y, 40) && (!this.mobile || this.y < 0.5 * h)) {
          this.state = 'ASCEND';
        }
      }
      if (this.state === 'ASCEND') {
        this.depthGoal = 0;
        if (this.depth < 0.03) {
          this.state = 'SURFACE';
          this.holdT = rand(3, 5);
          this.breathDropT = 0.9;
          const s = this.snout;
          world.drop(s.x, s.y, 9, 0.02);
        }
      }
      if (this.state === 'SURFACE') {
        this.depthGoal = 0;
        this.bout = 0;
        this.glide = 1;
        this.v *= Math.exp(-2 * dt);
        this.holdT -= dt;
        this.breathDropT -= dt;
        turnTarget = Math.sin(world.time * 0.7) * 0.3;
        if (this.breathDropT <= 0) {
          this.breathDropT = 0.9;
          const s = this.snout;
          world.drop(s.x, s.y, 5, 0.005);
        }
        if (this.holdT <= 0) this.dive(world);
        dx = Math.cos(this.angle);
        dy = Math.sin(this.angle);
      }
      this.snoutA = clamp(this.snoutA + (this.state === 'SURFACE' ? 1 : -1) * (dt / 0.3), 0, 1);

      // steering
      const desired = Math.atan2(dy, dx);
      const diff = wrap(desired - this.angle);
      const maxT = 0.9 * (this.fear > 0.3 ? 2 : 1);
      this.angle = wrap(this.angle + clamp(diff * 1.5, -maxT, maxT) * dt);
      this.headTurn += (turnTarget - this.headTurn) * Math.min(1, dt * 3);
      this.neck += (this.neckGoal - this.neck) * Math.min(1, dt / 0.15);

      // paddling: bouts of diagonal strokes, then glides
      this.period = (this.fear > 0.3 ? 0.6 : 1.1) / rateK;
      if (this.bout > 0) {
        const prevP = (this.phi / TAU) % 1;
        this.phi += (TAU * dt) / this.period;
        const p = (this.phi / TAU) % 1;
        const p2 = (p + 0.5) % 1;
        const prevP2 = (prevP + 0.5) % 1;
        if (p < 0.4) this.v += (impK * Lc * dt) / (0.4 * this.period);
        if (p2 < 0.4) this.v += (impK * Lc * dt) / (0.4 * this.period) * 0.6;
        if (p < prevP) {
          this.bout--;
          if (this.bout <= 0) this.glide = rand(1.5, 4);
        }
        if (this.depth < 0.2 && ((p < prevP) || (p2 < prevP2))) {
          const side = p < prevP ? 1 : -1;
          const fx = Math.cos(this.angle);
          const fy = Math.sin(this.angle);
          world.drop(this.x + fx * 0.3 * Lc - fy * side * 0.6 * Lc, this.y + fy * 0.3 * Lc + fx * side * 0.6 * Lc, Math.max(5, 0.1 * Lc), -0.004);
        }
      } else if (this.state !== 'SURFACE') {
        this.glide -= dt;
        if (this.glide <= 0) this.bout = 2 + Math.floor(Math.random() * 3);
      }
      this.v *= Math.exp(-0.7 * dt);
      this.x += Math.cos(this.angle) * this.v * dt;
      this.y += Math.sin(this.angle) * this.v * dt;
      this.x = clamp(this.x, 0, w);
      this.y = clamp(this.y, 0, h);
      this.depth += clamp(this.depthGoal - this.depth, -dt / 3, dt / 3);

      // surface wake
      if (this.depth < 0.15 && this.v > 0.1 * Lc) {
        this.wakeT -= dt;
        if (this.wakeT <= 0) {
          this.wakeT = 1 / 20;
          const s = this.snout;
          world.drop(s.x + Math.cos(this.angle) * 0.1 * Lc, s.y + Math.sin(this.angle) * 0.1 * Lc, 0.25 * Lc, (0.003 * this.v) / Lc);
        }
      }
      // bubbles after a dive
      for (const b of this.bubbles) {
        if (b.delay > 0) {
          b.delay -= dt;
          continue;
        }
        b.t += dt;
        if (b.t > 0.5 && !b.done) {
          b.done = true;
          world.drop(b.x, b.y, 5, 0.007);
        }
      }
      this.bubbles = this.bubbles.filter((b) => b.t < 0.6);

      world.obstacles.push({ x: this.x, y: this.y, r: 0.6 * Lc, depth: this.depth });
    }

    _limb(ctx, ax, ay, ang, len, side, front, skin, stripe) {
      const dxl = Math.cos(ang);
      const dyl = side * Math.sin(ang);
      const px = -dyl;
      const py = dxl;
      const bw = this.Lc * (front ? 0.075 : 0.08);
      const tx = ax + dxl * len;
      const ty = ay + dyl * len;
      ctx.beginPath();
      ctx.moveTo(ax + px * bw, ay + py * bw);
      ctx.quadraticCurveTo(ax + dxl * len * 0.6 + px * bw * (front ? 1.2 : 1.6), ay + dyl * len * 0.6 + py * bw * (front ? 1.2 : 1.6), tx + px * bw * 0.4, ty + py * bw * 0.4);
      ctx.quadraticCurveTo(tx + dxl * bw * 0.8, ty + dyl * bw * 0.8, tx - px * bw * 0.5, ty - py * bw * 0.5);
      ctx.quadraticCurveTo(ax + dxl * len * 0.5 - px * bw * 0.9, ay + dyl * len * 0.5 - py * bw * 0.9, ax - px * bw, ay - py * bw);
      ctx.closePath();
      ctx.fillStyle = skin;
      ctx.fill();
      ctx.strokeStyle = stripe;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax + dxl * len * 0.8, ay + dyl * len * 0.8);
      ctx.stroke();
      if (front) {
        ctx.strokeStyle = 'rgba(216,207,160,0.8)';
        ctx.beginPath();
        for (let i = -1; i <= 1; i++) {
          const cx = tx + px * bw * 0.3 * i;
          const cy = ty + py * bw * 0.3 * i;
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + dxl * this.Lc * 0.03, cy + dyl * this.Lc * 0.03);
        }
        ctx.stroke();
      }
    }

    draw(ctx) {
      const Lc = this.Lc;
      const d = this.depth;
      const skin = tintHex('#3f4a29', d);
      const stripe = tintHex('#d4c45a', d);
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.lineCap = 'round';

      // limbs (diagonal pairs)
      const pA = ((this.phi / TAU) % 1 + 1) % 1;
      const pB = (pA + 0.5) % 1;
      const paddling = this.bout > 0;
      const pose = (p, front) => {
        if (!paddling) return [front ? 150 * DEG : 170 * DEG, 0.9];
        if (p < 0.4) return [lerp(30, 150, p / 0.4) * DEG, 1];
        return [lerp(150, 30, (p - 0.4) / 0.6) * DEG, 0.7];
      };
      // roots sit well inside the shell outline so the shell overlaps them
      const limbs = [
        [0.22, 0.24, 1, true, pA], [0.22, 0.24, -1, true, pB],
        [-0.27, 0.22, -1, false, pA], [-0.27, 0.22, 1, false, pB],
      ];
      for (const [lx, ly, side, front, p] of limbs) {
        const [ang, lk] = pose(p, front);
        this._limb(ctx, lx * Lc, side * ly * Lc, front ? ang : Math.max(ang, 60 * DEG), (front ? 0.48 : 0.38) * Lc * lk, side, front, skin, stripe);
      }
      // tail
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.moveTo(-0.4 * Lc, -0.05 * Lc);
      ctx.lineTo(-0.62 * Lc, 0);
      ctx.lineTo(-0.4 * Lc, 0.05 * Lc);
      ctx.closePath();
      ctx.fill();
      // neck + head
      const hx = (0.5 + this.neck + 0.1) * Lc;
      ctx.fillStyle = skin;
      ctx.fillRect(0.3 * Lc, -0.07 * Lc, (this.neck + 0.3) * Lc, 0.14 * Lc);
      ctx.save();
      ctx.translate(hx, 0);
      ctx.rotate(this.headTurn);
      ctx.beginPath();
      ctx.ellipse(0, 0, 0.13 * Lc, 0.1 * Lc, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = stripe;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (const yy of [-0.06, -0.025, 0.025, 0.06]) {
        ctx.moveTo(-0.12 * Lc, yy * Lc);
        ctx.quadraticCurveTo(0, yy * 0.8 * Lc, 0.1 * Lc, yy * 0.4 * Lc);
      }
      ctx.moveTo(-0.1 * Lc, 0);
      ctx.lineTo(0.12 * Lc, 0);
      ctx.stroke();
      ctx.fillStyle = tintHex('#c8402a', d);
      for (const s of [1, -1]) {
        ctx.beginPath();
        ctx.ellipse(-0.05 * Lc, s * 0.085 * Lc, 0.04 * Lc, 0.016 * Lc, 0, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = tintHex('#c9a54a', d);
      for (const s of [1, -1]) {
        ctx.beginPath();
        ctx.arc(0.04 * Lc, s * 0.08 * Lc, 0.025 * Lc, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#111';
      for (const s of [1, -1]) ctx.fillRect(0.04 * Lc - 0.02 * Lc, s * 0.08 * Lc - 0.005 * Lc, 0.04 * Lc, 0.01 * Lc);
      ctx.restore();

      // shell
      const S = this.shell.S;
      ctx.drawImage(this.shell.img, -S / 2, -S / 2, S, S);
      if (d > 0.02) {
        shellPath(ctx, Lc);
        ctx.fillStyle = `rgba(6,28,40,${d * 0.55})`;
        ctx.fill();
      }
      ctx.restore();
    }

    drawShadow(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      shellPath(ctx, this.Lc * 1.05);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse((0.6 + this.neck) * this.Lc, 0, 0.16 * this.Lc, 0.1 * this.Lc, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    /** Above-water bits: breaking snout, meniscus ring, rising bubbles. */
    drawSurface(ctx) {
      if (this.snoutA > 0) {
        const s = this.snout;
        const a = this.angle + this.headTurn;
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(a);
        ctx.globalAlpha = this.snoutA;
        ctx.strokeStyle = 'rgba(220,240,240,0.28)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(-0.04 * this.Lc, 0, 0.1 * this.Lc, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = '#46512d';
        ctx.beginPath();
        ctx.ellipse(-0.04 * this.Lc, 0, 0.06 * this.Lc, 0.05 * this.Lc, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,240,0.45)';
        ctx.beginPath();
        ctx.ellipse(-0.05 * this.Lc, -0.015 * this.Lc, 0.025 * this.Lc, 0.012 * this.Lc, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      for (const b of this.bubbles) {
        if (b.delay > 0) continue;
        const u = clamp(b.t / 0.5, 0, 1);
        ctx.strokeStyle = `rgba(230,245,245,${0.5 * (1 - u)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(b.x, b.y, lerp(1.5, 4, u), 0, TAU);
        ctx.stroke();
      }
    }
  }

  /* ======================= Dragonfly ======================= */
  function renderWing(len, wid, hind, dpr) {
    const c = makeCanvas(len * dpr + 2, wid * 2 * dpr + 2);
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    g.translate(0, wid);
    // leading edge is −y
    g.beginPath();
    g.moveTo(0, -wid * 0.15);
    g.quadraticCurveTo(len * 0.5, -wid * 0.6, len * 0.97, -wid * 0.35);
    g.quadraticCurveTo(len * 1.02, 0, len * 0.9, wid * 0.35);
    g.quadraticCurveTo(len * 0.45, wid * (hind ? 0.75 : 0.5), 0, wid * (hind ? 0.55 : 0.2));
    g.closePath();
    g.fillStyle = 'rgba(232,240,245,0.13)';
    g.fill();
    if (hind) {
      const am = g.createRadialGradient(0, 0, 0, 0, 0, len * 0.3);
      am.addColorStop(0, 'rgba(216,162,74,0.18)');
      am.addColorStop(1, 'rgba(216,162,74,0)');
      g.fillStyle = am;
      g.fill();
    }
    g.strokeStyle = 'rgba(200,210,215,0.12)';
    g.lineWidth = 0.4;
    g.stroke();
    g.strokeStyle = 'rgba(90,70,45,0.55)';
    g.lineWidth = 0.6;
    g.beginPath();
    g.moveTo(0, -wid * 0.15);
    g.quadraticCurveTo(len * 0.5, -wid * 0.6, len * 0.97, -wid * 0.35);
    g.stroke();
    g.strokeStyle = 'rgba(90,70,45,0.18)';
    g.beginPath();
    for (let i = 1; i < 4; i++) {
      g.moveTo(0, -wid * 0.1 + i * wid * 0.12);
      g.quadraticCurveTo(len * 0.5, -wid * 0.3 + i * wid * 0.15, len * 0.9, -wid * 0.2 + i * wid * 0.12);
    }
    g.stroke();
    g.fillStyle = '#4a2e1c';
    g.beginPath();
    g.ellipse(len * 0.86, -wid * 0.38, len * 0.035, wid * 0.08, 0.1, 0, TAU);
    g.fill();
    return { img: c, len, wid };
  }

  class Dragonfly {
    constructor(world) {
      const m = Math.min(world.width, world.height);
      this.mobile = world.width < 700;
      const k = this.mobile ? 1.25 : 1;
      this.b = 0.036 * m * k;
      this.span = 0.062 * m * k;
      this.fore = renderWing(this.span * 0.5 * 0.85 / 0.85, this.b * 0.16, false, world.dpr);
      this.hind = renderWing(this.span * 0.5 * 0.8 / 0.85, this.b * 0.24, true, world.dpr);
      this.state = 'AWAY';
      this.t = 14;
      this.x = -100;
      this.y = -100;
      this.a = 0;
      this.h = 0.8;
      this.flying = true;
      this.jx = 0;
      this.jy = 0;
      this.stayT = 0;
      this.mode = 'none';
      this.taps = 0;
      this.tapT = 0;
      this.reactCD = 0;
    }

    _area(world) {
      const w = world.width;
      const h = world.height;
      for (let i = 0; i < 12; i++) {
        const x = this.mobile ? rand(0.12, 0.88) * w : rand(0.45, 0.95) * w;
        const y = this.mobile ? rand(0.1, 0.45) * h : rand(0.08, 0.6) * h;
        if (!inRect(world.textRect, x, y, 40)) return [x, y];
      }
      return [0.7 * w, 0.2 * h];
    }

    _flyTo(x, y, dur, next) {
      this.from = [this.x, this.y];
      this.to = [x, y];
      const mx = (this.x + x) / 2;
      const my = (this.y + y) / 2;
      const d = Math.hypot(x - this.x, y - this.y);
      const n = [-(y - this.y) / (d || 1), (x - this.x) / (d || 1)];
      const bend = rand(-0.25, 0.25) * d;
      this.ctrl = [mx + n[0] * bend, my + n[1] * bend];
      this.u = 0;
      this.dur = dur;
      this.next = next;
      this.state = 'FLY';
    }

    _leave(world) {
      const w = world.width;
      const h = world.height;
      const exits = [[-80, this.y], [w + 80, this.y], [this.x, -80]];
      const e = exits.reduce((a, b) => (Math.hypot(a[0] - this.x, a[1] - this.y) < Math.hypot(b[0] - this.x, b[1] - this.y) ? a : b));
      this.flying = true;
      this._flyTo(e[0], e[1], 1.2, 'AWAY');
    }

    _dart(world, x, y) {
      let tx = x;
      let ty = y;
      if (tx == null) {
        const m = Math.min(world.width, world.height);
        for (let i = 0; i < 10; i++) {
          const a = rand(0, TAU);
          const r = rand(0.08, 0.2) * m;
          tx = this.x + Math.cos(a) * r;
          ty = this.y + Math.sin(a) * r;
          const [ax, ay] = this._area(world);
          if (Math.hypot(tx - ax, ty - ay) < 0.5 * m && tx > 30 && tx < world.width - 30 && ty > 30 && ty < world.height - 30 && !inRect(world.textRect, tx, ty, 40)) break;
          tx = ax;
          ty = ay;
        }
      }
      this._flyTo(tx, ty, rand(0.15, 0.3), 'HOVER');
    }

    update(dt, world, lilies) {
      const P = world.pointer;
      const m = Math.min(world.width, world.height);
      this.reactCD -= dt;
      const here = this.state !== 'AWAY';

      // reactions
      if (here && this.state !== 'FLY' && this.reactCD <= 0) {
        const pd = Math.hypot(P.x - this.x, P.y - this.y);
        const clk = world.lastClick;
        if (clk && world.time - clk.t < 0.05 && Math.hypot(clk.x - this.x, clk.y - this.y) < 0.2 * m) {
          this._leave(world);
          return;
        }
        if (P.active && P.speed > 500 && pd < 0.15 * m) {
          this.reactCD = 0.6;
          this.flying = true;
          this._dart(world);
          return;
        }
        if (P.active && P.still > 1.2 && pd < 0.25 * m && pd > 30) {
          this.reactCD = 4;
          const a = Math.atan2(this.y - P.y, this.x - P.x);
          this.flying = true;
          this._flyTo(P.x + Math.cos(a) * 40, P.y + Math.sin(a) * 40, 0.3, 'WATCH');
          this.watch = [P.x, P.y];
          return;
        }
      }

      switch (this.state) {
        case 'AWAY':
          this.t -= dt;
          if (this.t <= 0) {
            const w = world.width;
            const h = world.height;
            const start = Math.random() < 0.5 ? [w + 60, rand(0.05, 0.4) * h] : [rand(0.5, 1) * w, -60];
            this.x = start[0];
            this.y = start[1];
            const [tx, ty] = this._area(world);
            this.stayT = rand(12, 25);
            const r = Math.random();
            this.mode = r < 0.3 ? 'ovi' : r < 0.6 && lilies ? 'perch' : 'none';
            this.h = 0.8;
            this.flying = true;
            this._flyTo(tx, ty, 1.5, 'HOVER');
          }
          break;
        case 'FLY': {
          this.u += dt / this.dur;
          const u = this.dur > 1 ? this.u : ease(Math.min(1, this.u));
          const k = Math.min(1, u);
          const q = 1 - k;
          const nx = q * q * this.from[0] + 2 * q * k * this.ctrl[0] + k * k * this.to[0];
          const ny = q * q * this.from[1] + 2 * q * k * this.ctrl[1] + k * k * this.to[1];
          const tgt = Math.atan2(ny - this.y, nx - this.x);
          if (Math.hypot(nx - this.x, ny - this.y) > 0.3) this.a += wrap(tgt - this.a) * Math.min(1, dt / 0.08);
          this.x = nx;
          this.y = ny;
          if (this.u >= 1) {
            this.state = this.next;
            if (this.state === 'AWAY') this.t = this.mobile ? rand(40, 80) : rand(25, 60);
            if (this.state === 'HOVER') this.t = rand(0.6, 1.8);
            if (this.state === 'WATCH') this.t = 1.5;
            if (this.state === 'PERCH') {
              this.t = rand(4, 10);
              this.flying = false;
            }
          }
          break;
        }
        case 'WATCH':
          this.t -= dt;
          if (this.watch) this.a += wrap(Math.atan2(this.watch[1] - this.y, this.watch[0] - this.x) - this.a) * Math.min(1, dt * 8);
          if (this.t <= 0) this._dart(world);
          break;
        case 'HOVER':
          this.t -= dt;
          this.stayT -= dt;
          if (this.t <= 0) {
            if (this.stayT <= 0) {
              if (this.mode === 'ovi') {
                this.mode = 'none';
                this.taps = 3 + Math.floor(Math.random() * 4);
                this.tapT = 0;
                this.state = 'OVI';
              } else if (this.mode === 'perch' && lilies) {
                this.mode = 'none';
                const f = lilies.flower;
                this._flyTo(f.x + f.D * 0.25, f.y - f.D * 0.1, 0.6, 'PERCH');
              } else this._leave(world);
            } else this._dart(world);
          }
          break;
        case 'OVI':
          this.tapT -= dt;
          if (this.tapT <= 0) {
            if (this.taps <= 0) {
              this.h = 0.8;
              this._leave(world);
              break;
            }
            this.taps--;
            this.tapT = 0.35;
            this.x += Math.cos(this.a) * 15;
            this.y += Math.sin(this.a) * 15;
            this.dipT = 0.08;
            const tip = this.abdTip();
            world.drop(tip[0], tip[1], 5, 0.008);
          }
          break;
        case 'PERCH':
          this.t -= dt;
          if (lilies) {
            const f = lilies.flower;
            this.x += (f.x + f.D * 0.25 - this.x) * Math.min(1, dt * 4);
            this.y += (f.y - f.D * 0.1 - this.y) * Math.min(1, dt * 4);
          }
          if (this.t <= 0) {
            this.flying = true;
            this.h = 0.8;
            this._dart(world);
          }
          break;
      }
      // height
      let hGoal = this.state === 'PERCH' ? 0.15 : 0.8;
      if (this.dipT > 0) {
        this.dipT -= dt;
        hGoal = 0;
      } else if (this.state === 'OVI') hGoal = 0.35;
      this.h += (hGoal - this.h) * Math.min(1, dt * (this.state === 'OVI' ? 25 : 4));
      // hover jitter
      if (this.flying && this.state !== 'FLY') {
        this.jx = Math.sin(world.time * 7 * TAU) * 1.5;
        this.jy = Math.cos(world.time * 5.3 * TAU) * 1.5;
      } else {
        this.jx = 0;
        this.jy = 0;
      }
    }

    abdTip() {
      return [this.x - Math.cos(this.a) * 0.42 * this.b, this.y - Math.sin(this.a) * 0.42 * this.b];
    }

    _body(ctx, shadow) {
      const b = this.b;
      // wings
      const wingSet = [[this.fore, 0.33, 78], [this.hind, 0.25, 100]];
      const copies = this.flying ? [[0, 0.35], [14, 0.25], [-14, 0.15]] : [[0, 1]];
      const tremble = this.flying ? 0 : Math.sin(Date.now() / 60) * 2;
      for (const [wing, rx, ang] of wingSet) {
        for (const side of [1, -1]) {
          for (const [off, al] of copies) {
            ctx.save();
            ctx.translate(rx * b, 0);
            const th = (ang + off + tremble) * DEG;
            ctx.rotate(side * th);
            if (side < 0) ctx.scale(1, -1);
            ctx.globalAlpha = shadow ? al * 0.6 : al;
            if (shadow) {
              ctx.fillStyle = '#000';
              ctx.beginPath();
              ctx.ellipse(wing.len * 0.5, 0, wing.len * 0.5, wing.wid * 0.45, 0, 0, TAU);
              ctx.fill();
            } else ctx.drawImage(wing.img, 0, -wing.wid, wing.len, wing.wid * 2);
            ctx.restore();
          }
        }
      }
      ctx.globalAlpha = 1;
      // abdomen
      ctx.beginPath();
      ctx.moveTo(0.2 * b, -0.035 * b);
      ctx.lineTo(-0.42 * b, -0.0175 * b);
      ctx.quadraticCurveTo(-0.45 * b, 0, -0.42 * b, 0.0175 * b);
      ctx.lineTo(0.2 * b, 0.035 * b);
      ctx.closePath();
      if (shadow) {
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(0.32 * b, 0, 0.18 * b, 0.1 * b, 0, 0, TAU);
        ctx.fill();
        return;
      }
      const ag = ctx.createLinearGradient(0.2 * b, 0, -0.42 * b, 0);
      ag.addColorStop(0, '#d9a24e');
      ag.addColorStop(1, '#a8642a');
      ctx.fillStyle = ag;
      ctx.fill();
      ctx.strokeStyle = 'rgba(50,25,10,0.45)';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (let i = 1; i <= 8; i++) {
        const x = lerp(0.2, -0.42, i / 9) * b;
        const hw = lerp(0.035, 0.0175, i / 9) * b;
        ctx.moveTo(x, -hw);
        ctx.lineTo(x, hw);
      }
      ctx.moveTo(0.2 * b, 0);
      ctx.lineTo(-0.42 * b, 0);
      ctx.stroke();
      // thorax
      ctx.fillStyle = '#8c5c2a';
      ctx.beginPath();
      ctx.ellipse(0.3 * b, 0, 0.1 * b, 0.065 * b, 0, 0, TAU);
      ctx.fill();
      // eyes
      ctx.fillStyle = '#7a4a24';
      for (const s of [1, -1]) {
        ctx.beginPath();
        ctx.arc(0.45 * b, s * 0.06 * b, 0.07 * b, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,240,210,0.5)';
      for (const s of [1, -1]) {
        ctx.beginPath();
        ctx.arc(0.47 * b, s * 0.06 * b - 0.02 * b, 0.018 * b, 0, TAU);
        ctx.fill();
      }
    }

    draw(ctx) {
      if (this.state === 'AWAY') return;
      const sc = 1 + 0.15 * this.h;
      const off = 6 + 50 * this.h;
      // shadow on the water
      ctx.save();
      ctx.globalAlpha = 0.28 * (1 - 0.5 * this.h);
      ctx.translate(this.x + 0.6 * off, this.y + 0.8 * off);
      ctx.rotate(this.a);
      ctx.save();
      ctx.globalAlpha *= 1;
      const ga = ctx.globalAlpha;
      ctx.globalAlpha = ga;
      this._shadowAlpha = ga;
      ctx.restore();
      ctx.globalAlpha = 0.28 * (1 - 0.5 * this.h);
      this._bodyShadow(ctx);
      ctx.restore();

      ctx.save();
      ctx.translate(this.x + this.jx, this.y + this.jy);
      ctx.rotate(this.a);
      ctx.scale(sc, sc);
      this._body(ctx, false);
      ctx.restore();
    }

    _bodyShadow(ctx) {
      const base = ctx.globalAlpha;
      const b = this.b;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(0, 0, 0.45 * b, 0.04 * b, 0, 0, TAU);
      ctx.ellipse(0.33 * b, 0, 0.12 * b, 0.08 * b, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = base * 0.5;
      for (const [len, rx, ang] of [[this.fore.len, 0.33, 78], [this.hind.len, 0.25, 100]]) {
        for (const side of [1, -1]) {
          const th = side * ang * DEG;
          ctx.beginPath();
          ctx.ellipse(rx * b + Math.cos(th) * len * 0.5, Math.sin(th) * len * 0.5, len * 0.5, b * 0.07, th, 0, TAU);
          ctx.fill();
        }
      }
      ctx.globalAlpha = base;
    }
  }

  /* ======================= Assembly ======================= */
  function createLife(world, reducedMotion) {
    const w = world.width;
    const h = world.height;
    const m = Math.min(w, h);
    const mobile = w < 700;
    const k = mobile ? 1.25 : 1;
    const lilies = new Lilies(world);
    const turtle = new Turtle(world);

    const dragonfly = reducedMotion ? null : new Dragonfly(world);
    return { lilies, turtle, dragonfly };
  }

  window.MFH = window.MFH || {};
  window.MFH.RippleLog = RippleLog;
  window.MFH.createLife = createLife;
})();
