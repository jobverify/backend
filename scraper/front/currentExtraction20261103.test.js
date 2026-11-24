// Dated Nov3 adapter controls only; the current native protocol has separate Response/metadata tests.
import { registerCapturedOfficialAtsRecoveryTests } from './historicalRecoveryTestHelper20261121.test.js'

registerCapturedOfficialAtsRecoveryTests({ source: 'front', fixtureURL: new URL('./test-data/ats-recovery-20261103/', import.meta.url) })
