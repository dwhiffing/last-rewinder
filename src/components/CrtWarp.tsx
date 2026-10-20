import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import useGameStore from '../stores/gameStore'

// Bulges the picture like the curved glass of a tube TV and darkens toward
// the edges; anything pushed past the edge of the glass goes black, and the
// picture's corners are rounded off like the tube's
const BarrelShader = {
  uniforms: {
    tDiffuse: { value: null },
    strength: { value: 0.05 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float strength;
    varying vec2 vUv;
    void main() {
      vec2 c = vUv * 2.0 - 1.0;
      c *= 1.0 + strength * dot(c, c);
      vec2 uv = c * 0.5 + 0.5;
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
      }
      vec4 color = texture2D(tDiffuse, uv);
      float shade = 1.0 - 0.35 * pow(length(c) / 1.414, 3.0);
      // corner radius as a fraction of width and height (round on a 16:9 screen)
      vec2 radius = vec2(0.035, 0.062);
      vec2 q = (abs(uv - 0.5) - (0.5 - radius)) / radius;
      float corner = 1.0 - smoothstep(0.92, 1.0, length(max(q, 0.0)));
      gl_FragColor = vec4(color.rgb * shade * corner, color.a);
    }
  `,
}

// Takes over rendering the 3D view so it can be bent through the shader.
// With the VHS effect off it renders the scene as normal.
export function CrtWarp() {
  const { gl, scene, camera, size } = useThree()
  const on = useGameStore((s) => s.vhsOn)
  const composer = useMemo(() => {
    const c = new EffectComposer(gl)
    c.addPass(new RenderPass(scene, camera))
    c.addPass(new ShaderPass(BarrelShader))
    c.addPass(new OutputPass())
    return c
  }, [gl, scene, camera])
  useEffect(() => {
    composer.setPixelRatio(gl.getPixelRatio())
    composer.setSize(size.width, size.height)
  }, [composer, gl, size])
  useEffect(() => () => composer.dispose(), [composer])
  useFrame((_, delta) => {
    if (on) composer.render(delta)
    else gl.render(scene, camera)
  }, 1)
  return null
}

export default CrtWarp
