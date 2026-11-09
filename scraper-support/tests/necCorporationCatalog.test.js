import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('NEC Corporation is registered as a verified first-party zero-job scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'neccorporation')

  assert.ok(provider, 'Expected NEC Corporation provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'NEC Corporation')
  assert.equal(provider.companyCareerPage, 'https://www.nec.com/en/global/rd/rd-recruit/index.html')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'Japan')
  assert.equal(provider.paginationStrategy, 'homepage-plus-english-sitemap-plus-rd-recruit-page-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-global-homepage+verified-english-sitemap-single-recruit-surface+verified-rd-recruit-page-without-public-job-listings-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'nec.com')
  assert.equal(provider.verifiedOn, '2026-08-03')
  assert.match(
    provider.verifiedSurfaceSummary,
    /single r&d recruit surface at .*rd-recruit\/index\.html.*without public job listings/i,
  )
  assert.match(provider.modulePath, /neccorporation[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'NEC Corporation'), false)
})

test('NEC Corporation matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'NEC Corporation,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['NEC Corporation', 'neccorporation', 'NEC Corporation']],
  )
})

test('NEC Corporation is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'neccorporation')

  assert.ok(scraper, 'Expected buildScrapers() to return the NEC Corporation scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'neccorporation')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.nec.com/en/global/rd/rd-recruit/index.html')
  assert.match(scraper.dryRunFile, /neccorporation[\\/]jobs\.json$/i)
})
