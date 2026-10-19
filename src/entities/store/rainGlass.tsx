import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { type ShaderMaterial, Vector2 } from 'three'

// Rain running down a window, after the rain glass in turtle-soup's library.
// Unlike that one this is only the drops: a clear overlay laid just inside
// the glass so the night outside still shows through.
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
  varying vec2 vUv;

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

  void main() {
    // metres across the glass, so drops are the same size on every pane
    vec2 uv = vUv * uSize / 1.2;
    float t = uTime;
    float drops = 0.0;
    drops += drop(uv, t, 0.35, 0.0);
    drops += drop(uv * 1.5 + 0.3, t, 0.25, 1.7);
    drops += drop(uv * 0.8 + 0.7, t, 0.45, 3.1);
    drops += drop(uv * 2.0 + 1.2, t, 0.3, 5.3);
    drops = clamp(drops, 0.0, 1.0);
    gl_FragColor = vec4(vec3(0.75, 0.82, 0.9), drops * 0.4);
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
    () => ({ uTime: { value: Math.random() * 100 }, uSize: { value: new Vector2(width, height) } }),
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
