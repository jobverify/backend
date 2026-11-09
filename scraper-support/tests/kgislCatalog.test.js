import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('KGISL is registered as a verified first-party candidate portal scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'kgisl')

  assert.ok(provider, 'Expected KGISL provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'KGISL')
  assert.equal(provider.companyCareerPage, 'https://www.kgisl.com/current-openings/')
  assert.equal(provider.atsPlatform, 'official-first-party-candidate-portal')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'official-wrapper-handoff-plus-current-client-full-array-and-all-india-details',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careerx-client+public-vacancies-array+matched-india-details+legacy-inline-portal',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'kgisl.com')
  assert.equal(provider.verifiedOn, '2026-10-09')
  assert.equal(provider.verifiedPublicJobCount, 20)
  assert.equal(
    provider.verifiedSampleJobTitle,
    'Senior Business Analyst - Project Lead',
  )
  assert.equal(provider.verifiedSampleJobUrl, 'https://careerx.kgisl.com/#/careers/apply/V101094')
  assert.equal(provider.verifiedGlobalInventoryCount, 23)
  assert.match(provider.verifiedSurfaceSummary, /October 9, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /20 explicitly in India and 3 in Malaysia/i)
  assert.match(provider.modulePath, /kgisl[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'KGISL'), false)
})

test('KGISL matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'KGISL,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['KGISL', 'kgisl', 'KGISL']],
  )
})

test('KGISL is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'kgisl')

  assert.ok(scraper, 'Expected buildScrapers() to return the KGISL scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'kgisl')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.kgisl.com/current-openings/')
  assert.match(scraper.dryRunFile, /kgisl[\\/]jobs\.json$/i)
})
