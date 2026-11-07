/* ==========================================================================
   Water surface — GPU height-field wave simulation + refraction renderer.
   The pond floor and the fish layer are uploaded as textures and seen
   *through* the simulated surface (refraction, caustics, sky glints).
   ========================================================================== */
(function () {
  'use strict';

  const MAX_DROPS = 48;

  const VS = `#version 300 es
  in vec2 aPos;
  out vec2 vUv;
  void main() {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }`;

  // R = height, G = vertical velocity
  const SIM_FS = `#version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 outColor;
  uniform sampler2D uState;
  uniform vec2 uTexel;
  uniform float uAspect;
  uniform vec4 uDrops[${MAX_DROPS}];
  uniform int uDropCount;

  void main() {
    vec4 info = texture(uState, vUv);
    float l = texture(uState, vUv - vec2(uTexel.x, 0.0)).r;
    float r = texture(uState, vUv + vec2(uTexel.x, 0.0)).r;
    float d = texture(uState, vUv - vec2(0.0, uTexel.y)).r;
    float u = texture(uState, vUv + vec2(0.0, uTexel.y)).r;
    float avg = (l + r + d + u) * 0.25;

    info.g += (avg - info.r) * 2.0;
    info.g *= 0.993;
    info.r += info.g;
    info.r *= 0.9992;

    for (int i = 0; i < ${MAX_DROPS}; i++) {
      if (i >= uDropCount) break;
      vec4 dr = uDrops[i];
      vec2 diff = vUv - dr.xy;
      diff.x *= uAspect;
      float t = 1.0 - length(diff) / dr.z;
      if (t > 0.0) {
        t = 0.5 - 0.5 * cos(t * 3.14159265);
        info.r += t * dr.w;
      }
    }
    outColor = info;
  }`;

  const RENDER_FS = `#version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 outColor;
  uniform sampler2D uState;
  uniform sampler2D uFloor;
  uniform sampler2D uFish;
  uniform vec2 uSimTexel;
  uniform vec2 uRes;
  uniform float uAspect;
  uniform float uTime;
  uniform float uHQ;   // 1 = full detail, 0 = lighter shader for slow GPUs

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  // Gentle ambient wind ripples (layered gradient noise) so the surface is
  // never perfectly still.
  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453);
  }
  float gnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(dot(hash2(i), f), dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
               mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)), dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
  }
  float surf(vec2 p) {
    float t = uTime;
    float h = gnoise(p * 2.6 + vec2(t * 0.07, t * 0.05)) * 1.0;
    h += gnoise(p * 5.3 + vec2(-t * 0.11, t * 0.08)) * 0.45;
    if (uHQ > 0.5) {
      h += gnoise(p * 11.0 + vec2(t * 0.17, -t * 0.14)) * 0.2;
      h += gnoise(p * 23.0 + vec2(-t * 0.26, -t * 0.21)) * 0.08;
    }
    return h;
  }
  vec2 ambient(vec2 p) {
    const float e = 0.0025;
    return vec2(surf(p + vec2(e, 0.0)) - surf(p - vec2(e, 0.0)),
                surf(p + vec2(0.0, e)) - surf(p - vec2(0.0, e))) / (2.0 * e) * 0.00105;
  }

  // Classic iterative caustic pattern (soft, animated light network).
  float caustic(vec2 uv) {
    vec2 p = mod(uv * 6.2831853, 6.2831853) - 250.0;
    vec2 i = p;
    float c = 1.0;
    float inten = 0.005;
    float t = uTime * 0.35 + 23.0;
    for (int n = 0; n < 4; n++) {
      float tt = t * (1.0 - (3.5 / float(n + 1)));
      i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
      c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
    }
    c /= 4.0;
    c = 1.17 - pow(c, 1.4);
    return clamp(pow(abs(c), 8.0), 0.0, 1.0);
  }

  void main() {
    vec2 uv = vUv;
    vec2 aUv = vec2(uv.x * uAspect, uv.y);

    float h  = texture(uState, uv).r;
    float hl = texture(uState, uv - vec2(uSimTexel.x, 0.0)).r;
    float hr = texture(uState, uv + vec2(uSimTexel.x, 0.0)).r;
    float hd = texture(uState, uv - vec2(0.0, uSimTexel.y)).r;
    float hu = texture(uState, uv + vec2(0.0, uSimTexel.y)).r;

    vec2 grad = vec2(hr - hl, hu - hd) * 1.0;
    grad += ambient(aUv);
    float lap = (hl + hr + hd + hu - 4.0 * h);

    vec2 sl = -grad * 15.0;                 // surface slope
    vec3 N = normalize(vec3(sl, 1.0));

    // Refraction: deeper things shift more.
    vec2 offFish  = sl * 0.018;
    vec2 offFloor = sl * 0.034;

    vec3 floorCol = texture(uFloor, uv + offFloor).rgb;

    // Caustics dance on the pond floor, focused further by real ripples.
    float c = caustic(aUv * 1.15 + sl * 0.25);
    float c2 = uHQ > 0.5 ? caustic(aUv * 2.1 + vec2(3.1, 1.7) - sl * 0.2) : c;
    float caust = c * 0.65 + c2 * 0.35;
    floorCol += vec3(0.30, 0.48, 0.52) * caust * 0.10;
    floorCol += vec3(0.35, 0.55, 0.60) * clamp(-lap * 22.0, -0.05, 0.25);

    vec4 fish = texture(uFish, uv + offFish);   // premultiplied
    vec3 col = floorCol * (1.0 - fish.a) + fish.rgb;
    col += fish.a * vec3(0.9, 0.95, 1.0) * caust * 0.05;

    // Light absorption of the water column.
    col = mix(col, vec3(0.020, 0.075, 0.100), 0.10);

    // Reflection of an overcast sky / canopy: slopes facing the bright
    // part of the sky light up, slopes facing away darken.
    vec2 Ld = normalize(vec2(-0.35, 0.6));
    float m = length(sl);
    float facing = dot(sl, Ld);
    float bright = smoothstep(-0.02, 0.22, facing);
    vec3 skyLo = vec3(0.015, 0.04, 0.05);
    vec3 skyHi = vec3(0.60, 0.70, 0.74);
    vec3 sky = mix(skyLo, skyHi, bright);
    float amt = clamp(m * 2.2, 0.0, 0.62);
    col = mix(col, sky, amt * (0.35 + 0.65 * bright));

    vec3 I = vec3(0.0, 0.0, -1.0);
    vec3 R = reflect(I, N);
    vec3 L = normalize(vec3(-0.35, 0.6, 1.1));
    float rl = max(dot(R, L), 0.0);
    float spec = pow(rl, 260.0) * 1.4 + pow(rl, 40.0) * 0.1;
    col += vec3(1.0, 0.98, 0.94) * spec;

    // Vignette & grade
    vec2 vc = (uv - 0.5) * vec2(uAspect, 1.0);
    float vig = 1.0 - smoothstep(0.35, 1.25, length(vc) * (1.15 / max(uAspect, 1.0) + 0.55));
    col *= mix(0.55, 1.0, vig);
    col = pow(max(col, 0.0), vec3(0.97));

    // Film grain
    col += (hash(uv * uRes + fract(uTime) * 100.0) - 0.5) * 0.018;

    outColor = vec4(col, 1.0);
  }`;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error('Shader compile error: ' + log);
    }
    return s;
  }

  function program(gl, vsSrc, fsSrc) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fsSrc));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('Program link error: ' + gl.getProgramInfoLog(p));
    }
    const uniforms = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      const name = info.name.replace(/\[0\]$/, '');
      uniforms[name] = gl.getUniformLocation(p, info.name);
    }
    return { p, u: uniforms };
  }

  class WaterRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      const gl = canvas.getContext('webgl2', {
        antialias: false,
        alpha: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance',
      });
      if (!gl) throw new Error('WebGL2 not available');
      const hasFloat = gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float');
      if (!hasFloat) throw new Error('Float render targets not available');
      gl.getExtension('OES_texture_float_linear');
      this.gl = gl;

      this.sim = program(gl, VS, SIM_FS);
      this.render = program(gl, VS, RENDER_FS);

      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      this.floorTex = this._makeTex();
      this.fishTex = this._makeTex();
      this.dropData = new Float32Array(MAX_DROPS * 4);
      this.pending = [];
      this.time = 0;
      this.hq = 1;
    }

    _makeTex() {
      const gl = this.gl;
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }

    _makeTarget(w, h) {
      const gl = this.gl;
      const tex = this._makeTex();
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (!ok) throw new Error('Framebuffer incomplete');
      return { tex, fbo };
    }

    resize(width, height, cssW, cssH) {
      const gl = this.gl;
      this.canvas.width = width;
      this.canvas.height = height;
      this.cssW = cssW;
      this.cssH = cssH;
      this.aspect = cssW / cssH;

      // Simulation grid — resolution independent of DPR so wave speed feels
      // the same on every screen.
      const simH = Math.round(Math.min(420, Math.max(220, cssH * 0.42)));
      const simW = Math.round(simH * this.aspect);
      if (this.targets) {
        for (const t of this.targets) {
          gl.deleteTexture(t.tex);
          gl.deleteFramebuffer(t.fbo);
        }
      }
      this.simW = simW;
      this.simH = simH;
      this.targets = [this._makeTarget(simW, simH), this._makeTarget(simW, simH)];
      this.cur = 0;
    }

    setFloor(canvas) {
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.floorTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    }

    /** x,y in CSS px; radius in CSS px; strength ~ ±0.01..0.05 */
    drop(x, y, radius, strength) {
      if (this.pending.length >= MAX_DROPS * 4 * 2) return;
      this.pending.push(x / this.cssW, 1 - y / this.cssH, radius / this.cssH, strength);
    }

    _simStep(drops) {
      const gl = this.gl;
      const src = this.targets[this.cur];
      const dst = this.targets[1 - this.cur];
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
      gl.viewport(0, 0, this.simW, this.simH);
      gl.useProgram(this.sim.p);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform1i(this.sim.u.uState, 0);
      gl.uniform2f(this.sim.u.uTexel, 1 / this.simW, 1 / this.simH);
      gl.uniform1f(this.sim.u.uAspect, this.aspect);
      const count = drops ? Math.min(MAX_DROPS, drops.length / 4) : 0;
      if (count) {
        this.dropData.fill(0);
        this.dropData.set(drops.slice(0, count * 4));
        gl.uniform4fv(this.sim.u.uDrops, this.dropData);
      }
      gl.uniform1i(this.sim.u.uDropCount, count);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      this.cur = 1 - this.cur;
    }

    frame(fishCanvas, dt, steps) {
      const gl = this.gl;
      this.time += dt;
      gl.bindVertexArray(this.vao);

      // Spread queued drops across the sub-steps.
      const drops = this.pending;
      this.pending = [];
      for (let i = 0; i < steps; i++) {
        const chunk = i === 0 ? drops.slice(0, MAX_DROPS * 4) : (i === 1 ? drops.slice(MAX_DROPS * 4) : null);
        this._simStep(chunk && chunk.length ? chunk : null);
      }

      // Upload the fish layer.
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this.fishTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fishCanvas);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.useProgram(this.render.p);
      const u = this.render.u;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.targets[this.cur].tex);
      gl.uniform1i(u.uState, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.floorTex);
      gl.uniform1i(u.uFloor, 1);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this.fishTex);
      gl.uniform1i(u.uFish, 2);
      gl.uniform2f(u.uSimTexel, 1 / this.simW, 1 / this.simH);
      gl.uniform2f(u.uRes, this.canvas.width, this.canvas.height);
      gl.uniform1f(u.uAspect, this.aspect);
      gl.uniform1f(u.uTime, this.time);
      gl.uniform1f(u.uHQ, this.hq);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }

  window.MFH = window.MFH || {};
  window.MFH.WaterRenderer = WaterRenderer;
})();
