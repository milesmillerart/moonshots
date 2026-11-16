// Colour grade toward the cover art (warden-cover-with-blade.jpg): crushed, slightly teal shadows, neutral greys,
// saturated red/magenta highlights kept, gentle S-curve, vignette, subtle animated film grain. Runs after OutputPass
// (display space), so it is cheap on every tier.
export function makeGradePass(THREE, Q) {
  const shader = {
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: Q.grain ? 0.045 : 0.0 }, uVig: { value: 0.42 },
      uLift: { value: new THREE.Vector3(0.006, 0.022, 0.028) }, uGain: { value: new THREE.Vector3(0.96, 1.0, 1.02) }, uSat: { value: 0.74 }, uContrast: { value: 1.08 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uGrain, uVig, uSat, uContrast; uniform vec3 uLift, uGain; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec4 c = texture2D(tDiffuse, vUv); vec3 col = c.rgb;
        float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
        // keep strong reds (the Synthblade, visor, neon) saturated; mute everything else toward the cover's greys
        float red = smoothstep(0.15, 0.6, col.r - max(col.g, col.b));
        float cyan = smoothstep(0.08, 0.4, min(col.g, col.b) - col.r); // the cover's teal window/neon accents
        col = mix(vec3(l), col, mix(uSat, 1.12, max(red, cyan * 0.9)));
        col = (col - 0.5) * uContrast + 0.5;
        col = col * uGain + uLift * (1.0 - l);
        vec2 d = vUv - 0.5; float v = 1.0 - uVig * smoothstep(0.25, 0.85, length(d * vec2(1.1, 1.0)));
        col *= v;
        col += (h(vUv * 1000.0 + fract(uTime) * 91.7) - 0.5) * uGrain;
        gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
      }`,
  };
  const p = new THREE.ShaderPass(shader);
  return p;
}
