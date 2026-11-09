import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Zivame is wired to a verified same-origin live scraper instead of the generic sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'zivame')
  const scraper = buildScrapers().find((item) => item.name === 'zivame')

  assert.ok(provider)
  assert.ok(scraper)

  assert.equal(provider.companyName, 'Zivame')
  assert.equal(provider.companyCareerPage, 'https://careers.zivame.com/')
  assert.equal(provider.companyDomain, 'careers.zivame.com')
  assert.equal(provider.atsPlatform, 'verified-first-party-careers-page-plus-same-origin-detail-pages')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+public-same-origin-role-pages+india-filter',
  )
  assert.equal(provider.verifiedOn, '2026-07-30')
  assert.equal(provider.verifiedPublicJobCount, 3)
  assert.equal(provider.verifiedIndiaJobCount, 3)
  assert.equal(scraper.provider.modulePath, provider.modulePath)
  assert.match(provider.modulePath, /[\\/]zivame[\\/]script\.js$/i)
})
