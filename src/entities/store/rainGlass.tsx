import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Color, type ShaderMaterial, Vector2 } from 'three'

// Rain running down a window, matching the rain glass in turtle-soup's
// library: dark tinted glass with drops and streaks and a faint shimmer.
// Drops are scaled to that game's 0.6 x 0.8m windows so they look the same
// size on every pane here.
const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec2 uSize;
  uniform vec3 uColor;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  // One field of drops falling in columns, each dragging a streak behind it
  float drop(vec2 uv, float t, float speed, float seed) {
    float col = floor(uv.x * 12.0 + seed * 100.0);
    float colHash = hash21(vec2(col, seed));
    if (colHash > 0.5) return 0.0;

    float x = fract(uv.x * 12.0 + seed * 100.0);
    float cx = 0.5 + sin(uv.y * 8.0 + colHash * 6.28 + t * 0.5) * 0.12;
    float dx = x - cx;

    float dropY = fract(-t * speed * (0.3 + colHash * 0.7) + colHash * 10.0);
    float dy = fract(uv.y) - dropY;

    float head = smoothstep(0.06, 0.0, length(vec2(dx * 2.0, dy * 4.0)));
    float trail = smoothstep(0.04, 0.0, abs(dx))
                * smoothstep(0.0, 0.04, dy)
                * smoothstep(0.5, 0.0, dy)
                * 0.4;
    return head + trail;
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    vec2 uv = vUv * uSize / vec2(0.6, 0.8);
    float t = uTime;
    float drops = 0.0;
    drops += drop(uv, t, 0.35, 0.0);
    drops += drop(uv * 1.5 + 0.3, t, 0.25, 1.7);
    drops += drop(uv * 0.8 + 0.7, t, 0.45, 3.1);
    drops += drop(uv * 2.0 + 1.2, t, 0.3, 5.3);
    drops = clamp(drops, 0.0, 1.0);

    vec3 col = uColor;
    col += drops * vec3(0.12, 0.15, 0.2);
    col += noise(uv * 30.0 + t * 0.2) * 0.03;
    gl_FragColor = vec4(col, 0.75 + drops * 0.15);
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
      uTime: { value: Math.random() * 100 },
      uSize: { value: new Vector2(width, height) },
      uColor: { value: new Color('#1a2a3a') },
    }),
    [width, height],
  )
  useFrame((_, delta) => {
    if (material.current) material.current.uniforms.uTime.value += delta * 2
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
