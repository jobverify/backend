import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('APISero is wired to a verified exact-name parent-redirect scraper instead of the generic sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'apisero')
  const scraper = buildScrapers().find((item) => item.name === 'apisero')

  assert.ok(provider)
  assert.ok(scraper)

  assert.equal(provider.companyName, 'APISero')
  assert.equal(provider.companyCareerPage, 'https://apisero.com/')
  assert.equal(provider.companyDomain, 'apisero.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(
    provider.paginationStrategy,
    'verified-homepage-careers-jobs-and-about-routes-redirect-to-parent-about-page-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-exact-name-routes-redirect-to-parent-company-about-page-return-empty',
  )
  assert.equal(provider.verifiedOn, '2026-07-30')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.equal(provider.verifiedIndiaJobCount, 0)
  assert.match(provider.modulePath, /[\\/]apisero[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, July 30, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/apisero\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/apisero\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/apisero\.com\/jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.nttdata\.com\/en-us\/about-us\//i)
  assert.match(provider.verifiedSurfaceSummary, /NTT DATA/i)

  assert.equal(scraper.provider.modulePath, provider.modulePath)
})
