import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Amrutam is wired to a verified exact-name no-public-careers scraper instead of the generic sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'amrutam')
  const scraper = buildScrapers().find((item) => item.name === 'amrutam')

  assert.ok(provider)
  assert.ok(scraper)

  assert.equal(provider.companyName, 'Amrutam')
  assert.equal(provider.companyCareerPage, 'https://amrutam.co.in/')
  assert.equal(provider.companyDomain, 'amrutam.co.in')
  assert.equal(provider.applicationFormUrl, 'https://forms.gle/YCyYEZ5BLToeqw7u9')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(
    provider.paginationStrategy,
    'verified-homepage-plus-team-page-plus-story-page-plus-work-with-us-form-plus-branded-404-careers-routes-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-exact-name-homepage+verified-team-and-story-pages+verified-work-with-us-form+verified-missing-careers-routes-return-empty',
  )
  assert.equal(provider.verifiedOn, '2026-07-30')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.equal(provider.verifiedIndiaJobCount, 0)
  assert.match(provider.modulePath, /[\\/]amrutam[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, July 30, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/amrutam\.co\.in\/pages\/meet-the-team/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/amrutam\.co\.in\/pages\/our-story-the-journey-of-amrutam-1/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/forms\.gle\/YCyYEZ5BLToeqw7u9/i)
  assert.match(provider.verifiedSurfaceSummary, /Work with Amrutam/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/amrutam\.co\.in\/careers/i)

  assert.equal(scraper.provider.modulePath, provider.modulePath)
})
