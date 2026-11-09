import { registerCapturedOfficialAtsRecoveryTests } from '../../scraper-support/tests/helpers/capturedOfficialAtsRecovery.js'

registerCapturedOfficialAtsRecoveryTests({ source: 'front', fixtureURL: new URL('./test-data/ats-recovery-20261103/', import.meta.url) })
