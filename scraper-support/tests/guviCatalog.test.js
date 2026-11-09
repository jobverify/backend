import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('GUVI is registered as a verified first-party jobs-shell sentinel without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'guvi')

  assert.ok(provider, 'Expected GUVI provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'GUVI (An HCL Group Company)')
  assert.equal(provider.companyCareerPage, 'https://www.guvi.in/jobs/')
  assert.equal(provider.atsPlatform, 'official-company-jobs-page')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-jobs-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-plus-verified-first-party-zero-openings-jobs-shell-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'guvi.in')
  assert.match(provider.modulePath, /guvi[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'GUVI (An HCL Group Company)'), false)
})

test('GUVI matches backlog coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: '"GUVI (An HCL Group Company)"\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['GUVI (An HCL Group Company)', 'guvi', 'GUVI (An HCL Group Company)']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'guvi')

  assert.ok(scraper, 'Expected buildScrapers() to return the GUVI scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'guvi')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.guvi.in/jobs/')
  assert.match(scraper.dryRunFile, /guvi[\\/]jobs\.json$/i)
})
