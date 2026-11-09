import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('getScraperCatalog includes Hitachi India as a custom script provider with validated metadata and narrow aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'hitachiindia')

  assert.ok(provider)
  assert.equal(provider.companyName, 'HITACHI INDIA PVT. LTD')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'paradox-careersites+workday-handoff')
  assert.equal(
    provider.companyCareerPage,
    'https://careers.hitachi.com/jobs?filter%5Bbrand%5D%5B0%5D=Hitachi+India+Pvt.+Ltd&filter%5Bcountry%5D%5B0%5D=India',
  )
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'paradox-filtered-jobs-pages-with-legacy-search-fallback',
  )
  assert.equal(
    provider.extractionStrategy,
    'first-party-preload-jobs+exact-legal-entity-and-india-filter+workday-apply',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'careers.hitachi.com')
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.match(provider.verifiedSurfaceSummary, /four India-located roles/i)
  assert.match(provider.modulePath, /hitachiindia[\\/]script\.js$/)
  assert.equal(companyAliases.Hitachi, 'hitachiindia')
  assert.equal(companyAliases['HITACHI INDIA PVT. LTD'], 'hitachiindia')
  assert.equal(companyAliases['Hitachi India Pvt Ltd'], 'hitachiindia')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Hitachi Energy'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'GlobalLogic'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Hitachi Rail'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Hitachi Vantara'), false)
})

test('buildScrapers exposes a runnable Hitachi India scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'hitachiindia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /hitachiindia[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'hitachiindia')
  assert.equal(scraper.provider.atsPlatform, 'paradox-careersites+workday-handoff')
  assert.equal(
    scraper.provider.extractionStrategy,
    'first-party-preload-jobs+exact-legal-entity-and-india-filter+workday-apply',
  )
})
