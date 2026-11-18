// Photo background with an occasional, subtle glitch: every few seconds the colour channels
// drift apart (chromatic aberration) for a moment, a few horizontal slices shift and the
// image flickers slightly. Interlace comes from the global post-process.
// uIntensity: glitch strength and frequency (0 = clean photo).

float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Envelope of the glitch event in the current time slot (0 = calm).
float glitchEnvelope(float t, float I, out float seed) {
  float slotLen = 3.0;
  float slot = floor(t / slotLen);
  seed = slot;
  if (hash11(slot * 1.7) > 0.35 + 0.3 * I) return 0.0;
  float start = 0.3 + 1.8 * hash11(slot * 3.1);
  float len = 0.15 + 0.45 * hash11(slot * 5.3);
  float x = (mod(t, slotLen) - start) / len;
  if (x < 0.0 || x > 1.0) return 0.0;
  return smoothstep(0.0, 0.15, x) * (1.0 - smoothstep(0.6, 1.0, x));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float t = iTime;
  float I = clamp(uIntensity, 0.0, 2.0);
  float seed;
  float e = glitchEnvelope(t, I, seed) * I;
  // Fast stepping while the glitch is on, so it stutters instead of sliding.
  float tick = floor(t * 20.0);

  // A few horizontal slices shifted sideways.
  float band = floor(uv.y * 24.0);
  float sliceOn = step(0.82, hash12(vec2(band, tick + seed)));
  float shift = (hash12(vec2(band * 1.3, tick)) - 0.5) * 0.06 * sliceOn * e;

  // Fine per-line jitter.
  float line = floor(fragCoord.y / 2.0);
  shift += (hash12(vec2(line, tick)) - 0.5) * 0.004 * e;

  // Channels drift apart: direction changes with every tick.
  float ang = hash11(tick + seed * 7.0) * 6.2832;
  vec2 ca = vec2(cos(ang), sin(ang) * 0.3) * (0.002 + 0.016 * e) * e;

  vec2 suv = clamp(uv + vec2(shift, 0.0), 0.0, 1.0);
  vec3 col;
  col.r = sampleCover(clamp(suv + ca, 0.0, 1.0)).r;
  col.g = sampleCover(suv).g;
  col.b = sampleCover(clamp(suv - ca, 0.0, 1.0)).b;

  // Slight flicker and a faint tint on shifted slices.
  col *= 1.0 - 0.08 * e * hash11(tick * 2.3);
  col += vec3(0.04, 0.0, 0.06) * sliceOn * e;

  fragColor = vec4(col, 1.0);
}
