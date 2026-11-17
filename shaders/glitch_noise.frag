// Analog VHS-style glitch: dark noisy field of horizontal lines, drifting colour bands
// (violet -> white -> cyan), horizontally smeared rows, tracking bar, head-switching noise
// at the bottom and occasional blocky bursts. Works over the scene image if present.

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

// Colour ramp of the bands: deep violet -> pink -> white -> cyan -> teal.
vec3 bandRamp(float x) {
  vec3 a = vec3(0.25, 0.1, 0.5), b = vec3(0.9, 0.5, 1.0), c = vec3(1.0), d = vec3(0.3, 0.9, 1.0), e = vec3(0.05, 0.4, 0.5);
  if (x < 0.25) return mix(a, b, x / 0.25);
  if (x < 0.5) return mix(b, c, (x - 0.25) / 0.25);
  if (x < 0.75) return mix(c, d, (x - 0.5) / 0.25);
  return mix(d, e, (x - 0.75) / 0.25);
}

vec3 field(vec2 uv, float t, float I) {
  if (iChannel0Size.x > 1.5) return sampleCover(clamp(uv, 0.0, 1.0)).rgb;

  // Dark field built from thin horizontal lines with slowly varying brightness.
  float lineY = floor(uv.y * iResolution.y / 3.0);
  float tick = floor(t * 15.0);
  float n = vnoise(vec2(uv.x * 2.5 + t * 0.7, lineY * 0.15 + t * 2.0));
  float r = hash12(vec2(lineY, tick));
  vec3 col = vec3(0.03, 0.05, 0.08) + vec3(0.08, 0.11, 0.16) * n * (0.5 + r);

  // Drifting horizontal colour bands that jump now and then.
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float jump = floor(t * (0.4 + 0.3 * fi) + fi * 1.7);
    float cy = hash11(jump * 3.1 + fi * 11.0) + 0.03 * sin(t * 2.0 + fi);
    float w = 0.006 + 0.04 * hash11(jump + fi * 5.0);
    float d = (uv.y - cy) / w;
    float g = exp(-d * d);
    // Streaky along x: bands fade in and out horizontally.
    float sx = smoothstep(0.1, 0.7, vnoise(vec2(uv.x * 3.0 - t * (1.0 + fi), fi * 7.0 + jump)));
    col += bandRamp(clamp(0.5 + d * 0.25, 0.0, 1.0)) * g * sx * (0.6 + 0.6 * I);
  }

  // Random thin coloured lines (green / magenta).
  float thin = step(0.994, hash12(vec2(lineY, floor(t * 3.0))));
  col += (hash11(lineY) > 0.5 ? vec3(0.2, 1.0, 0.5) : vec3(1.0, 0.3, 0.9)) * thin * 0.7;
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
  float jitter = (hash12(vec2(row, tick)) - 0.5) * (0.004 + 0.05 * burst) * I;

  // Tracking bar rolling down the screen: heavy shift + noise.
  float trackY = fract(-t * 0.12);
  float track = exp(-pow((uv.y - trackY) * 25.0, 2.0)) * I;
  jitter += track * (vnoise(vec2(uv.y * 80.0, t * 20.0)) - 0.5) * 0.08;

  // Head-switching noise at the bottom edge.
  float head = smoothstep(0.05, 0.0, uv.y);
  jitter += head * (hash12(vec2(row, floor(t * 30.0))) - 0.3) * 0.15;

  vec2 suv = uv + vec2(jitter, 0.0);

  // Smeared rows: pixels past x0 repeat (dragged horizontally).
  float blockRow = floor(uv.y * 40.0);
  float smear = step(0.93 - 0.1 * burst, hash12(vec2(blockRow, floor(t * 4.0))));
  float x0 = 0.3 + 0.6 * hash12(vec2(blockRow, tick + 5.0));
  if (smear > 0.5 && suv.x > x0) suv.x = x0;

  // Chroma shift (VHS colour bleeding).
  float ca = (0.004 + 0.02 * burst) * I;
  vec3 col = vec3(field(suv + vec2(ca, 0.0), t, I).r, field(suv, t, I).g, field(suv - vec2(ca * 1.5, 0.0), t, I).b);

  // Bright blocky glitch at the right edge during bursts.
  float bx = smoothstep(0.84, 0.86, uv.x);
  float by0 = hash11(tick + 2.0), by1 = by0 + 0.05 + 0.15 * hash11(tick + 3.0);
  float blk = bx * step(by0, uv.y) * step(uv.y, by1) * burst;
  vec3 blkCol = mix(vec3(1.0), bandRamp(hash12(vec2(floor(uv.x * 40.0), tick))), 0.5);
  col = mix(col, blkCol, blk * 0.85);

  // Static noise: always a little, more in the tracking bar and head area.
  float n = hash12(fragCoord + fract(t * 17.3) * 1000.0);
  col = mix(col, vec3(n), clamp(0.05 * I + track * 0.6 + head * 0.5 + 0.2 * burst, 0.0, 0.9));
  col += vec3(0.9, 0.95, 1.0) * track * 0.15;

  vec2 v = uv - 0.5;
  col *= 1.0 - 0.6 * dot(v, v);
  fragColor = vec4(col, 1.0);
}
