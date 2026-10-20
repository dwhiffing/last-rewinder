import { Controller } from '../entities/controller'
import useGameStore from '../stores/gameStore'
import { Store } from './store'

export function DebugLevel() {
  // the room's fill light drops to 1% when the power goes out
  const powerOut = useGameStore((s) => s.powerOut)
  return (
    <>
      <Controller />
      <Store />
      <hemisphereLight args={['#fffaf0', '#3a4a6b', powerOut ? 0.004 : 0.246]} />
    </>
  )
}
