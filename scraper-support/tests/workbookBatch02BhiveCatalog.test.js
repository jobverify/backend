import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Bhive is wired to a verified WordPress API-backed live scraper instead of the generic sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'bhive')
  const scraper = buildScrapers().find((item) => item.name === 'bhive')

  assert.ok(provider)
  assert.ok(scraper)

  assert.equal(provider.companyName, 'Bhive')
  assert.equal(provider.companyCareerPage, 'https://bhive.careers/jobs/')
  assert.equal(provider.companyDomain, 'bhive.careers')
  assert.equal(provider.atsPlatform, 'wordpress-rest-api')
  assert.equal(provider.paginationStrategy, 'verified-first-party-jobs-page-plus-paged-wordpress-rest-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-jobs-page+public-wordpress-jobs-api+embedded-taxonomies+india-location-normalization',
  )
  assert.equal(provider.verifiedOn, '2026-07-30')
  assert.equal(provider.verifiedPublicJobCount, 17)
  assert.equal(provider.verifiedIndiaJobCount, 17)
  assert.equal(provider.wordPressJobsApiUrl, 'https://bhive.careers/wp-json/wp/v2/jobs')
  assert.equal(scraper.provider.modulePath, provider.modulePath)
  assert.match(provider.modulePath, /[\\/]bhive[\\/]script\.js$/i)
})
