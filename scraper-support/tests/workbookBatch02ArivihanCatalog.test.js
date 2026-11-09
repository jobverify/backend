import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Arivihan is wired to a verified exact-name no-public-careers scraper instead of the generic sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'arivihan')
  const scraper = buildScrapers().find((item) => item.name === 'arivihan')

  assert.ok(provider)
  assert.ok(scraper)

  assert.equal(provider.companyName, 'Arivihan')
  assert.equal(provider.companyCareerPage, 'https://www.arivihan.com/about')
  assert.equal(provider.companyDomain, 'arivihan.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(
    provider.paginationStrategy,
    'verified-homepage-plus-about-page-plus-missing-careers-route-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-exact-name-homepage+verified-about-page+verified-missing-careers-route-return-empty',
  )
  assert.equal(provider.verifiedOn, '2026-08-01')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.equal(provider.verifiedIndiaJobCount, 0)
  assert.match(provider.modulePath, /[\\/]arivihan[\\/]script\.js$/)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, August 1, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.arivihan\.com\/about/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.arivihan\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /About Us/i)
  assert.match(provider.verifiedSurfaceSummary, /Our Mission/i)

  assert.equal(scraper.provider.modulePath, provider.modulePath)
})
