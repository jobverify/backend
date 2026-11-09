import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('BluSmart is wired to a verified exact-name no-public-careers scraper instead of the generic sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'blusmart')
  const scraper = buildScrapers().find((item) => item.name === 'blusmart')

  assert.ok(provider)
  assert.ok(scraper)

  assert.equal(provider.companyName, 'BluSmart')
  assert.equal(provider.companyCareerPage, 'https://blusmart.com/')
  assert.equal(provider.companyDomain, 'blusmart.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(
    provider.paginationStrategy,
    'verified-homepage-plus-legacy-careers-alias-plus-missing-careers-route-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-exact-name-homepage+verified-legacy-careers-alias+verified-missing-careers-route-return-empty',
  )
  assert.equal(provider.verifiedOn, '2026-07-30')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.equal(provider.verifiedIndiaJobCount, 0)
  assert.match(provider.modulePath, /[\\/]blusmart[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, July 30, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /BluSmart tablets/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.blusmart\.in\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/blusmart\.com\/careers/i)

  assert.equal(scraper.provider.modulePath, provider.modulePath)
})
