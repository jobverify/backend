import assert from 'node:assert/strict'
import test from 'node:test'

import { getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Chegg on the verified official jobs page and Workday handoff', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'chegg')

  assert.ok(provider, 'Expected Chegg provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Chegg')
  assert.equal(provider.companyCareerPage, 'https://osv-chegg.wd5.myworkdayjobs.com/Chegg')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-workday-board-plus-workday-runner')
  assert.equal(
    provider.extractionStrategy,
    'verified-workday-board+workday-detail-pages',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'chegg.com')
  assert.match(provider.modulePath, /chegg\.workday[\\/]script\.js$/i)
})
