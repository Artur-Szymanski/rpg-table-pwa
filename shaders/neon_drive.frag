// Night drive: flickering street lights and neon signs, motion-blurred as seen from a fast car.
// uIntensity scales speed and blur.

float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 neon(float h) {
  if (h < 0.28) return vec3(1.0, 0.08, 0.55);   // magenta
  if (h < 0.52) return vec3(0.05, 0.85, 1.0);   // cyan
  if (h < 0.70) return vec3(1.0, 0.5, 0.08);    // sodium orange
  if (h < 0.85) return vec3(0.55, 0.2, 1.0);    // violet
  return vec3(1.0, 0.12, 0.1);                   // red
}

// One parallax layer of blurred light blobs. depth: 0 = near (big, fast), 1 = far (small, slow).
vec3 lights(vec2 p, float depth, float seed, float speedK) {
  float speed = mix(2.6, 0.5, depth) * speedK;
  float cellW = mix(0.32, 0.07, depth);
  float x = p.x + iTime * speed;
  float id = floor(x / cellW);
  float stretch = 1.0 + speed * 1.6;
  vec3 acc = vec3(0.0);
  for (int k = -2; k <= 2; k++) {
    float cid = id + float(k);
    float r1 = hash11(cid * 1.37 + seed);
    float r2 = hash11(cid * 2.11 + seed * 3.1);
    float r3 = hash11(cid * 0.73 + seed * 7.7);
    if (r3 < 0.3) continue;
    vec2 c = vec2((cid + 0.5) * cellW + (r1 - 0.5) * cellW * 0.5, mix(0.18, 0.95, r2));
    float size = mix(0.075, 0.018, depth) * (0.6 + 0.7 * r3);
    vec2 d = vec2(x, p.y) - c;
    d.x /= stretch;
    float dist = length(d);
    float disc = smoothstep(size, size * 0.55, dist);
    float halo = exp(-dist / size * 1.6) * 0.35;
    // Neon hum flicker + some signs blinking on and off.
    float flicker = 0.8 + 0.2 * sin(iTime * (18.0 + 30.0 * r1) + r2 * 6.28);
    if (r1 > 0.8) flicker *= step(0.25, hash11(floor(iTime * (2.0 + 4.0 * r2)) + cid));
    acc += neon(hash11(cid + seed * 11.0)) * (disc * 0.9 + halo) * flicker;
  }
  return acc * mix(1.0, 0.45, depth);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  float I = max(uIntensity, 0.05);

  // Dark city night backdrop.
  vec3 col = mix(vec3(0.02, 0.01, 0.04), vec3(0.04, 0.02, 0.07), uv.y);

  col += lights(p, 1.0, 3.0, I);
  col += lights(p, 0.7, 17.0, I);
  col += lights(p, 0.4, 29.0, I);
  col += lights(p, 0.0, 41.0, I) * 0.9;

  // Street lamps sweeping past overhead, washing the scene in orange.
  float period = 1.5;
  float sx = fract((p.x + iTime * 3.2 * I) / period) - 0.5;
  vec2 ld = vec2(sx * period / (1.0 + 4.0 * I), uv.y - 1.05);
  vec3 lamp = vec3(1.0, 0.6, 0.25);
  col += lamp * 0.012 / (dot(ld, ld) + 0.004);
  col += lamp * 0.06 * exp(-abs(sx) * 6.0);

  // Fast horizontal light streaks.
  float line = floor(uv.y * 90.0);
  float sp = hash11(line * 3.3);
  float streak = step(0.93, sp) * smoothstep(0.7, 1.0, fract(p.x * 0.3 + iTime * (1.5 + sp) * I + sp * 9.0));
  col += neon(hash11(line)) * streak * 0.25;

  // Glass: grain + vignette, soft tone map.
  col += (hash12(fragCoord + fract(iTime) * 500.0) - 0.5) * 0.03;
  vec2 v = uv - 0.5;
  col *= 1.0 - 0.7 * dot(v, v);
  col = 1.0 - exp(-col * 1.4);

  fragColor = vec4(col, 1.0);
}
