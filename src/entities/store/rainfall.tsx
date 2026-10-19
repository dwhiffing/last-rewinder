import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { BufferAttribute, BufferGeometry, type ShaderMaterial } from 'three'

// Rain falling outside the shop front: thin streaks in a box of air beyond
// the windows, each falling at its own speed and wrapping back to the top.
// The streak tops are dim and the bottoms brighter, like motion-blurred drops.
const COUNT = 1400
const STREAK = 0.18
const HEIGHT = 4

const vertexShader = /* glsl */ `
  uniform float uTime;
  attribute float aSpeed;
  attribute float aEnd;
  varying float vEnd;
  void main() {
    vec3 p = position;
    p.y = mod(p.y - uTime * aSpeed, ${HEIGHT.toFixed(1)}) - aEnd * ${STREAK.toFixed(2)};
    p.x += aEnd * 0.02; // a little slant from the wind
    vEnd = aEnd;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  varying float vEnd;
  void main() {
    gl_FragColor = vec4(vec3(0.62, 0.68, 0.78), mix(0.05, 0.35, vEnd));
    #include <colorspace_fragment>
  }
`

export function Rainfall({
  width,
  depth,
  position,
}: {
  width: number
  depth: number
  position: [number, number, number]
}) {
  const material = useRef<ShaderMaterial>(null)
  const geometry = useMemo(() => {
    const pos = new Float32Array(COUNT * 2 * 3)
    const speed = new Float32Array(COUNT * 2)
    const end = new Float32Array(COUNT * 2)
    for (let i = 0; i < COUNT; i++) {
      const x = (Math.random() - 0.5) * width
      const y = Math.random() * HEIGHT
      const z = -Math.random() * depth
      const s = 6 + Math.random() * 3
      for (let j = 0; j < 2; j++) {
        pos.set([x, y, z], (i * 2 + j) * 3)
        speed[i * 2 + j] = s
        end[i * 2 + j] = j
      }
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(pos, 3))
    g.setAttribute('aSpeed', new BufferAttribute(speed, 1))
    g.setAttribute('aEnd', new BufferAttribute(end, 1))
    return g
  }, [width, depth])
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])
  useFrame((_, delta) => {
    if (material.current) material.current.uniforms.uTime.value += delta
  })
  return (
    <lineSegments geometry={geometry} position={position} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </lineSegments>
  )
}

export default Rainfall
