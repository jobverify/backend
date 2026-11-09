import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('CoRover is wired to a verified same-origin live scraper instead of the generic sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'corover')
  const scraper = buildScrapers().find((item) => item.name === 'corover')

  assert.ok(provider)
  assert.ok(scraper)

  assert.equal(provider.companyName, 'CoRover')
  assert.equal(provider.companyCareerPage, 'https://corover.ai/company/careers')
  assert.equal(provider.companyDomain, 'corover.ai')
  assert.equal(provider.atsPlatform, 'verified-first-party-careers-page-plus-same-origin-detail-pages')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+public-visible-job-cards+same-origin-detail-pages+india-filter',
  )
  assert.equal(provider.verifiedOn, '2026-07-30')
  assert.equal(provider.verifiedPublicJobCount, 4)
  assert.equal(provider.verifiedIndiaJobCount, 4)
  assert.equal(scraper.provider.modulePath, provider.modulePath)
  assert.match(provider.modulePath, /[\\/]corover[\\/]script\.js$/i)
})
