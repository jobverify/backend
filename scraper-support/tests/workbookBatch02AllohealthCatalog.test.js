import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Allo Health is wired to a verified exact-name no-public-careers scraper instead of the generic sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'allohealth')
  const scraper = buildScrapers().find((item) => item.name === 'allohealth')

  assert.ok(provider)
  assert.ok(scraper)

  assert.equal(provider.companyName, 'Allo Health')
  assert.equal(provider.companyCareerPage, 'https://airtable.com/app3JO79fwEz4srgJ/shrD53PpCm2BKq5O9')
  assert.equal(provider.teamFormUrl, provider.companyCareerPage)
  assert.equal(provider.companyDomain, 'allohealth.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(
    provider.paginationStrategy,
    'verified-homepage-plus-about-page-plus-team-form-and-missing-careers-route-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-exact-name-homepage+verified-team-intake+verified-about-page+verified-missing-careers-route-return-empty',
  )
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.equal(provider.verifiedIndiaJobCount, 0)
  assert.match(provider.modulePath, /[\\/]allohealth[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /October 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.allohealth\.com\/about/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.allohealth\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /general application form/i)

  assert.equal(scraper.provider.modulePath, provider.modulePath)
})
