// Swirling arcane portal. uIntensity scales the energy.
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
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float r = length(uv);
  float a = atan(uv.y, uv.x);

  // Polar swirl: angle offset grows toward the center.
  float swirl = a + 1.5 / (r + 0.15) - iTime * 0.6;
  float n = fbm(vec2(swirl * 1.2, r * 4.0 - iTime * 0.8));

  float ring = smoothstep(0.08, 0.0, abs(r - 0.32 - 0.03 * sin(a * 6.0 + iTime * 2.0)));
  float inner = smoothstep(0.34, 0.0, r);

  vec3 c1 = vec3(0.15, 0.55, 1.0);
  vec3 c2 = vec3(0.65, 0.2, 1.0);
  vec3 col = mix(c2, c1, n) * inner * (0.4 + n) * 1.4;
  col += ring * vec3(0.7, 0.85, 1.0) * (0.8 + 0.4 * n);
  col += vec3(0.02, 0.01, 0.05) / (r + 0.3); // ambient glow
  col *= uIntensity;
  col += vec3(1.0) * smoothstep(0.06, 0.0, r) * uIntensity; // bright core

  fragColor = vec4(col, 1.0);
}
