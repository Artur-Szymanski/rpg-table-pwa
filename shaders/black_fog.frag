// Creeping black fog with faint violet edges. Touch pushes the fog away.
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x),
             mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float t = iTime * 0.08;

  // Domain-warped fbm for slow, swirling motion.
  vec2 q = vec2(fbm(uv * 1.6 + vec2(0.0, t)), fbm(uv * 1.6 + vec2(5.2, -t)));
  float f = fbm(uv * 2.2 + 2.5 * q + vec2(t * 0.7, -t * 0.4));

  // Touch clears a hole in the fog.
  vec2 m = (iMouse.xy - 0.5 * iResolution.xy) / iResolution.y;
  float hole = iMouse.z > 0.0 ? smoothstep(0.35, 0.0, length(uv - m)) : 0.0;

  float density = smoothstep(0.25, 0.75, f) * uIntensity - hole;
  density = clamp(density, 0.0, 1.0);

  vec3 back = mix(vec3(0.10, 0.09, 0.12), vec3(0.22, 0.20, 0.26), fbm(uv * 0.8 - t));
  float rim = smoothstep(0.35, 0.55, f) * (1.0 - smoothstep(0.55, 0.8, f));
  vec3 edge = vec3(0.35, 0.18, 0.55) * rim * 0.5;

  vec3 col = mix(back, vec3(0.0), density) + edge * (1.0 - density);
  col *= 1.0 - 0.6 * dot(uv, uv); // vignette
  fragColor = vec4(col, 1.0);
}
