import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('V-Guard Wires & Cables Division is registered against its verified first-party ATS handoff without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'vguardwiresandcablesdivision')

  assert.ok(provider, 'Expected V-Guard Wires & Cables Division provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'V-Guard Wires & Cables Division')
  assert.equal(provider.companyCareerPage, 'https://www.vguard.in/careers/apply-now')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-apply-now-handoff-plus-official-ats-list-and-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-apply-now-handoff+official-ats-listings+official-ats-detail-pages',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'vguard.in')
  assert.match(provider.modulePath, /vguardwiresandcablesdivision[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'V-Guard Wires & Cables Division'), false)
})

test('V-Guard Wires & Cables Division resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'V-Guard Wires & Cables Division,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['V-Guard Wires & Cables Division', 'vguardwiresandcablesdivision', 'V-Guard Wires & Cables Division']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'vguardwiresandcablesdivision')

  assert.ok(scraper, 'Expected buildScrapers() to return the V-Guard Wires & Cables Division scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'vguardwiresandcablesdivision')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.vguard.in/careers/apply-now')
  assert.match(scraper.dryRunFile, /vguardwiresandcablesdivision[\\/]jobs\.json$/i)
})
