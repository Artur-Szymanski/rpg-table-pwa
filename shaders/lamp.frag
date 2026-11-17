// Lamp: the screen as a calm LED panel of large distinct pixels, glowing strongly in the
// centre and dimmer toward the edges. uIntensity sets the colour temperature:
// 0 = ~1200 K (candle), 1 = ~2700 K (warm bulb), 2 = ~6500 K (daylight).

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Approximate black-body colour for a temperature in kelvin (normalised RGB).
vec3 kelvin(float k) {
  float t = k / 100.0;
  vec3 c;
  c.r = t <= 66.0 ? 1.0 : clamp(1.292936 * pow(t - 60.0, -0.1332047592), 0.0, 1.0);
  c.g = t <= 66.0 ? clamp(0.3900815788 * log(t) - 0.6318414438, 0.0, 1.0)
                  : clamp(1.129890861 * pow(t - 60.0, -0.0755148492), 0.0, 1.0);
  c.b = t >= 66.0 ? 1.0 : (t <= 19.0 ? 0.0 : clamp(0.5432067891 * log(t - 10.0) - 1.1962540891, 0.0, 1.0));
  return c;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float I = clamp(uIntensity, 0.0, 2.0);
  float K = I < 1.0 ? mix(1200.0, 2700.0, I) : mix(2700.0, 6500.0, I - 1.0);
  vec3 tint = kelvin(K);

  // Grid of large square pixels (about 12 across the shorter side).
  float cell = min(iResolution.x, iResolution.y) / 12.0;
  vec2 g = fragCoord / cell;
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;

  // Brightness is evaluated per pixel (at its centre) so the falloff steps like real LEDs.
  vec2 c = (id + 0.5) * cell;
  vec2 d = (c - 0.5 * iResolution.xy) / min(iResolution.x, iResolution.y);
  float r = length(d * vec2(1.0, 0.8));
  float b = mix(1.0, 0.18, smoothstep(0.0, 0.9, r));
  b += 0.9 * exp(-r * r * 9.0);                                 // hot centre
  b *= 0.95 + 0.05 * hash12(id);                                 // slight LED variation
  b *= 0.97 + 0.03 * sin(iTime * 0.6 + hash12(id + 3.1) * 6.28); // very slow breathing

  // LED shape: rounded square with a soft diffuser and dark gaps between pixels.
  float box = max(abs(f.x), abs(f.y));
  float rounded = length(max(abs(f) - 0.3, 0.0));
  float led = smoothstep(0.12, 0.06, rounded) * smoothstep(0.47, 0.42, box);
  float diffuser = 1.0 - 0.35 * dot(f, f) * 4.0;
  float lit = led * diffuser + (1.0 - led) * 0.12;               // light bleeding into gaps

  vec3 col = tint * b * lit * 1.6;
  col = 1.0 - exp(-col * 1.8);                                   // bright centre saturates to warm white
  fragColor = vec4(col, 1.0);
}
