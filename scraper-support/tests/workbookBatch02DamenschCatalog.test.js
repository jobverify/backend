import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('DaMENSCH is wired to a verified official-site no-public-careers scraper instead of the generic sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'damensch')
  const scraper = buildScrapers().find((item) => item.name === 'damensch')

  assert.ok(provider)
  assert.ok(scraper)

  assert.equal(provider.companyName, 'DaMENSCH')
  assert.equal(provider.companyCareerPage, 'https://www.damensch.com/about-us')
  assert.equal(provider.companyDomain, 'damensch.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(
    provider.paginationStrategy,
    'verified-homepage-plus-about-page-plus-branded-404-careers-and-jobs-routes-plus-storefront-pages-careers-shell-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-exact-name-homepage+verified-about-page+verified-missing-careers-and-jobs-routes+verified-storefront-pages-careers-shell-return-empty',
  )
  assert.equal(provider.verifiedOn, '2026-07-30')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.equal(provider.verifiedIndiaJobCount, 0)
  assert.match(provider.modulePath, /[\\/]damensch[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, July 30, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.damensch\.com\/about-us/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.damensch\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.damensch\.com\/jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.damensch\.com\/pages\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /About Damensch/i)
  assert.match(provider.verifiedSurfaceSummary, /404 Page not found/i)
  assert.match(provider.verifiedSurfaceSummary, /Experience the DaMENSCH Mobile App/i)

  assert.equal(scraper.provider.modulePath, provider.modulePath)
})
