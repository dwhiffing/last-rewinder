import { Controller } from '../entities/controller'
import { Store } from './store'

export function DebugLevel() {
  return (
    <>
      <Controller />
      <Store />
      <hemisphereLight args={['#fffaf0', '#3a4a6b', 0.8]} />
    </>
  )
}
