import Label from './label'
import { glassTexture } from './textures'

// Anodised aluminium shop door, like a strip-mall entrance: a frame around
// the opening, and one leaf with an upper and lower pane split by a push
// plate. `width` and `height` are the opening; it faces local +z (inside).
const ALUMINIUM = '#b9ab8f'
const FRAME = 0.05
const DEPTH = 0.045

function Bar({ size, position }: { size: [number, number, number]; position: [number, number, number] }) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={ALUMINIUM} metalness={0.55} roughness={0.45} />
    </mesh>
  )
}

function Pane({ size, position }: { size: [number, number]; position: [number, number, number] }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[size[0], size[1], 0.006]} />
      <meshStandardMaterial map={glassTexture(size[0], size[1])} transparent roughness={0.1} depthWrite={false} />
    </mesh>
  )
}

export function Door({
  position,
  width,
  height,
}: {
  position: [number, number, number]
  width: number
  height: number
}) {
  // the leaf fills the frame's inside with a small gap all round
  const leafW = width - FRAME * 2 - 0.01
  const leafH = height - FRAME - 0.015
  const stile = 0.085
  const top = 0.09
  const bottom = 0.17
  const midLow = 0.93
  const midHigh = 1.15
  const paneW = leafW - stile * 2
  const y0 = 0.01 // leaf bottom
  return (
    <group position={position}>
      {/* frame: two jambs and a header */}
      {[-1, 1].map((s) => (
        <Bar key={s} size={[FRAME, height, DEPTH + 0.02]} position={[s * (width / 2 - FRAME / 2), height / 2, 0]} />
      ))}
      <Bar size={[width, FRAME, DEPTH + 0.02]} position={[0, height - FRAME / 2, 0]} />

      {/* leaf: stiles and rails */}
      {[-1, 1].map((s) => (
        <Bar key={s} size={[stile, leafH, DEPTH]} position={[s * (leafW / 2 - stile / 2), y0 + leafH / 2, 0]} />
      ))}
      <Bar size={[paneW, top, DEPTH]} position={[0, y0 + leafH - top / 2, 0]} />
      <Bar size={[paneW, bottom, DEPTH]} position={[0, y0 + bottom / 2, 0]} />
      <Bar size={[paneW, midHigh - midLow, DEPTH]} position={[0, y0 + (midLow + midHigh) / 2, 0]} />

      {/* glass */}
      <Pane size={[paneW, leafH - top - midHigh]} position={[0, y0 + (midHigh + leafH - top) / 2, 0]} />
      <Pane size={[paneW, midLow - bottom]} position={[0, y0 + (bottom + midLow) / 2, 0]} />

      {/* push plate with its dark PUSH strip, on the inside face */}
      <mesh position={[0, y0 + (midLow + midHigh) / 2, DEPTH / 2 + 0.008]} castShadow>
        <boxGeometry args={[paneW * 0.85, 0.15, 0.016]} />
        <meshStandardMaterial color={ALUMINIUM} metalness={0.55} roughness={0.45} />
      </mesh>
      <Label
        text="PUSH"
        position={[0, y0 + (midLow + midHigh) / 2, DEPTH / 2 + 0.017]}
        width={paneW * 0.85}
        height={0.04}
        background="#1c1616"
        color="#f2f2f2"
        align="left"
      />

      {/* door closer on the wall above the frame, its arm reaching to the header
          (the wall's inside face is 0.1 in front of the door) */}
      <Bar size={[0.26, 0.06, 0.07]} position={[-width / 2 + 0.25, height + 0.035, 0.135]} />
      <Bar size={[0.03, 0.015, 0.1]} position={[-width / 2 + 0.36, height + 0.012, 0.075]} />
    </group>
  )
}

export default Door
