import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('DoctorC is wired to the verified first-party empty-state scraper instead of the generic sentinel', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'doctorc')
  const scraper = buildScrapers().find((item) => item.name === 'doctorc')

  assert.ok(provider)
  assert.ok(scraper)

  assert.equal(provider.companyName, 'DoctorC')
  assert.equal(provider.companyCareerPage, 'https://doctorc.in/jobs/')
  assert.equal(provider.companyDomain, 'doctorc.in')
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
