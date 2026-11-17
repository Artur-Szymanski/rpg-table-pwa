// Static fullscreen image (cover fit). uIntensity controls brightness.
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  fragColor = sampleCover(uv) * uIntensity;
}
