/* ==========================================================================
   Overhanging pothos leaves — pre-rendered sprites on damped springs.
   They sway in a light breeze and get knocked by a passing hand.
   ========================================================================== */
(function () {
  'use strict';

  const rand = (a, b) => a + Math.random() * (b - a);

  function leafShape(g, s, asym) {
    // Leaf points "up" (−y); stem attaches at (0,0); tip at (0,−s)
    const a = asym;
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(-0.22 * s, 0.13 * s, -0.62 * s * a, 0.06 * s, -0.6 * s * a, -0.3 * s);
    g.bezierCurveTo(-0.57 * s * a, -0.62 * s, -0.2 * s, -0.86 * s, 0.03 * s, -1.0 * s);
    g.bezierCurveTo(0.2 * s, -0.84 * s, 0.56 * s / a, -0.62 * s, 0.58 * s / a, -0.3 * s);
    g.bezierCurveTo(0.6 * s / a, 0.06 * s, 0.22 * s, 0.13 * s, 0, 0);
    g.closePath();
  }

  function renderLeaf(size, dpr) {
    const pad = 0.2 * size;
    const W = Math.ceil((size * 1.4 + pad * 2) * dpr);
    const H = Math.ceil((size * 1.25 + pad * 2) * dpr);
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    const ox = size * 0.7 + pad;
    const oy = size * 1.05 + pad;
    g.translate(ox, oy);
    const asym = rand(0.92, 1.08);

    leafShape(g, size, asym);
    const fill = g.createLinearGradient(-size * 0.6, -size * 0.2, size * 0.6, -size * 0.8);
    const hue = rand(-6, 8);
    fill.addColorStop(0, `hsl(${98 + hue}, 48%, 13%)`);
    fill.addColorStop(0.5, `hsl(${86 + hue}, 50%, 25%)`);
    fill.addColorStop(1, `hsl(${76 + hue}, 52%, 36%)`);
    g.fillStyle = fill;
    g.fill();

    g.save();
    g.clip();

    // Golden pothos variegation streaks
    g.globalAlpha = rand(0.1, 0.2);
    for (let i = 0; i < 7; i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const y0 = -rand(0.15, 0.85) * size;
      g.strokeStyle = `hsl(${58 + rand(-6, 6)}, 70%, ${rand(62, 75)}%)`;
      g.lineWidth = rand(0.01, 0.04) * size;
      g.beginPath();
      g.moveTo(0, y0);
      g.quadraticCurveTo(side * 0.25 * size, y0 - 0.05 * size, side * rand(0.35, 0.6) * size, y0 - rand(0.1, 0.25) * size);
      g.stroke();
    }
    g.globalAlpha = 1;

    // Fold shading — one half catches less light
    g.fillStyle = 'rgba(8,24,6,0.22)';
    g.beginPath();
    g.moveTo(0, 0.1 * size);
    g.quadraticCurveTo(0.04 * size, -0.5 * size, 0.03 * size, -1.05 * size);
    g.lineTo(-size, -1.05 * size);
    g.lineTo(-size, 0.2 * size);
    g.closePath();
    g.fill();

    // Veins
    g.strokeStyle = 'rgba(205,220,140,0.28)';
    g.lineWidth = 0.022 * size;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(0.04 * size, -0.5 * size, 0.03 * size, -0.97 * size);
    g.stroke();
    g.lineWidth = 0.009 * size;
    g.strokeStyle = 'rgba(205,220,140,0.14)';
    for (let i = 0; i < 6; i++) {
      const y = -(0.1 + i * 0.13) * size;
      const span = (0.5 - Math.abs(i - 2) * 0.07) * size;
      for (const side of [-1, 1]) {
        g.beginPath();
        g.moveTo(0.02 * size, y);
        g.quadraticCurveTo(side * span * 0.45, y - 0.04 * size, side * span * 0.9, y - 0.17 * size);
        g.stroke();
      }
    }

    // Gloss
    const gl = g.createRadialGradient(0.18 * size, -0.55 * size, 0, 0.18 * size, -0.55 * size, 0.55 * size);
    gl.addColorStop(0, 'rgba(240,255,220,0.16)');
    gl.addColorStop(1, 'rgba(255,255,230,0)');
    g.fillStyle = gl;
    g.fillRect(-size, -size * 1.2, size * 2, size * 1.5);

    // Edge darkening
    leafShape(g, size, asym);
    g.strokeStyle = 'rgba(10,30,5,0.45)';
    g.lineWidth = 0.05 * size;
    g.stroke();
    g.restore();

    // Shadow silhouette (rendered small → naturally blurred when scaled up)
    const sh = document.createElement('canvas');
    const k = 0.18;
    sh.width = Math.max(4, Math.ceil(W * k));
    sh.height = Math.max(4, Math.ceil(H * k));
    const sg = sh.getContext('2d');
    sg.scale(dpr * k, dpr * k);
    sg.translate(ox, oy);
    leafShape(sg, size, asym);
    sg.fillStyle = '#000';
    sg.fill();

    return { canvas: c, shadow: sh, ox, oy, w: W / dpr, h: H / dpr };
  }

  class Leaves {
    constructor() {
      this.leaves = [];
      this.time = 0;
    }

    layout(width, height, dpr) {
      this.leaves = [];
      const m = Math.min(width, height);
      const mobile = width < 700;
      const base = mobile ? m * 0.17 : m * 0.15;

      // [anchorX, anchorY, rotation, sizeFactor]
      const specs = [
        // left edge cluster (top)
        [-0.02, 0.03, 2.25, 0.8],
        [-0.03, 0.17, 1.75, 1.0],
        [0.035, 0.26, 2.05, 0.82],
        [-0.02, 0.36, 1.45, 1.08],
        [0.015, 0.46, 1.9, 0.7],
        // bottom-left
        [-0.02, 0.9, 1.15, 0.95],
        [0.04, 1.02, 0.55, 0.85],
        // right edge, a couple of stray leaves
        [1.02, 0.08, -2.2, 0.75],
        [1.03, 0.82, -1.1, 0.8],
      ];
      specs.forEach(([ax, ay, rot, sf], i) => {
        if (mobile && [2, 4, 6, 8].includes(i)) return;
        const size = base * sf * rand(0.92, 1.08);
        const sprite = renderLeaf(size, dpr);
        this.leaves.push({
          x: ax * width,
          y: ay * height,
          rot,
          angle: 0,
          angVel: 0,
          phase: rand(0, Math.PI * 2),
          size,
          sprite,
          // stem: runs from off-screen to the leaf base
          stemX: ax < 0.5 ? -size * 0.6 : width + size * 0.6,
          stemY: ay * height + rand(-0.3, 0.3) * size,
        });
      });
    }

    update(dt, pointer) {
      this.time += dt;
      for (const l of this.leaves) {
        // breeze torque + spring back
        const breeze = Math.sin(this.time * 0.7 + l.phase) * 0.02 + Math.sin(this.time * 1.9 + l.phase * 2) * 0.006;
        const k = 14;
        const c = 2.2;
        l.angVel += (-(l.angle - breeze) * k - l.angVel * c) * dt;
        if (pointer.active && pointer.speed > 80) {
          const cx = l.x + Math.cos(l.rot - Math.PI / 2) * l.size * 0.55;
          const cy = l.y + Math.sin(l.rot - Math.PI / 2) * l.size * 0.55;
          const dx = pointer.x - cx;
          const dy = pointer.y - cy;
          const d = Math.hypot(dx, dy);
          if (d < l.size * 0.75) {
            // torque = r × v (2D cross product)
            const torque = (dx * pointer.vy - dy * pointer.vx) / (l.size * l.size);
            l.angVel += Math.max(-6, Math.min(6, torque * 0.02)) * (1 - d / (l.size * 0.75));
          }
        }
        l.angle += l.angVel * dt;
      }
    }

    draw(ctx) {
      // Shadows on the water first
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.imageSmoothingEnabled = true;
      for (const l of this.leaves) {
        const s = l.sprite;
        ctx.save();
        ctx.translate(l.x + l.size * 0.22, l.y + l.size * 0.3);
        ctx.rotate(l.rot + l.angle * 1.1);
        ctx.drawImage(s.shadow, -s.ox, -s.oy, s.w, s.h);
        ctx.restore();
      }
      ctx.restore();

      // Stems
      ctx.save();
      ctx.lineCap = 'round';
      for (const l of this.leaves) {
        ctx.strokeStyle = 'rgba(72,92,30,0.95)';
        ctx.lineWidth = Math.max(1.5, l.size * 0.03);
        ctx.beginPath();
        ctx.moveTo(l.stemX, l.stemY);
        ctx.quadraticCurveTo((l.stemX + l.x) / 2, l.y + l.size * 0.15, l.x, l.y);
        ctx.stroke();
      }
      ctx.restore();

      for (const l of this.leaves) {
        const s = l.sprite;
        ctx.save();
        ctx.translate(l.x, l.y);
        ctx.rotate(l.rot + l.angle);
        ctx.drawImage(s.canvas, -s.ox, -s.oy, s.w, s.h);
        ctx.restore();
      }
    }
  }

  window.MFH = window.MFH || {};
  window.MFH.Leaves = Leaves;
})();
