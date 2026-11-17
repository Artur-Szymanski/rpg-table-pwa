// Dark overcast night sky over a city, lit from below by neon, with pouring rain.
// uIntensity scales rain density / brightness.

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
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}

// One layer of falling rain streaks.
float rain(vec2 uv, float scale, float speed, float seed, float density) {
  uv.x += uv.y * 0.15;                       // slant
  vec2 p = uv * vec2(scale, scale * 0.18);
  p.y += iTime * speed;
  vec2 id = floor(p);
  vec2 f = fract(p);
  if (hash12(id + seed) > density) return 0.0;
  float x = 0.15 + 0.7 * hash12(id + seed + 1.0);
  float len = 0.35 + 0.4 * hash12(id + seed + 2.0);
  float head = 0.1 + 0.4 * hash12(id + seed + 3.0);
  float line = smoothstep(0.08, 0.0, abs(f.x - x));
  float trail = smoothstep(head + len, head, f.y) * step(head, f.y);
  return line * trail;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  float I = uIntensity;
  float t = iTime;

  // Clouds: slow drift with a bit of domain warping.
  vec2 q = p * vec2(1.6, 2.6) + vec2(t * 0.03, 0.0);
  float w = fbm(q + vec2(fbm(q + t * 0.02), fbm(q - 3.7)));
  float clouds = smoothstep(0.25, 0.85, w);

  // City light pollution from below (magenta / orange), fading upward.
  float glowH = exp(-uv.y * 3.0);
  vec3 cityGlow = mix(vec3(0.55, 0.12, 0.45), vec3(0.8, 0.35, 0.1), 0.5 + 0.5 * sin(uv.x * 3.0 + 1.0));
  vec3 sky = vec3(0.015, 0.02, 0.035);
  sky += cityGlow * glowH * 0.35;
  sky += mix(vec3(0.03, 0.035, 0.05), cityGlow * 0.5, glowH) * clouds;

  // Rare lightning flicker inside the clouds.
  float ft = floor(t * 1.5);
  float flash = step(0.96, hash11(ft)) * exp(-fract(t * 1.5) * 6.0) * (0.6 + 0.4 * sin(t * 60.0));
  sky += vec3(0.5, 0.55, 0.7) * flash * clouds * 0.6 * min(I, 1.5);

  // City skyline silhouette with lit windows.
  float bx = floor(p.x * 9.0);
  float bh = 0.08 + 0.17 * hash11(bx * 3.1) + 0.08 * step(0.85, hash11(bx * 7.3));
  vec3 col = sky;
  if (uv.y < bh) {
    col = vec3(0.01, 0.008, 0.015);
    vec2 wc = vec2(p.x * 90.0, uv.y * 110.0);
    vec2 wid = floor(wc);
    vec2 wf = fract(wc);
    float lit = step(0.72, hash12(wid)) * step(0.2, wf.x) * step(wf.x, 0.75) * step(0.25, wf.y) * step(wf.y, 0.7);
    lit *= step(0.08, hash11(floor(t * 0.5) + wid.x * 13.0 + wid.y)); // windows switch occasionally
    vec3 wcol = hash12(wid + 9.0) > 0.7 ? vec3(0.1, 0.8, 1.0) : vec3(1.0, 0.65, 0.3);
    col += wcol * lit * 0.55;
    col += cityGlow * 0.05;
  }

  // Rain: far, mid, near layers.
  float r = 0.0;
  r += rain(p, 70.0, 5.0, 1.0, 0.35 * I) * 0.25;
  r += rain(p, 40.0, 7.0, 7.0, 0.3 * I) * 0.45;
  r += rain(p, 22.0, 10.0, 13.0, 0.22 * I) * 0.8;
  vec3 rainCol = mix(vec3(0.55, 0.6, 0.75), cityGlow, 0.3 * glowH) + vec3(0.6) * flash;
  col += rainCol * r * 0.5;

  // Mist near the ground and vignette.
  col += vec3(0.05, 0.05, 0.08) * I * exp(-uv.y * 8.0) * (0.6 + 0.4 * vnoise(p * 3.0 + t * 0.3));
  vec2 v = uv - 0.5;
  col *= 1.0 - 0.5 * dot(v, v);

  fragColor = vec4(col, 1.0);
}
