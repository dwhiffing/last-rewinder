import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { type ShaderMaterial, Vector2 } from 'three'
import { NIGHT_SKY } from './textures'

// Raindrops on the outside of a pane of glass. Each drop is a little lens:
// it shows the street behind it bent and flipped (sampled from the night
// panorama), with a bright rim where it catches the shop lights. Two layers
// of beads of different sizes sit still on the glass and slowly come and go.
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

  void main() {
    // metres across the glass, so drops are the same size on every pane
    vec2 p = vUv * uSize;
    float t = uTime;

    vec3 a = beads(p, 22.0, t);
    vec3 b = beads(p + 0.37, 34.0, t * 1.3);
    float m = max(a.z, b.z);
    if (m < 0.01) discard;
    vec2 n = a.z > b.z ? a.xy : b.xy;

    // through a drop the street is seen bent and upside down
    vec3 view = normalize(vWorld - cameraPosition);
    vec3 dir = normalize(view + vec3(-n.x, -n.y, 0.0) * 0.6);
    vec3 col = sky(dir) * 1.4;
    // dark edge where the curve turns away, bright glint from the lights
    float edge = length(n);
    col *= mix(1.0, 0.35, smoothstep(0.6, 1.0, edge));
    float glint = pow(max(0.0, dot(normalize(n + 1e-4), normalize(vec2(-0.3, 0.8)))), 6.0) * smoothstep(0.3, 0.8, edge);
    col += vec3(0.85, 0.9, 1.0) * glint * 0.5;

    gl_FragColor = vec4(col, m * 0.18);
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
