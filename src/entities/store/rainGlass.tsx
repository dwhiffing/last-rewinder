import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { type ShaderMaterial, Vector2 } from 'three'
import { NIGHT_SKY } from './textures'

// Raindrops on the outside of a pane of glass. Each drop is a little lens:
// it shows the street behind it bent and flipped (sampled from the night
// panorama), with a bright rim where it catches the shop lights. There are
// two kinds: small beads that sit still and slowly come and go, and bigger
// drops that now and then slide down, wobbling, with a trail of beads behind.
const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const fragmentShader = /* glsl */ `
  uniform sampler2D uSky;
  uniform float uTime;
  uniform vec2 uSize;
  varying vec2 vUv;
  varying vec3 vWorld;

  #define PI 3.14159265

  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  // Look up the night panorama the same way the scene background does
  // (it is turned -90 degrees about y)
  vec3 sky(vec3 dir) {
    float c = cos(-PI / 2.0), s = sin(-PI / 2.0);
    dir = vec3(c * dir.x + s * dir.z, dir.y, -s * dir.x + c * dir.z);
    vec2 uv = vec2(atan(dir.z, dir.x) / (2.0 * PI) + 0.5, asin(clamp(dir.y, -1.0, 1.0)) / PI + 0.5);
    return texture2D(uSky, uv).rgb;
  }

  // Still beads: one per cell, fading in and out at its own pace.
  // xy = offset from the bead's centre (scaled by its size), z = coverage
  vec3 beads(vec2 p, float cells, float t) {
    vec2 q = p * cells;
    vec2 id = floor(q);
    float h = hash(id);
    vec2 centre = vec2(hash(id + 3.1), hash(id + 7.7)) * 0.6 + 0.2;
    float life = sin(t * (0.05 + h * 0.1) + h * 6.28) * 0.5 + 0.5;
    float r = (0.08 + 0.18 * hash(id + 1.3)) * smoothstep(0.3, 0.7, life);
    vec2 d = fract(q) - centre;
    float m = smoothstep(r, r * 0.6, length(d));
    return vec3(d / max(r, 1e-3), m);
  }

  // Sliding drops: columns of glass, each with a drop that pauses then
  // runs down, leaving a beaded trail above it
  vec3 runners(vec2 p, float t) {
    vec2 q = p * vec2(9.0, 1.2);
    float col = floor(q.x);
    float h = hash(vec2(col, 4.2));
    if (h > 0.55) return vec3(0.0);
    float speed = 0.06 + h * 0.12;
    // stick-slip: the drop holds still, then lurches down
    float phase = t * speed + h * 13.0;
    float y = 1.0 - fract(phase + 0.15 * sin(phase * 6.28 * 3.0));
    float x = fract(q.x) - 0.5 - 0.1 * sin(q.y * 9.0 + h * 20.0);
    float dy = fract(q.y) - y;
    vec2 d = vec2(x * 4.0, dy * 7.0);
    float head = smoothstep(0.32, 0.2, length(d));
    // beads left behind in the drop's wake
    float trail = smoothstep(0.0, 0.05, dy) * smoothstep(0.45, 0.0, dy);
    float beadY = fract(q.y * 18.0) - 0.5;
    vec2 bd = vec2(x * 4.0, beadY * 0.5);
    float bead = smoothstep(0.12, 0.06, length(bd)) * trail * step(0.4, hash(vec2(col, floor(q.y * 18.0))));
    float m = max(head, bead);
    vec2 n = head > bead ? d / 0.32 : bd / 0.12;
    return vec3(n, m);
  }

  void main() {
    // metres across the glass, so drops are the same size on every pane
    vec2 p = vUv * uSize;
    float t = uTime;

    vec3 a = beads(p, 22.0, t);
    vec3 b = beads(p + 0.37, 34.0, t * 1.3);
    vec3 r = runners(p, t);
    float m = max(max(a.z, b.z), r.z);
    if (m < 0.01) discard;
    vec2 n = a.z > b.z ? a.xy : b.xy;
    if (r.z > max(a.z, b.z)) n = r.xy;

    // through a drop the street is seen bent and upside down
    vec3 view = normalize(vWorld - cameraPosition);
    vec3 dir = normalize(view + vec3(-n.x, -n.y, 0.0) * 0.6);
    vec3 col = sky(dir) * 1.4;
    // dark edge where the curve turns away, bright glint from the lights
    float edge = length(n);
    col *= mix(1.0, 0.35, smoothstep(0.6, 1.0, edge));
    float glint = pow(max(0.0, dot(normalize(n + 1e-4), normalize(vec2(-0.3, 0.8)))), 6.0) * smoothstep(0.3, 0.8, edge);
    col += vec3(0.85, 0.9, 1.0) * glint * 0.5;

    gl_FragColor = vec4(col, m * 0.9);
    #include <colorspace_fragment>
  }
`

export function RainGlass({
  width,
  height,
  position,
}: {
  width: number
  height: number
  position: [number, number, number]
}) {
  const material = useRef<ShaderMaterial>(null)
  const uniforms = useMemo(
    () => ({
      uSky: { value: NIGHT_SKY },
      uTime: { value: Math.random() * 100 },
      uSize: { value: new Vector2(width, height) },
    }),
    [width, height],
  )
  useFrame((_, delta) => {
    if (material.current) material.current.uniforms.uTime.value += delta
  })
  return (
    <mesh position={position}>
      <planeGeometry args={[width, height]} />
      <shaderMaterial
        ref={material}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </mesh>
  )
}

export default RainGlass
