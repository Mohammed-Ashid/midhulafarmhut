/* ==========================================================================
   Pond — wires everything together: canvases, input, food, main loop.
   ========================================================================== */
(function () {
  'use strict';

  const { Koi, WaterRenderer, Leaves } = window.MFH;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  const root = document.getElementById('pond');
  const waterCanvas = document.getElementById('water');
  const overlay = document.getElementById('overlay');
  const octx = overlay.getContext('2d');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Off-screen layers
  const fishCanvas = document.createElement('canvas');
  const fctx = fishCanvas.getContext('2d');
  const floorCanvas = document.createElement('canvas');
  const shadowCanvas = document.createElement('canvas');
  const sctx = shadowCanvas.getContext('2d');
  const SHADOW_SCALE = 0.16;

  let water = null;
  try {
    water = new WaterRenderer(waterCanvas);
  } catch (e) {
    console.warn('[pond] WebGL water unavailable, using 2D fallback:', e.message);
    root.classList.add('no-webgl');
    waterCanvas.replaceWith(floorCanvas);
    floorCanvas.className = 'layer';
    fishCanvas.className = 'layer';
    floorCanvas.after(fishCanvas);
  }

  const leaves = new Leaves();
  let life = null;

  const world = {
    width: 0,
    height: 0,
    time: 0,
    fish: [],
    small: [],
    food: [],
    center: { x: 0, y: 0 },
    orbitRadius: 200,
    pointer: { x: -9999, y: -9999, vx: 0, vy: 0, speed: 0, still: 0, active: false },
    obstacles: [],
    ripples: new window.MFH.RippleLog(),
    waveC: 100,
    textRect: null,
    lastClick: null,
    dpr: 1,
    drop(x, y, r, s) {
      if (water) water.drop(x, y, r, s);
      this.ripples.add(x, y, s, this.time);
    },
  };

  let dpr = 1;

  /* ---------------- Adaptive quality ----------------
     0 = full detail … 3 = lightest. Each device starts at a tier that suits
     it, then steps down if it can't hold a smooth frame rate. */
  const QUALITY = [
    { dpr: 2, px: 2.6e6, mpx: 1.5e6, hq: 1, steps: 3 },
    { dpr: 1.5, px: 1.8e6, mpx: 1.1e6, hq: 1, steps: 2 },
    { dpr: 1, px: 1.2e6, mpx: 0.75e6, hq: 0, steps: 1 },
    { dpr: 0.75, px: 0.7e6, mpx: 0.45e6, hq: 0, steps: 1 },
  ];
  function initialQuality() {
    const mem = navigator.deviceMemory || 8;
    const cores = navigator.hardwareConcurrency || 8;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    let q = 0;
    if (coarse || window.innerWidth < 700 || mem <= 4 || cores <= 4) q = 1;
    if (mem <= 2 || cores <= 2) q = 2;
    return q;
  }
  let qLevel = initialQuality();

  function thinForQuality() {
    if (qLevel >= 2) {
      for (const s of world.small) {
        if (s.thinned) continue;
        s.thinned = true;
        s.f.length = Math.max(1, Math.ceil(s.f.length * 0.6));
      }
    }
    if (qLevel >= 3) world.small = world.small.filter((s) => s.name === 'cardinal' || s.name === 'danio');
  }

  /* ---------------- Pond floor ---------------- */
  function paintFloor(w, h) {
    const k = water ? 0.5 : Math.min(dpr, 1.5); // GPU path samples it blurred anyway
    floorCanvas.width = Math.ceil(w * k);
    floorCanvas.height = Math.ceil(h * k);
    const g = floorCanvas.getContext('2d');
    g.setTransform(k, 0, 0, k, 0, 0);

    const base = g.createRadialGradient(w * 0.55, h * 0.45, 0, w * 0.55, h * 0.45, Math.max(w, h) * 0.75);
    base.addColorStop(0, '#12303c');
    base.addColorStop(0.55, '#0b2029');
    base.addColorStop(1, '#050e13');
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);

    // Mottled silt & algae
    const m = Math.min(w, h);
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = rand(0.05, 0.28) * m;
      const light = Math.random() < 0.45;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const a = rand(0.03, 0.09);
      gr.addColorStop(0, light ? `rgba(60,110,120,${a})` : `rgba(0,6,10,${a * 1.6})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // Faint, deep pebbles
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const rx = rand(0.008, 0.03) * m;
      const ry = rx * rand(0.6, 0.95);
      const rot = rand(0, Math.PI);
      g.save();
      g.translate(x, y);
      g.rotate(rot);
      const pg = g.createRadialGradient(-rx * 0.3, -ry * 0.3, 0, 0, 0, rx);
      pg.addColorStop(0, `rgba(70,100,105,${rand(0.08, 0.16)})`);
      pg.addColorStop(1, 'rgba(10,25,30,0.0)');
      g.fillStyle = pg;
      g.beginPath();
      g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }

    // Fine grain
    const id = g.getImageData(0, 0, floorCanvas.width, floorCanvas.height);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 10;
      d[i] += n;
      d[i + 1] += n;
      d[i + 2] += n;
    }
    g.putImageData(id, 0, 0);
    if (water) water.setFloor(floorCanvas);
  }

  /* ---------------- Fish ---------------- */
  const KOI_VARIETIES = ['kohaku', 'sanke', 'showa', 'goshiki', 'tancho', 'kohaku', 'asagi', 'sanke', 'ogon', 'orange'];

  function spawnFish() {
    const w = world.width;
    const h = world.height;
    const m = Math.min(w, h);
    const mobile = w < 700;
    const koiV = KOI_VARIETIES.slice().sort(() => Math.random() - 0.5);
    // [species, variety, size range (×m), depth range]
    const plan = mobile
      ? [
          ['koi', koiV[0], [0.3, 0.36], [0.1, 0.75]],
          ['koi', koiV[1], [0.3, 0.36], [0.1, 0.75]],
          ['koi', koiV[2], [0.3, 0.36], [0.1, 0.75]],
          ['comet', 'sarasa', [0.21, 0.21], [0.05, 0.4]],
          ['shubunkin', 'shubunkin', [0.2, 0.2], [0.05, 0.4]],
          ['oranda', 'redcap', [0.18, 0.18], [0.05, 0.35]],
        ]
      : [
          ['koi', koiV[0], [0.26, 0.33], [0.1, 0.75]],
          ['koi', koiV[1], [0.26, 0.33], [0.1, 0.75]],
          ['koi', koiV[2], [0.26, 0.33], [0.1, 0.75]],
          ['koi', koiV[3], [0.26, 0.33], [0.1, 0.75]],
          ['koi', koiV[4], [0.26, 0.33], [0.1, 0.75]],
          ['butterfly', Math.random() < 0.5 ? 'platinum' : 'ogon', [0.32, 0.32], [0.1, 0.6]],
          ['comet', 'comet', [0.17, 0.21], [0.05, 0.4]],
          ['comet', 'sarasa', [0.17, 0.21], [0.05, 0.4]],
          ['shubunkin', 'shubunkin', [0.18, 0.18], [0.05, 0.4]],
          ['oranda', 'redcap', [0.15, 0.15], [0.05, 0.35]],
        ];
    world.fish = [];
    plan.forEach(([species, variety, size, depth], i) => {
      const a = (i / plan.length) * Math.PI * 2 + rand(-0.3, 0.3);
      const r = rand(0.15, 0.4) * m;
      world.fish.push(new Koi({
        x: w * (mobile ? 0.5 : 0.62) + Math.cos(a) * r * (w / m) * 0.6,
        y: h * (mobile ? 0.35 : 0.5) + Math.sin(a) * r * 0.8,
        angle: a + Math.PI / 2,
        length: m * rand(size[0], size[1]),
        depth: rand(depth[0], depth[1]),
        species,
        variety,
        orbitDir: Math.random() < 0.8 ? 1 : -1,
      }));
    });
    world.small = window.MFH.createSchools ? window.MFH.createSchools(world) : [];
    life = window.MFH.createLife ? window.MFH.createLife(world, reducedMotion) : null;
  }

  /* ---------------- Resize ---------------- */
  function resize() {
    const w = root.clientWidth;
    const h = root.clientHeight;
    const first = world.width === 0;
    const changed = Math.abs(w - world.width) > 1 || Math.abs(h - world.height) > 120;
    world.width = w;
    world.height = h;

    const Q = QUALITY[qLevel];
    const prevDpr = dpr;
    dpr = Math.min(window.devicePixelRatio || 1, Q.dpr);
    const maxPx = w < 700 ? Q.mpx : Q.px;
    if (w * h * dpr * dpr > maxPx) dpr = Math.sqrt(maxPx / (w * h));
    if (water) water.hq = Q.hq;

    fishCanvas.width = Math.round(w * dpr);
    fishCanvas.height = Math.round(h * dpr);
    shadowCanvas.width = Math.ceil(w * SHADOW_SCALE);
    shadowCanvas.height = Math.ceil(h * SHADOW_SCALE);
    overlay.width = Math.round(w * dpr);
    overlay.height = Math.round(h * dpr);

    if (water) water.resize(Math.round(w * dpr), Math.round(h * dpr), w, h);
    paintFloor(w, h);
    leaves.layout(w, h, dpr);
    world.dpr = dpr;
    const hero = document.querySelector('.hero-inner');
    if (hero) {
      const r = hero.getBoundingClientRect();
      const rr = root.getBoundingClientRect();
      world.textRect = { x: r.left - rr.left - 40, y: r.top - rr.top - 40, w: r.width + 80, h: r.height + 80 };
    }

    world.orbitRadius = w < 700 ? w * 0.32 : Math.min(w, h) * 0.26;
    if (first || changed) {
      spawnFish();
    } else {
      for (const f of world.fish) {
        f.x = clamp(f.x, 0, w);
        f.y = clamp(f.y, 0, h);
      }
      // sprites are resolution-dependent
      if (Math.abs(prevDpr - dpr) > 0.01 && window.MFH.createLife) life = window.MFH.createLife(world, reducedMotion);
    }
    thinForQuality();
  }

  /* ---------------- Input ---------------- */
  const p = world.pointer;
  let lastMove = 0;
  let down = null;
  let interacted = false;

  function markInteracted() {
    if (interacted) return;
    interacted = true;
    document.body.classList.add('has-interacted');
  }

  function localPoint(e) {
    const r = root.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onMove(e) {
    const q = localPoint(e);
    const now = performance.now();
    const dt = Math.max(1, now - lastMove) / 1000;
    if (p.active && dt < 0.25) {
      const vx = (q.x - p.x) / dt;
      const vy = (q.y - p.y) / dt;
      p.vx = p.vx * 0.6 + vx * 0.4;
      p.vy = p.vy * 0.6 + vy * 0.4;
      // Trail ripples, interpolated along the path
      const dist = Math.hypot(q.x - p.x, q.y - p.y);
      const sp = Math.hypot(p.vx, p.vy);
      const strength = clamp(sp / 1600, 0.004, 0.02) * (e.pointerType === 'touch' || e.buttons ? 1.5 : 1);
      const steps = Math.min(6, Math.ceil(dist / 14));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        world.drop(p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t, 11 + Math.min(16, sp / 200), strength);
      }
    } else {
      p.vx = 0;
      p.vy = 0;
    }
    p.speed = Math.hypot(p.vx, p.vy);
    p.x = q.x;
    p.y = q.y;
    p.active = true;
    if (p.speed > 25) p.still = 0;
    lastMove = now;
    if (down && Math.hypot(q.x - down.x, q.y - down.y) > 12) down.moved = true;
  }

  function scatterFood(x, y) {
    const n = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 26;
      world.food.push({
        x: x + Math.cos(a) * r,
        y: y + Math.sin(a) * r,
        delay: i * 0.05 + Math.random() * 0.08,
        landed: false,
        eaten: false,
        age: 0,
        size: rand(3, 4.4),
        spin: rand(0, Math.PI),
        driftX: rand(-4, 4),
        driftY: rand(-4, 4),
      });
    }
    for (const f of world.fish) f.startle(x, y, f.L * 0.9, 0.45);
    const mm = Math.min(world.width, world.height);
    for (const s of world.small) s.startle(x, y, 0.12 * mm, 0.6);
  }

  root.addEventListener('pointerdown', (e) => {
    if (e.target.closest('a, button')) return;
    onMove(e);
    const q = localPoint(e);
    down = { x: q.x, y: q.y, t: performance.now(), moved: false };
    world.lastClick = { x: q.x, y: q.y, t: world.time };
    world.drop(q.x, q.y, 22, 0.06);
    markInteracted();
  });
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerup', (e) => {
    if (!down) return;
    const q = localPoint(e);
    if (!down.moved && performance.now() - down.t < 450) scatterFood(q.x, q.y);
    down = null;
    if (e.pointerType === 'touch') p.active = false;
  });
  window.addEventListener('pointercancel', () => {
    down = null;
    p.active = false;
  });
  document.addEventListener('pointerleave', () => { p.active = false; });
  window.addEventListener('blur', () => { p.active = false; });
  window.addEventListener('pointermove', () => { if (p.speed > 200) markInteracted(); }, { passive: true });

  /* ---------------- Overlay (pellets, leaves) ---------------- */
  function drawFood(ctx) {
    for (const f of world.food) {
      if (!f.landed || f.eaten) continue;
      const fade = clamp((22 - f.age) / 3, 0, 1) * clamp(f.age * 4, 0, 1);
      if (fade <= 0) continue;
      const bob = Math.sin(world.time * 3 + f.spin) * 0.4;
      ctx.globalAlpha = fade;
      // tiny shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(f.x + 2.5, f.y + 3 + bob, f.size, f.size * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      const g = ctx.createRadialGradient(f.x - f.size * 0.35, f.y - f.size * 0.4 + bob, 0, f.x, f.y + bob, f.size);
      g.addColorStop(0, '#d9a066');
      g.addColorStop(0.55, '#9a6234');
      g.addColorStop(1, '#5b3519');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(f.x, f.y + bob, f.size, f.size * 0.88, f.spin, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function updateFood(dt) {
    for (const f of world.food) {
      if (!f.landed) {
        f.delay -= dt;
        if (f.delay <= 0) {
          f.landed = true;
          const pad = life && life.lilies.hitPad(f.x, f.y);
          if (pad) {
            f.onPad = pad;
            f.relX = f.x - pad.x;
            f.relY = f.y - pad.y;
            f.padT = rand(2, 5);
          } else world.drop(f.x, f.y, 7, 0.025);
        }
        continue;
      }
      f.age += dt;
      if (f.onPad) continue;
      f.x += f.driftX * dt;
      f.y += f.driftY * dt;
      f.driftX *= 0.995;
      f.driftY *= 0.995;
      // fish bow-waves push pellets aside
      for (const k of world.fish) {
        const dx = f.x - k.mouthX;
        const dy = f.y - k.mouthY;
        const d = Math.hypot(dx, dy);
        if (d < k.W * 2.2 && d > 0.01 && k.depth < 0.35) {
          const push = (1 - d / (k.W * 2.2)) * k.speed * 0.25;
          f.x += (dx / d) * push * dt;
          f.y += (dy / d) * push * dt;
        }
      }
    }
    world.food = world.food.filter((f) => !f.eaten && f.age < 22);
  }

  /* ---------------- Frame-rate watchdog ---------------- */
  let perfSum = 0;
  let perfN = 0;
  let perfT = 0;
  let perfWarm = 2;
  function watchPerf(raw) {
    if (document.hidden || raw > 0.6) return; // ignore tab switches & long stalls
    if (perfWarm > 0) {
      perfWarm -= raw;
      return;
    }
    perfSum += raw;
    perfN++;
    perfT += raw;
    if (perfT < 2) return;
    const avg = perfSum / perfN;
    perfSum = perfN = perfT = 0;
    // below ~45 fps → step down one tier and re-measure
    if (avg > 1 / 45 && qLevel < QUALITY.length - 1) {
      qLevel++;
      resize();
      perfWarm = 1;
    }
  }

  /* ---------------- Main loop ---------------- */
  let last = performance.now();
  let simAcc = 0;
  let ambientT = 0;

  function frame(now) {
    let dt = (now - last) / 1000;
    watchPerf(dt);
    last = now;
    if (dt > 0.1) dt = 0.1;
    if (reducedMotion) dt *= 0.5;
    world.time += dt;

    // Pointer bookkeeping
    if (p.active) {
      p.still += dt;
      if (now - lastMove > 60) {
        p.vx *= 0.8;
        p.vy *= 0.8;
        p.speed = Math.hypot(p.vx, p.vy);
      }
    }

    // Gathering point drifts lazily around the pond
    const w = world.width;
    const h = world.height;
    // (kept clear of the headline: right side on desktop, upper half on phones)
    if (w < 700) {
      world.center.x = w * (0.52 + 0.1 * Math.sin(world.time * 0.05));
      world.center.y = h * (0.36 + 0.08 * Math.sin(world.time * 0.06 + 1.3));
    } else {
      world.center.x = w * (0.64 + 0.1 * Math.sin(world.time * 0.045) + 0.04 * Math.sin(world.time * 0.11));
      world.center.y = h * (0.5 + 0.1 * Math.sin(world.time * 0.06 + 1.3));
    }

    // An occasional drip from the overhanging leaves
    ambientT -= dt;
    if (ambientT <= 0) {
      ambientT = rand(2.5, 6);
      const l = leaves.leaves[Math.floor(Math.random() * leaves.leaves.length)];
      if (l) {
        const tx = l.x + Math.cos(l.rot - Math.PI / 2) * l.size;
        const ty = l.y + Math.sin(l.rot - Math.PI / 2) * l.size;
        world.drop(tx, ty, 5, 0.03);
      }
    }

    for (const f of world.fish) f.update(dt, world);
    for (const s of world.small) s.update(dt, world);
    world.obstacles.length = 0;
    if (life) {
      life.turtle.update(dt, world);
      life.lilies.update(dt, world);
      if (life.dragonfly) life.dragonfly.update(dt, world, life.lilies);
    }
    updateFood(dt);
    leaves.update(dt, p);

    // ---- Fish layer: shadows on the floor, then fish (deepest first)
    fctx.setTransform(1, 0, 0, 1, 0, 0);
    fctx.clearRect(0, 0, fishCanvas.width, fishCanvas.height);

    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, shadowCanvas.width, shadowCanvas.height);
    sctx.fillStyle = '#000';
    for (const f of world.fish) {
      const off = (1.15 - f.depth) * f.L * 0.22;
      sctx.setTransform(SHADOW_SCALE, 0, 0, SHADOW_SCALE, off * 0.8 * SHADOW_SCALE, off * SHADOW_SCALE);
      sctx.globalAlpha = 0.55 + f.depth * 0.3;
      f.drawShadow(sctx);
    }
    const mShadow = Math.min(w, h);
    for (const s of world.small) {
      const off = (1.15 - s.depth) * mShadow * 0.065;
      sctx.setTransform(SHADOW_SCALE, 0, 0, SHADOW_SCALE, off * 0.8 * SHADOW_SCALE, off * SHADOW_SCALE);
      sctx.globalAlpha = 0.35;
      s.drawShadow(sctx);
    }
    if (life) {
      const t = life.turtle;
      const off = (1.15 - t.depth) * t.L * 0.22;
      sctx.setTransform(SHADOW_SCALE, 0, 0, SHADOW_SCALE, off * 0.8 * SHADOW_SCALE, off * SHADOW_SCALE);
      sctx.globalAlpha = 0.55 + t.depth * 0.3;
      t.drawShadow(sctx);
    }
    sctx.globalAlpha = 1;
    fctx.globalAlpha = 0.5;
    fctx.imageSmoothingEnabled = true;
    fctx.imageSmoothingQuality = 'high';
    fctx.drawImage(shadowCanvas, 0, 0, fishCanvas.width, fishCanvas.height);
    fctx.globalAlpha = 1;

    fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const swimmers = world.fish.concat(world.small);
    if (life) swimmers.push(life.turtle);
    swimmers.sort((a, b) => b.depth - a.depth);
    for (const f of swimmers) f.draw(fctx);
    // floating pads shade whatever swims beneath them
    if (life) life.lilies.drawShadows(fctx);

    // ---- Water
    if (water) {
      simAcc += dt;
      let steps = 0;
      while (simAcc >= 1 / 60 && steps < QUALITY[qLevel].steps) {
        simAcc -= 1 / 60;
        steps++;
      }
      if (steps === 0) steps = 1, simAcc = 0;
      water.frame(fishCanvas, dt, steps);
    }

    // ---- Overlay
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.clearRect(0, 0, overlay.width, overlay.height);
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (life) life.lilies.draw(octx);
    drawFood(octx);
    if (life) life.turtle.drawSurface(octx);
    leaves.draw(octx);
    if (life && life.dragonfly) life.dragonfly.draw(octx);

    requestAnimationFrame(frame);
  }

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });

  // Handy for debugging in the console: MFH.pond.world.fish
  window.MFH.pond = { world, water, get life() { return life; }, step: (n) => water && water.frame(fishCanvas, 0, n) };

  resize();
  // A single welcoming ripple as the page opens
  setTimeout(() => world.drop(world.width * 0.62, world.height * 0.46, 30, 0.08), 600);
  requestAnimationFrame((t) => {
    last = t;
    document.body.classList.add('is-ready');
    requestAnimationFrame(frame);
  });
})();
