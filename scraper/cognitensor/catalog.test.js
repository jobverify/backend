import assert from 'node:assert/strict'
import test from 'node:test'
import {PROVIDER_METADATA} from './script.js'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../../scraper-support/providers/index.js'

test('CogniTensor candidate preserves exact employer with incomplete native scope', () => {
  const provider = PROVIDER_METADATA

  assert.ok(provider)
  assert.equal(provider.companyName, 'CogniTensor')
  assert.equal(provider.exactCompanyMatchOnly, true)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.cognitensor.com/company/careers')
  assert.equal(provider.companyDomain, 'cognitensor.com')
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.lifecycleCleanupAllowed, false)
  assert.equal(provider.atsPlatform, 'native-employer-linkedin')
  assert.match(provider.modulePath, /cognitensor[\\/]script\.js$/i)
})

test('CogniTensor covers only the literal CSV company name without fuzzy substitution', async () => {
  const report = generateCompanyCoverageReport({
    csvText: 'CogniTensor\nCognitensor Technologies\nCognitiv\n',
    catalog: getScraperCatalog(),
  })

  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source]),
    [['CogniTensor', 'cognitensor']],
  )
  assert.deepEqual(
    report.unmatched.map((item) => item.companyName),
    ['Cognitensor Technologies', 'Cognitiv'],
  )

  assert.equal(PROVIDER_METADATA.sourceListingComplete, false)
})
