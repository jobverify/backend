import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Zoomcar is wired to a verified exact-name no-public-careers scraper instead of the generic sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'zoomcar')
  const scraper = buildScrapers().find((item) => item.name === 'zoomcar')

  assert.ok(provider)
  assert.ok(scraper)

  assert.equal(provider.companyName, 'ZoomCar')
  assert.equal(provider.companyCareerPage, 'https://www.zoomcar.com/careers')
  assert.equal(provider.companyDomain, 'zoomcar.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(
    provider.paginationStrategy,
    'verified-homepage-plus-careers-route-plus-jobs-route-marketing-shell-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-exact-name-homepage+verified-careers-and-jobs-routes-serving-consumer-marketing-shell-return-empty',
  )
  assert.equal(provider.verifiedOn, '2026-07-30')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.equal(provider.verifiedIndiaJobCount, 0)
  assert.match(provider.modulePath, /[\\/]zoomcar[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, July 30, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.zoomcar\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.zoomcar\.com\/jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /same consumer booking shell/i)

  assert.equal(scraper.provider.modulePath, provider.modulePath)
})
