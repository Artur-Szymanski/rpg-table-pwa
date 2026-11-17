// Scene image with flickering warm firelight and heat shimmer near the bottom.
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

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;

  // Heat shimmer, strongest at the bottom of the screen.
  float shimmer = (noise(vec2(uv.x * 20.0, uv.y * 12.0 - iTime * 3.0)) - 0.5) * 0.006;
  uv.x += shimmer * (1.0 - uv.y) * uIntensity;

  vec3 col = sampleCover(uv).rgb;

  // Flicker: sum of incommensurate sines + noise.
  float t = iTime;
  float flicker = 0.85 + 0.08 * sin(t * 7.3) + 0.05 * sin(t * 13.1 + 1.7) + 0.08 * (noise(vec2(t * 5.0, 0.0)) - 0.5);
  vec2 lightPos = vec2(0.5, 0.15);
  float light = smoothstep(1.1, 0.0, distance(uv * vec2(iResolution.x / iResolution.y, 1.0),
                                              lightPos * vec2(iResolution.x / iResolution.y, 1.0)));
  vec3 warm = vec3(1.0, 0.62, 0.3);

  col *= mix(vec3(0.35, 0.3, 0.4), warm * 1.4, light * flicker * uIntensity);
  fragColor = vec4(col, 1.0);
}
