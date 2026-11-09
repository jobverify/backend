import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Zimyo is wired to the verified first-party empty-state scraper instead of the generic sentinel', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'zimyo')
  const scraper = buildScrapers().find((item) => item.name === 'zimyo')

  assert.ok(provider)
  assert.ok(scraper)

  assert.equal(provider.companyName, 'Zimyo')
  assert.equal(provider.companyCareerPage, 'https://www.zimyo.com/about/career/')
  assert.equal(provider.companyDomain, 'zimyo.com')
  assert.equal(provider.atsPlatform, 'verified-first-party-careers-empty-result')
  assert.equal(provider.paginationStrategy, 'verified-careers-snapshot-empty-result')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-surface+zero-public-job-snapshot+return-empty',
  )
  assert.equal(provider.verifiedOn, '2026-07-30')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.equal(provider.verifiedIndiaJobCount, 0)
  assert.match(provider.modulePath, new RegExp(`[\\\\/]${provider.source}[\\\\/]script\\.js$`, 'i'))

  assert.equal(scraper.provider.modulePath, provider.modulePath)
  assert.deepEqual(await scraper.run(), [])
})
