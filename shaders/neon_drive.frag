// Neon tunnel drive: flying through a rectangular tunnel of light strips, frame rings and
// flickering ad panels, motion-blurred; now and then a warm street lamp sweeps past overhead.
// uIntensity scales speed (and therefore blur).

float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float BW = 1.15;          // tunnel half width (set from aspect in mainImage)
const float BH = 0.75;    // tunnel half height
const float RING = 3.0;   // distance between frame rings

vec3 neon(float h) {
  if (h < 0.3) return vec3(1.0, 0.12, 0.65);  // magenta
  if (h < 0.6) return vec3(0.1, 0.8, 1.0);    // cyan
  if (h < 0.8) return vec3(0.6, 0.3, 1.0);    // violet
  return vec3(1.0, 0.55, 0.15);               // amber
}

// Soft strip of half-width w centred at 0.
float strip(float x, float w) { return smoothstep(w, w * 0.2, abs(x)); }

// Wall pattern at wall coordinate u (-1..1 across the wall) and world depth Z.
// wall: 0 = right, 1 = left, 2 = ceiling, 3 = floor.
vec3 wallPattern(float u, float Z, float wall, float t) {
  vec3 col = vec3(0.0);
  float ringId = floor(Z / RING);
  float rz = fract(Z / RING) * RING;          // 0..RING within segment

  // Frame rings: bright cross strips at each segment start.
  col += neon(hash11(ringId * 3.7)) * strip(rz - 0.2, 0.12) * 1.4;

  // Lit edges where walls meet (tunnel outline converging to the vanishing point).
  col += vec3(0.85, 0.75, 1.0) * strip(abs(u) - 0.97, 0.03) * 0.6;

  if (wall >= 2.0) {
    // Ceiling / floor light tiles between rings, two across; some off, some pulsing.
    float cell = floor(u * 1.0 + 1.0);                  // 0 or 1 (left / right half)
    float seed = ringId * 5.31 + cell * 13.7 + wall * 3.3;
    float tx = (rz - 0.5) / (RING - 1.0);
    float ty = fract(u + 1.0);
    float tile = step(0.0, tx) * step(tx, 1.0) * strip(ty - 0.5, 0.36);
    float lit = step(0.35, hash11(seed)) * (0.7 + 0.3 * sin(t * 3.0 + seed));
    vec3 tc = mix(vec3(1.0, 0.85, 1.0), neon(hash11(seed + 1.0)), 0.5);
    col += tc * tile * lit * (wall == 2.0 ? 0.9 : 0.35);
  } else {
    // Ad panels between rings; some dark, some flickering.
    float seed = ringId * 7.13 + wall * 31.7;
    float on = step(0.15, hash11(seed));
    float px = (rz - 0.6) / (RING - 1.2);       // 0..1 across panel length
    float py = (u + 0.55) / 1.1;                // 0..1 across panel height
    if (px > 0.0 && px < 1.0 && py > 0.0 && py < 1.0) {
      vec3 pc = neon(hash11(seed + 1.0));
      float kind = hash11(seed + 2.0);
      float content;
      if (kind < 0.35) {
        // LED matrix with scrolling blocks.
        vec2 g = vec2(px * 24.0, py * 10.0);
        float led = step(0.35, length(fract(g) - 0.5) * -1.0 + 0.75);
        content = led * step(0.5, hash12(floor(g) + floor(t * 6.0 + g.x * 0.2)));
      } else if (kind < 0.7) {
        // Vertical bars, like a logo / equalizer.
        float bar = floor(px * 9.0);
        content = step(py, 0.3 + 0.6 * hash11(bar + floor(t * 4.0) + seed)) * step(0.25, fract(px * 9.0));
      } else {
        // Big glowing sign with a gradient.
        content = 0.6 + 0.4 * sin(px * 6.0 + t * 3.0);
      }
      float frame = 1.0 - step(0.04, px) * step(px, 0.96) * step(0.06, py) * step(py, 0.94);
      float flicker = 0.75 + 0.25 * sin(t * (20.0 + 30.0 * hash11(seed + 3.0)));
      flicker *= step(0.1, hash11(floor(t * 8.0) + seed));   // occasional drop-outs
      col += pc * (content * 0.9 + frame * 1.2) * on * flicker;
    }
    // Thin guide light along the bottom edge of side walls.
    col += vec3(0.2, 0.7, 1.0) * strip(u + 0.92, 0.02) * 0.8;
  }
  return col;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float t = iTime;
  float I = max(uIntensity, 0.05);
  float speed = 14.0 * I;
  BW = BH * clamp(iResolution.x / iResolution.y * 1.4, 0.75, 1.6);

  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  // Gentle camera sway and roll.
  float roll = 0.03 * sin(t * 0.6);
  p = mat2(cos(roll), -sin(roll), sin(roll), cos(roll)) * p;
  p += vec2(0.02 * sin(t * 0.7), 0.012 * sin(t * 1.3));
  p *= 1.25; // field of view

  // Ray against the box tunnel.
  float zx = BW / max(abs(p.x), 1e-4);
  float zy = BH / max(abs(p.y), 1e-4);
  float z = min(zx, zy);
  float wall, u;
  if (zx < zy) { wall = p.x > 0.0 ? 0.0 : 1.0; u = p.y * z / BH; }
  else         { wall = p.y > 0.0 ? 2.0 : 3.0; u = p.x * z / BW; }

  // Motion blur: average the pattern over the distance travelled during the "shutter".
  float Z = z + t * speed;
  float blur = speed * 0.022;
  vec3 col = vec3(0.0);
  for (int i = 0; i < 6; i++) {
    col += wallPattern(u, Z - blur * float(i) / 5.0, wall, t);
  }
  col /= 6.0;
  col *= 0.45 + 0.55 * smoothstep(0.5, 2.0, z);   // tame huge near-camera smears

  // Floor: glossy reflection of the ceiling.
  if (wall == 3.0) {
    vec3 refl = vec3(0.0);
    for (int i = 0; i < 4; i++) refl += wallPattern(u * 0.95, Z - blur * float(i) / 3.0 + 0.3, 2.0, t);
    col += refl / 4.0 * 0.35;
  }

  // Base wall tone and distance fog toward a glowing vanishing point.
  col += vec3(0.02, 0.015, 0.04);
  float fog = 1.0 - exp(-z * 0.06);
  vec3 haze = vec3(0.35, 0.2, 0.6);
  col = mix(col, haze, fog * 0.85);
  col += vec3(0.9, 0.6, 1.0) * 0.08 / (dot(p, p) * 30.0 + 0.3);

  // Occasional warm street lamp sweeping past overhead.
  float cyc = 6.0;
  float k = floor(t / cyc);
  if (hash11(k * 1.7) > 0.35) {
    float lampDz = 70.0 - fract(t / cyc) * cyc * speed;  // depth of lamp relative to camera
    vec3 lamp = vec3(1.0, 0.6, 0.25);
    if (wall == 2.0) col += lamp * exp(-pow((z - lampDz) / (1.0 + blur), 2.0)) * strip(u, 0.5) * 2.5;
    col += lamp * 0.45 * exp(-abs(lampDz) / 5.0);   // wash of light when passing
  }

  // Soft tone map.
  col = 1.0 - exp(-col * 1.6);
  vec2 v = fragCoord / iResolution.xy - 0.5;
  col *= 1.0 - 0.5 * dot(v, v);
  fragColor = vec4(col, 1.0);
}
