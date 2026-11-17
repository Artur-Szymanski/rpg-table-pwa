// Looking up into dark churning storm clouds: rain falls toward the viewer (streaks radiating
// from the vanishing point), lightning flickers inside the clouds, and water drops sit on and
// slide down the lens, refracting the view. uIntensity scales rain amount.

float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x),
             mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.02 + 17.1; a *= 0.5; }
  return s;
}

// --- Sky behind the lens -----------------------------------------------------------------

float cloudDensity(vec2 q, float t) {
  vec2 c = q * (1.0 + 0.35 * dot(q, q)) * 2.2;   // dome-like perspective
  vec2 warp = vec2(fbm(c * 1.3 + vec2(t * 0.05, 0.0)), fbm(c * 1.3 + vec2(5.2, -t * 0.04)));
  return fbm(c + 0.8 * warp + vec2(t * 0.02, t * 0.012));
}

// Rain streaks radiating from the vanishing point (drops falling toward the viewer).
float rainLayer(vec2 q, vec2 vp, float n, float speed, float seed, float I) {
  vec2 d = q - vp;
  float r = length(d);
  float a = atan(d.y, d.x) / 6.2831853 + 0.5;
  float id = floor(a * n);
  float fa = fract(a * n) - 0.5;
  float h = hash11(id * 1.31 + seed);
  if (h > 0.35 + 0.5 * I) return 0.0;
  float z = fract(hash11(id + seed * 7.0) - iTime * speed);   // 1 = far, 0 = at the lens
  float R = 0.05 / (z + 0.03);                                  // screen radius of the drop
  float len = 0.18 * R;                                          // motion-blur streak length
  float radial = smoothstep(R - len, R, r) * smoothstep(R + 0.01, R, r);
  float w = 0.001 + 0.003 * (1.0 - z);
  float across = smoothstep(w, 0.0, abs(fa) * 6.2831853 / n * r);
  return radial * across * smoothstep(0.12, 0.45, R) * 0.8;    // far drops near the centre stay invisible
}

vec3 sky(vec2 q, float t, float I) {
  float D = cloudDensity(q, t);
  float D2 = cloudDensity(q + vec2(0.03, 0.04), t);     // offset sample for fake lighting
  float shade = clamp((D - D2) * 5.0 + 0.5, 0.0, 1.0);
  float dens = smoothstep(0.3, 0.8, D);
  vec3 col = mix(vec3(0.02, 0.025, 0.035), vec3(0.3, 0.33, 0.4), dens);
  col *= 0.4 + 1.1 * shade;

  // Faint neon city glow bleeding in from the edges of the view.
  col += vec3(0.35, 0.06, 0.3) * smoothstep(0.35, 1.0, length(q)) * 0.18;

  // Lightning: random flashes lighting the clouds from inside.
  float k = floor(t / 2.5);
  if (hash11(k * 2.3) > 0.55) {
    float ft = fract(t / 2.5) * 2.5;
    float flash = exp(-ft * 4.0) * (0.55 + 0.45 * sin(ft * 70.0)) + 0.6 * exp(-abs(ft - 0.25) * 30.0);
    vec2 c = (vec2(hash11(k), hash11(k + 1.7)) - 0.5) * vec2(0.8, 1.0);
    float glow = exp(-length(q - c) * 2.5) * (0.4 + dens);
    col += vec3(0.6, 0.65, 0.85) * glow * flash * 1.4;
  }

  // Rain toward the viewer, three depths.
  vec2 vp = vec2(0.04 * sin(t * 0.3), 0.06);
  float rn = rainLayer(q, vp, 140.0, 0.9, 1.0, I) * 0.5
           + rainLayer(q, vp, 90.0, 0.7, 2.0, I) * 0.7
           + rainLayer(q, vp, 60.0, 0.55, 3.0, I);
  col += vec3(0.6, 0.65, 0.8) * rn * 0.9;
  return col;
}

// --- Water on the lens ---------------------------------------------------------------------
// Each returns (refraction normal xy, coverage mask).

vec3 staticDrops(vec2 q, float t) {
  vec2 g = q * 8.0;
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  float h = hash12(id);
  vec2 c = (vec2(hash12(id + 1.3), hash12(id + 7.1)) - 0.5) * 0.6;
  float life = fract(t * 0.06 + h);
  float R = (0.1 + 0.18 * hash12(id + 3.3)) * smoothstep(0.0, 0.03, life) * (1.0 - 0.7 * life) * step(0.3, h);
  vec2 d = f - c;
  float m = smoothstep(R, R * 0.8, length(d));
  return vec3(d / max(R, 1e-3) * m, m);
}

vec3 slidingDrops(vec2 q, float t, float cols, float seed) {
  float gx = q.x * cols + seed;
  float id = floor(gx);
  float h = hash11(id * 3.7 + seed);
  if (h < 0.35) return vec3(0.0);
  float sp = 0.07 + 0.08 * hash11(id + 9.1);
  float tt = t * sp + h * 10.0;
  float yy = 0.7 - fract(tt + 0.04 * sin(tt * 40.0)) * 1.6;   // stick-slip motion downward
  float xc = (hash11(id + 1.0) - 0.5) * 0.5 + 0.06 * sin(q.y * 9.0 + h * 6.0);
  float dx = (fract(gx) - 0.5 - xc) / cols;
  float dy = q.y - yy;
  float R = 0.022 + 0.012 * hash11(id + 4.4);
  vec2 d = vec2(dx, dy * (dy > 0.0 ? 0.75 : 1.1));            // teardrop: longer on top
  float m = smoothstep(R, R * 0.8, length(d));
  vec2 n = d / R * m;

  // Wet trail of tiny droplets left above the drop.
  float trail = step(0.0, dy) * smoothstep(0.45, 0.0, dy);
  float cy = q.y * 45.0;
  float tid = floor(cy);
  vec2 td = vec2(dx, (fract(cy) - 0.5) / 45.0);
  float tr = 0.004 * step(0.4, hash11(tid + id * 13.0)) * trail;
  float tm = smoothstep(tr, tr * 0.6, length(td)) * step(0.0005, tr);
  n += td / max(tr, 1e-4) * tm * 0.6;
  return vec3(n, max(m, tm));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float t = iTime;
  float I = uIntensity;
  vec2 q = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

  vec3 a = staticDrops(q, t);
  vec3 b = slidingDrops(q, t, 5.0, 0.0);
  vec3 c = slidingDrops(q, t * 1.3, 7.0, 0.5);
  vec2 n = a.xy + b.xy + c.xy;
  float mask = clamp(a.z + b.z + c.z, 0.0, 1.0) * min(I + 0.3, 1.0);

  // Drops act like tiny lenses: magnified, flipped view of the sky.
  vec3 col = sky(q - n * 0.06 * mask, t, I);

  // Drop rim shading and a small highlight.
  float rim = smoothstep(0.6, 1.0, length(n)) * mask;
  col *= 1.0 - 0.45 * rim;
  col += vec3(0.5, 0.55, 0.65) * smoothstep(0.5, 0.9, dot(normalize(n + 1e-4), vec2(-0.6, 0.8))) * rim * 0.4;
  col += vec3(0.03) * mask;

  vec2 v = fragCoord / iResolution.xy - 0.5;
  col *= 1.0 - 0.6 * dot(v, v);
  fragColor = vec4(col, 1.0);
}
