import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'
import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }

test('Noduco is registered against the verified first-party careers surface', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'noduco')

  assert.ok(provider, 'Expected Noduco provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Noduco')
  assert.equal(provider.companyCareerPage, 'https://noduco.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page+same-domain-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-page+inline-job-cards+same-domain-detail-pages+cloudflare-email-apply',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'noduco.com')
  assert.match(provider.modulePath, /noduco[\\/]script\.js$/i)
  assert.equal(
    companyAliases['Noduco (A Software Solutions Enterprise)'],
    'noduco',
  )
})

test('Noduco matches the backlog row through the explicit alias', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Noduco (A Software Solutions Enterprise),\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Noduco (A Software Solutions Enterprise)', 'noduco', 'Noduco']],
  )
})

test('Noduco is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'noduco')

  assert.ok(scraper, 'Expected buildScrapers() to return the Noduco scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'noduco')
  assert.equal(scraper.provider.companyCareerPage, 'https://noduco.com/careers/')
  assert.match(scraper.dryRunFile, /noduco[\\/]jobs\.json$/i)
})
