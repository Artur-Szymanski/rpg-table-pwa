// Fullscreen WebGL2 shader renderer with a Shadertoy-style interface.
// Shader files define:  void mainImage(out vec4 fragColor, in vec2 fragCoord)
// Available uniforms: iResolution (vec3), iTime, iTimeDelta, iFrame, iMouse (vec4),
// iChannel0 (sampler2D, scene image), iChannel0Size (vec2), uIntensity (float, UI slider).
(function () {
  'use strict';

  const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const FRAG_HEADER = `#version 300 es
precision highp float;
precision highp int;
uniform vec3 iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform int iFrame;
uniform vec4 iMouse;
uniform sampler2D iChannel0;
uniform vec2 iChannel0Size;
uniform float uIntensity;
out vec4 outColor;
// Samples iChannel0 with "cover" fit (fills the screen, keeps aspect ratio).
vec4 sampleCover(vec2 uv) {
  float sa = iResolution.x / iResolution.y;
  float ia = iChannel0Size.x / max(iChannel0Size.y, 1.0);
  vec2 s = sa > ia ? vec2(1.0, ia / sa) : vec2(sa / ia, 1.0);
  return texture(iChannel0, (uv - 0.5) * s + 0.5);
}
#line 1
`;

  const FRAG_FOOTER = `
void main() { vec4 c = vec4(0.0); mainImage(c, gl_FragCoord.xy); outColor = vec4(c.rgb, 1.0); }`;

  // Global post-process applied to every scene: radial chromatic aberration + interlace lines.
  const POST_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uScene;
uniform vec2 uRes;
uniform float uLinePeriod;   // canvas pixels per line pair
uniform float uLineStrength; // 0 = off
uniform float uAberration;   // 0 = off
out vec4 outColor;
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 d = uv - 0.5;
  // Small constant horizontal split plus a radial component growing toward the edges.
  vec2 off = (vec2(0.0015, 0.0) + d * 0.02) * uAberration;
  vec3 col = vec3(texture(uScene, uv + off).r, texture(uScene, uv).g, texture(uScene, uv - off).b);
  float ph = fract(gl_FragCoord.y / uLinePeriod);
  float line = 0.5 + 0.5 * cos(6.2831853 * ph);
  col *= (1.0 - uLineStrength * line) * (1.0 + 0.5 * uLineStrength);
  outColor = vec4(col, 1.0);
}`;

  // Defaults (a scene can override with "scanlines" / "aberration" in scenes.json).
  const POST_DEFAULTS = { scanlines: 0.22, aberration: 1.0, linePx: 3 };

  class Renderer {
    constructor(canvas, onError) {
      this.canvas = canvas;
      this.onError = onError || console.error;
      const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: false });
      if (!gl) throw new Error('Ta przeglądarka nie obsługuje WebGL2.');
      this.gl = gl;
      this.program = null;
      this.uniforms = {};
      this.texture = this._createTexture();
      this.textureSize = [1, 1];
      this.intensity = 1;
      this.mouse = [0, 0, 0, 0];
      this.frame = 0;
      this.startTime = performance.now();
      this.lastTime = this.startTime;
      this.resolutionScale = Math.min(window.devicePixelRatio || 1, 2);

      this.buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      // One oversized triangle covers the whole screen.
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

      // Scene renders into an offscreen texture, then the post pass draws it to the screen.
      this.scanlines = POST_DEFAULTS.scanlines;
      this.aberration = POST_DEFAULTS.aberration;
      this.post = this._link(VERT, POST_FRAG);
      this.postUniforms = {};
      for (const name of ['uScene', 'uRes', 'uLinePeriod', 'uLineStrength', 'uAberration']) {
        this.postUniforms[name] = gl.getUniformLocation(this.post, name);
      }
      this.fbo = gl.createFramebuffer();
      this.fboTex = gl.createTexture();
      this.fboSize = [0, 0];

      canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; });
      canvas.addEventListener('pointermove', (e) => this._pointer(e, false));
      canvas.addEventListener('pointerdown', (e) => this._pointer(e, true));
      canvas.addEventListener('pointerup', () => { this.mouse[2] = -Math.abs(this.mouse[2]); });

      this._loop = this._loop.bind(this);
      requestAnimationFrame(this._loop);
    }

    _pointer(e, down) {
      const r = this.canvas.getBoundingClientRect();
      const x = (e.clientX - r.left) * this.canvas.width / r.width;
      const y = (r.bottom - e.clientY) * this.canvas.height / r.height;
      this.mouse[0] = x; this.mouse[1] = y;
      if (down) { this.mouse[2] = x; this.mouse[3] = y; }
    }

    _createTexture() {
      const gl = this.gl;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return tex;
    }

    async setImage(url) {
      const gl = this.gl;
      if (!url) {
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
        this.textureSize = [1, 1];
        return;
      }
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      this.textureSize = [img.naturalWidth, img.naturalHeight];
    }

    // Post-process settings for the active scene (null / undefined = defaults).
    setPost(opts) {
      opts = opts || {};
      this.scanlines = typeof opts.scanlines === 'number' ? opts.scanlines : POST_DEFAULTS.scanlines;
      this.aberration = typeof opts.aberration === 'number' ? opts.aberration : POST_DEFAULTS.aberration;
      // Heavy scenes can render at a fraction of the screen resolution; the post pass upscales.
      this.renderScale = typeof opts.renderScale === 'number' ? Math.min(Math.max(opts.renderScale, 0.25), 1) : 1;
    }

    _link(vsSrc, fsSrc) {
      const gl = this.gl;
      const vs = this._compile(gl.VERTEX_SHADER, vsSrc);
      const fs = this._compile(gl.FRAGMENT_SHADER, fsSrc);
      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.bindAttribLocation(prog, 0, 'aPos');
      gl.linkProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(prog);
        gl.deleteProgram(prog);
        throw new Error('Błąd linkowania shadera:\n' + log);
      }
      return prog;
    }

    _ensureTarget(w, h) {
      if (this.fboSize[0] === w && this.fboSize[1] === h) return;
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.fboTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.fboTex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this.fboSize = [w, h];
    }

    setShader(source) {
      const gl = this.gl;
      const prog = this._link(VERT, FRAG_HEADER + source + FRAG_FOOTER);
      if (this.program) gl.deleteProgram(this.program);
      this.program = prog;
      this.uniforms = {};
      for (const name of ['iResolution', 'iTime', 'iTimeDelta', 'iFrame', 'iMouse', 'iChannel0', 'iChannel0Size', 'uIntensity']) {
        this.uniforms[name] = gl.getUniformLocation(prog, name);
      }
      this.startTime = performance.now();
      this.frame = 0;
    }

    _compile(type, src) {
      const gl = this.gl;
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(sh);
        gl.deleteShader(sh);
        throw new Error('Błąd kompilacji shadera:\n' + log);
      }
      return sh;
    }

    _resize() {
      const c = this.canvas;
      const w = Math.round(c.clientWidth * this.resolutionScale);
      const h = Math.round(c.clientHeight * this.resolutionScale);
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    }

    _loop(now) {
      requestAnimationFrame(this._loop);
      if (!this.program || this.lost || document.hidden) return;
      const gl = this.gl;
      this._resize();
      const W = this.canvas.width, H = this.canvas.height;
      const scale = this.renderScale || 1;
      const usePost = this.scanlines > 0 || this.aberration > 0 || scale < 1;
      const SW = Math.max(1, Math.round(W * scale)), SH = Math.max(1, Math.round(H * scale));
      if (usePost) {
        this._ensureTarget(SW, SH);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      }
      gl.viewport(0, 0, usePost ? SW : W, usePost ? SH : H);
      gl.useProgram(this.program);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);

      const u = this.uniforms;
      gl.uniform3f(u.iResolution, usePost ? SW : W, usePost ? SH : H, 1);
      gl.uniform1f(u.iTime, (now - this.startTime) / 1000);
      gl.uniform1f(u.iTimeDelta, (now - this.lastTime) / 1000);
      gl.uniform1i(u.iFrame, this.frame++);
      gl.uniform4fv(u.iMouse, this.mouse);
      gl.uniform1i(u.iChannel0, 0);
      gl.uniform2f(u.iChannel0Size, this.textureSize[0], this.textureSize[1]);
      gl.uniform1f(u.uIntensity, this.intensity);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      if (usePost) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, W, H);
        gl.useProgram(this.post);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.fboTex);
        const p = this.postUniforms;
        gl.uniform1i(p.uScene, 1);
        gl.uniform2f(p.uRes, W, H);
        gl.uniform1f(p.uLinePeriod, POST_DEFAULTS.linePx * this.resolutionScale);
        gl.uniform1f(p.uLineStrength, this.scanlines);
        gl.uniform1f(p.uAberration, this.aberration);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      this.lastTime = now;
    }
  }

  window.Renderer = Renderer;
})();
