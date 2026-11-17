// Cyberpunk glitch: block displacement, RGB split, static noise, scanlines, occasional bursts.
// Works over the scene image if present, otherwise over a dark neon grid.

float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 backdrop(vec2 uv) {
  float hasImg = step(2.0, iChannel0Size.x);
  vec3 img = sampleCover(clamp(uv, 0.0, 1.0)).rgb;
  vec3 bg = mix(vec3(0.03, 0.0, 0.06), vec3(0.0, 0.04, 0.07), uv.y);
  vec2 g = abs(fract(uv * vec2(18.0, 32.0)) - 0.5);
  bg += vec3(0.0, 0.5, 0.6) * smoothstep(0.46, 0.5, max(g.x, g.y)) * 0.18;
  return mix(bg, img, hasImg);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float t = iTime;
  float I = uIntensity;

  // Glitch "ticks": mostly calm, sometimes a burst.
  float tick = floor(t * 9.0);
  float burst = step(0.78, hash11(tick)) * (0.5 + 0.5 * hash11(tick + 7.0));
  float g = (0.2 + burst) * I;

  // Horizontal block displacement.
  float rows = 8.0 + 40.0 * hash11(tick + 3.0);
  float row = floor(uv.y * rows);
  float isOn = step(1.0 - 0.3 * g, hash12(vec2(row * 1.7, tick + 1.0)));
  float shift = (hash12(vec2(row, tick)) - 0.5) * 0.3 * g * isOn;
  // Fine line jitter.
  shift += (hash12(vec2(floor(fragCoord.y / 2.0), floor(t * 60.0))) - 0.5) * 0.003 * I;
  vec2 uvs = uv + vec2(shift, 0.0);

  // RGB split.
  float ca = 0.004 * I + 0.025 * burst * I;
  vec3 col = vec3(backdrop(uvs + vec2(ca, 0.0)).r, backdrop(uvs).g, backdrop(uvs - vec2(ca, 0.0)).b);

  // Colored corrupt blocks during bursts.
  vec2 blk = floor(uv * vec2(14.0, 26.0));
  float b = step(0.992 - 0.05 * burst * I, hash12(blk + tick * 1.3));
  vec3 blkCol = hash12(blk + 5.0) > 0.5 ? vec3(1.0, 0.1, 0.7) : vec3(0.0, 0.95, 1.0);
  col = mix(col, blkCol * (0.6 + 0.4 * hash12(fragCoord + t)), b * min(I, 1.0));

  // Static noise.
  float n = hash12(fragCoord + fract(t * 13.1) * 1000.0);
  col = mix(col, vec3(n), clamp(0.08 * I + 0.35 * burst * I, 0.0, 0.9));

  // Rolling bright band and occasional tear line.
  col += vec3(0.05, 0.08, 0.1) * I * exp(-pow((fract(uv.y + t * 0.17) - 0.5) * 18.0, 2.0));
  float tear = step(0.995, hash12(vec2(floor(fragCoord.y / 3.0), tick)));
  col += vec3(0.6, 0.9, 1.0) * tear * burst * I;

  // Scanlines and vignette.
  col *= 0.82 + 0.18 * sin(fragCoord.y * 1.5708);
  vec2 v = uv - 0.5;
  col *= 1.0 - 0.6 * dot(v, v);

  fragColor = vec4(col, 1.0);
}
