import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Bounce is wired to a verified exact-name no-public-careers scraper instead of the generic sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'bounce')
  const scraper = buildScrapers().find((item) => item.name === 'bounce')

  assert.ok(provider)
  assert.ok(scraper)

  assert.equal(provider.companyName, 'Bounce')
  assert.equal(provider.companyCareerPage, 'https://bounce-v2.bounceinfinity.com/about.html')
  assert.equal(provider.companyDomain, 'bounceinfinity.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(
    provider.paginationStrategy,
    'verified-homepage-plus-legacy-about-page-plus-missing-careers-route-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-exact-name-homepage+verified-legacy-about-page+verified-missing-careers-route-return-empty',
  )
  assert.equal(provider.verifiedOn, '2026-07-30')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.equal(provider.verifiedIndiaJobCount, 0)
  assert.match(provider.modulePath, /[\\/]bounce[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, July 30, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/bounceinfinity\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/bounce-v2\.bounceinfinity\.com\/about\.html/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/bounceinfinity\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /Vivekananda Hallekere/i)
  assert.match(provider.verifiedSurfaceSummary, /Varun Agni/i)

  assert.equal(scraper.provider.modulePath, provider.modulePath)
})
