import assert from 'node:assert/strict'
import test from 'node:test'

import { getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Jindal Steel and Power with the verified first-party no-jobs careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'jindalsteelandpower')

  assert.ok(provider, 'Expected Jindal Steel and Power provider to be registered in customProviders.json')
  assert.equal(provider.companyName, 'Jindal Steel and Power')
  assert.equal(provider.companyCareerPage, 'https://www.jindalsteel.in/career-opportunity')
  assert.equal(provider.companyDomain, 'jindalsteel.in')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.dryRunFile, /jindalsteelandpower[\\/]jobs\.json$/)
})
