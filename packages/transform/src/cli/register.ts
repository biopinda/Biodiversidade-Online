import { registerCheckLockCli } from './checkLock'
import { registerRunTransformCli } from './runTransform'
import { registerTransformOccurrencesCli } from './transformOccurrences'
import { registerTransformTaxaCli } from './transformTaxa'

export function initializeCliRegistry(): void {
  registerRunTransformCli()
  registerCheckLockCli()
  registerTransformTaxaCli()
  registerTransformOccurrencesCli()
}
