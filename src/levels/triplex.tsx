import { RootProviders } from '../providers'
import { Store } from './store'

export function DebugLevel() {
  return (
    <RootProviders>
      <Store hideCeiling />
      <ambientLight intensity={1} />
    </RootProviders>
  )
}
