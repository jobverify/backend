// Preserve Nov3 historical adapter controls. Current registered full-Response route:
// currentPublication20261121.test.js (no synthetic records claimed as observed).
import { registerCapturedOfficialAtsRecoveryTests } from './historicalRecoveryTestHelper20261121.test.js'

registerCapturedOfficialAtsRecoveryTests({ source: 'loadsmart', fixtureURL: new URL('./test-data/ats-recovery-20261103/', import.meta.url) })
