// Rising embers over a dark, warm background.
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float emberLayer(vec2 uv, float scale, float speed, float seed) {
  uv *= scale;
  uv.y -= iTime * speed;
  uv.x += sin(uv.y * 0.7 + seed + iTime * 0.5) * 0.35;
  vec2 cell = floor(uv);
  vec2 f = fract(uv) - 0.5;
  vec2 r = hash22(cell + seed) - 0.5;
  float alive = step(0.55, hash12(cell + seed * 3.1));
  float d = length(f - r * 0.7);
  float flicker = 0.6 + 0.4 * sin(iTime * (4.0 + 6.0 * hash12(cell)) + seed);
  return alive * flicker * smoothstep(0.08, 0.0, d);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float h = fragCoord.y / iResolution.y;

  vec3 col = mix(vec3(0.25, 0.06, 0.01), vec3(0.01, 0.005, 0.0), smoothstep(0.0, 0.9, h));
  col += vec3(0.5, 0.15, 0.02) * pow(1.0 - h, 4.0) * (0.8 + 0.2 * sin(iTime * 3.0));

  float e = 0.0;
  e += emberLayer(uv, 6.0, 0.25, 1.0);
  e += emberLayer(uv, 10.0, 0.45, 7.0) * 0.7;
  e += emberLayer(uv, 16.0, 0.70, 13.0) * 0.5;
  e *= uIntensity * (0.4 + 0.8 * (1.0 - h));

  col += e * vec3(1.0, 0.55, 0.15);
  fragColor = vec4(col, 1.0);
}
