// Analog VHS-style glitch: dark field of horizontal lines with dim drifting colour bands,
// zones of coloured RGB static, thin RGB-split lines, blocks of pastel vertical bars with
// colour fringes, smeared rows, tracking noise and head-switching noise at the bottom.
// No blown-out bright bands. Works over the scene image if present.

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
vec3 rgbNoise(vec2 p) { return vec3(hash12(p), hash12(p + 71.3), hash12(p + 143.9)); }

// Muted band colours: violet -> blue -> teal (no white core).
vec3 bandRamp(float x) {
  vec3 a = vec3(0.35, 0.15, 0.6), b = vec3(0.25, 0.3, 0.75), c = vec3(0.1, 0.5, 0.6);
  return x < 0.5 ? mix(a, b, x * 2.0) : mix(b, c, x * 2.0 - 2.0 * 0.5);
}

// Pastel stripe palette for the vertical bar blocks.
vec3 pastel(float h) {
  if (h < 0.2) return vec3(0.95, 0.95, 1.0);
  if (h < 0.4) return vec3(0.6, 0.95, 1.0);
  if (h < 0.6) return vec3(1.0, 0.65, 0.95);
  if (h < 0.8) return vec3(0.75, 0.6, 1.0);
  return vec3(0.85, 0.9, 0.75);
}

// Block of vertical colour bars: up to 3 at a time, each living for a short while.
vec3 barBlocks(vec2 uv, float t, float I, out float cover) {
  cover = 0.0;
  vec3 col = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float slot = floor(t * (0.7 + 0.25 * fi) + fi * 3.1);
    if (hash11(slot * 1.9 + fi) > 0.45 * I + 0.1) continue;
    vec2 lo = vec2(hash11(slot + fi * 7.0), hash11(slot * 3.3 + fi)) * vec2(0.8, 0.9);
    vec2 size = vec2(0.12 + 0.35 * hash11(slot + 5.5), 0.04 + 0.2 * hash11(slot + 9.1));
    vec2 rel = (uv - lo) / size;
    if (rel.x < 0.0 || rel.x > 1.0 || rel.y < 0.0 || rel.y > 1.0) continue;
    float stripes = 4.0 + floor(8.0 * hash11(slot + 2.2));
    float sid = floor(rel.x * stripes);
    vec3 c = pastel(hash11(sid * 1.7 + slot)) * (0.55 + 0.25 * hash11(sid + slot * 0.3));
    col = c;
    cover = 1.0;
  }
  return col;
}

