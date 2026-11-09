import assert from 'node:assert/strict'
import test from 'node:test'

import { getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Mavenir on the verified homepage and Workday handoff', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'mavenir')

  assert.ok(provider, 'Expected Mavenir provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Mavenir')
  assert.equal(provider.companyCareerPage, 'https://www.mavenir.com/about/careers/')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-homepage-plus-careers-handoff-plus-workday-runner')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-official-careers-page+verified-workday-handoff+workday-detail-pages',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'mavenir.com')
  assert.match(provider.modulePath, /mavenir\.workday[\\/]script\.js$/i)
})
