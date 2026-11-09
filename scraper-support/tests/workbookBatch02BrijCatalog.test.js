import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Brij is wired to a verified first-party careers handoff scraper instead of the generic sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'brij')
  const scraper = buildScrapers().find((item) => item.name === 'brij')

  assert.ok(provider)
  assert.ok(scraper)

  assert.equal(provider.companyName, 'Brij')
  assert.equal(provider.companyCareerPage, 'https://brij.ai/careers')
  assert.equal(provider.companyDomain, 'brij.ai')
  assert.equal(provider.officialJobsBoardUrl, 'https://brij.applytojob.com/apply')
  assert.equal(provider.atsPlatform, 'official-careers-page-plus-applytojob-board')
  assert.equal(
    provider.paginationStrategy,
    'validate-official-careers-page-then-read-linked-public-applytojob-board',
  )
  assert.equal(
    provider.extractionStrategy,
    'official-careers-page-handoff-verification+public-jazzhr-board+detail-enrichment+india-filter',
  )
  assert.equal(provider.verifiedOn, '2026-07-30')
  assert.equal(provider.verifiedPublicJobCount, 1)
  assert.equal(provider.verifiedIndiaJobCount, 0)
  assert.match(provider.modulePath, /[\\/]brij[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, July 30, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/brij\.ai\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/brij\.applytojob\.com\/apply/i)
  assert.match(provider.verifiedSurfaceSummary, /Director of Partnerships/i)
  assert.match(provider.verifiedSurfaceSummary, /New York City, NY/i)

  assert.equal(scraper.provider.modulePath, provider.modulePath)
})
