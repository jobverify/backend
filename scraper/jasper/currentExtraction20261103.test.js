// Dated Nov3 adapter controls; current metadata-aware native prefix has separate tests.
import { registerCapturedOfficialAtsRecoveryTests } from './historicalRecoveryTestHelper20261121.test.js'

registerCapturedOfficialAtsRecoveryTests({ source: 'jasper', fixtureURL: new URL('./test-data/ats-recovery-20261103/', import.meta.url) })