vec3 field(vec2 uv, float t, float I) {
  vec3 col;
  float lineY = floor(uv.y * iResolution.y / 3.0);
  if (iChannel0Size.x > 1.5) {
    col = sampleCover(clamp(uv, 0.0, 1.0)).rgb;
  } else {
    // Dark field of thin horizontal lines with slowly varying brightness.
    float tick = floor(t * 15.0);
    float n = vnoise(vec2(uv.x * 2.5 + t * 0.7, lineY * 0.15 + t * 2.0));
    float r = hash12(vec2(lineY, tick));
    col = vec3(0.03, 0.04, 0.08) + vec3(0.07, 0.08, 0.15) * n * (0.5 + r);

    // Dim, drifting colour bands (kept well below white).
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float jump = floor(t * (0.4 + 0.3 * fi) + fi * 1.7);
      float cy = hash11(jump * 3.1 + fi * 11.0) + 0.03 * sin(t * 2.0 + fi);
      float w = 0.01 + 0.05 * hash11(jump + fi * 5.0);
      float d = (uv.y - cy) / w;
      float g = exp(-d * d);
      float sx = smoothstep(0.1, 0.7, vnoise(vec2(uv.x * 3.0 - t * (1.0 + fi), fi * 7.0 + jump)));
      col += bandRamp(clamp(0.5 + d * 0.25, 0.0, 1.0)) * g * sx * 0.28 * I;
    }
  }

  float cover;
  vec3 bars = barBlocks(uv, t, I, cover);
  col = mix(col, bars, cover);
  return col;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float t = iTime;
  float I = uIntensity;
  float tick = floor(t * 10.0);
  float burst = step(0.8, hash11(tick * 1.3)) * I;

  // Per-row horizontal jitter, stronger during bursts.
  float row = floor(uv.y * iResolution.y / 3.0);
  float jitter = (hash12(vec2(row, tick)) - 0.5) * (0.004 + 0.04 * burst) * I;

  // Tracking zone rolling down: shift + noise (no bright bar).
  float trackY = fract(-t * 0.12);
  float track = exp(-pow((uv.y - trackY) * 18.0, 2.0)) * I;
  jitter += track * (vnoise(vec2(uv.y * 80.0, t * 20.0)) - 0.5) * 0.06;

  // Head-switching noise at the bottom edge.
  float head = smoothstep(0.05, 0.0, uv.y);
  jitter += head * (hash12(vec2(row, floor(t * 30.0))) - 0.3) * 0.15;

  vec2 suv = uv + vec2(jitter, 0.0);

  // Smeared rows: pixels past x0 repeat (dragged horizontally).
  float blockRow = floor(uv.y * 40.0);
  float smear = step(0.94 - 0.1 * burst, hash12(vec2(blockRow, floor(t * 4.0))));
  float x0 = 0.3 + 0.6 * hash12(vec2(blockRow, tick + 5.0));
  if (smear > 0.5 && suv.x > x0) suv.x = x0;

  // Chroma shift gives the colour fringes on bar blocks and edges.
  float ca = (0.005 + 0.015 * burst) * I;
  vec3 col = vec3(field(suv + vec2(ca, 0.0), t, I).r, field(suv, t, I).g, field(suv - vec2(ca * 1.5, 0.0), t, I).b);

  // Thin RGB-split lines: red, green and blue copies a few pixels apart.
  float lpx = iResolution.y / 3.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float slot = floor(t * (1.5 + fi) + fi * 2.3);
    if (hash11(slot + fi * 9.0) > 0.6) continue;
    float y = floor(hash11(slot * 4.1 + fi) * lpx);
    float span = 0.4 + 0.6 * hash11(slot + 1.1);
    float sx0 = hash11(slot + 2.2) * (1.0 - span);
    float inx = step(sx0, uv.x) * step(uv.x, sx0 + span);
    float ly = floor(fragCoord.y / 3.0);
    col += vec3(1.0, 0.15, 0.2) * step(abs(ly - y), 0.0) * inx * 0.7;
    col += vec3(0.2, 1.0, 0.3) * step(abs(ly - y - 1.0), 0.0) * inx * 0.6;
    col += vec3(0.25, 0.35, 1.0) * step(abs(ly - y - 2.0), 0.0) * inx * 0.8;
  }

  // Zones of coloured RGB static (snow), denser toward one edge, with hot spots.
  vec3 snow = rgbNoise(floor(fragCoord / 2.0) + fract(t * 23.7) * 977.0);
  snow = mix(vec3(dot(snow, vec3(0.33))), snow, 0.8);
  float zt = floor(t * 0.8);
  float zoneEdge = 0.25 + 0.5 * hash11(zt);
  float zoneDir = hash11(zt + 3.0) > 0.5 ? 1.0 : -1.0;
  float zone = smoothstep(0.0, 0.25, (zoneEdge - uv.y) * zoneDir) * step(0.45, hash11(zt + 7.0));
  zone *= 0.5 + 0.5 * vnoise(vec2(uv.x * 4.0, uv.y * 30.0 + t * 5.0));
  vec2 hs = vec2(hash11(zt + 11.0), zoneDir > 0.0 ? zoneEdge * 0.4 : 1.0 - (1.0 - zoneEdge) * 0.4);
  float hot = exp(-length((uv - hs) * vec2(3.0, 6.0)) * 2.5) * zone;
  float snowAmt = clamp(0.05 * I + (zone * 0.6 + hot * 0.4) * I + track * 0.5 + head * 0.6 + 0.15 * burst, 0.0, 0.9);
  col = mix(col, snow * (0.75 + 0.5 * hot), snowAmt);

  vec2 v = uv - 0.5;
  col *= 1.0 - 0.6 * dot(v, v);
  fragColor = vec4(col, 1.0);
}
