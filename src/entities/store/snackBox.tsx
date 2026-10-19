import { SRGBColorSpace, TextureLoader } from 'three'
import type { SnackType } from '../../data/snacks'
import chipsUrl from '../../assets/chips.webp'
import popcornUrl from '../../assets/popcorn.webp'
import licoriceUrl from '../../assets/licorice.webp'
import candyUrl from '../../assets/candy.webp'

// Boxed snacks: the package art on the front (+z), a matching colour on the
// other faces. Sizes follow each texture's aspect ratio.
const loader = new TextureLoader()
function art(url: string) {
  const tex = loader.load(url)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

export type BoxSnack = Exclude<SnackType, 'Soda'>
export const SNACK_ART: Record<BoxSnack, string> = {
  Chips: chipsUrl,
  Popcorn: popcornUrl,
  Licorice: licoriceUrl,
  Candy: candyUrl,
}
const BOXES: Record<BoxSnack, { map: ReturnType<typeof art>; aspect: number; depth: number; color: string }> = {
  Chips: { map: art(chipsUrl), aspect: 506 / 306, depth: 0.07, color: '#1c2f73' },
  Popcorn: { map: art(popcornUrl), aspect: 247 / 322, depth: 0.08, color: '#1f4fc4' },
  Licorice: { map: art(licoriceUrl), aspect: 198 / 365, depth: 0.05, color: '#c61f26' },
  Candy: { map: art(candyUrl), aspect: 236 / 407, depth: 0.06, color: '#f4cf1f' },
}

// As wide as two slots allow, unless that would be taller than the tier
export const snackBoxSize = (type: BoxSnack, maxW: number, maxH: number): [number, number, number] => {
  const w = Math.min(maxW, maxH / BOXES[type].aspect)
  return [w, w * BOXES[type].aspect, BOXES[type].depth]
}

export function SnackBox({
  type,
  size,
  position,
  name,
  userData,
}: {
  type: BoxSnack
  size: [number, number, number]
  position: [number, number, number]
  name?: string
  userData?: Record<string, unknown>
}) {
  const box = BOXES[type]
  return (
    <mesh name={name} userData={userData} position={position} receiveShadow>
      <boxGeometry args={size} />
      {/* box faces are +x, -x, +y, -y, +z (front), -z */}
      {[0, 1, 2, 3, 4, 5].map((face) =>
        face === 4 ? (
          <meshStandardMaterial key={face} attach={`material-${face}`} map={box.map} roughness={0.5} />
        ) : (
          <meshStandardMaterial key={face} attach={`material-${face}`} color={box.color} roughness={0.5} />
        ),
      )}
    </mesh>
  )
}

export default SnackBox
