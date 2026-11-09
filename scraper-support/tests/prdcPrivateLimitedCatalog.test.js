import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('PRDC Private Limited is registered against the verified PRDC vacancy surface with an exact backlog alias', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'prdcprivatelimited')

  assert.ok(provider, 'Expected PRDC Private Limited provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Power Research and Development Consultants Private Limited')
  assert.equal(provider.companyCareerPage, 'https://beta.prdcinfotech.com/career/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'careers-page-plus-vacancy-hub-plus-all-categories-table')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+verified-vacancy-hub+static-public-jobs-table',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'beta.prdcinfotech.com')
  assert.match(provider.modulePath, /prdcprivatelimited[\\/]script\.js$/i)
  assert.equal(companyAliases['PRDC Private Limited'], 'prdcprivatelimited')
})

test('PRDC Private Limited backlog row resolves through the alias map and buildScrapers exposes the lane', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'PRDC Private Limited,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[
      'PRDC Private Limited',
      'prdcprivatelimited',
      'Power Research and Development Consultants Private Limited',
    ]],
  )

  const scraper = buildScrapers().find((item) => item.name === 'prdcprivatelimited')

  assert.ok(scraper, 'Expected buildScrapers() to return the PRDC Private Limited scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'prdcprivatelimited')
  assert.equal(scraper.provider.companyCareerPage, 'https://beta.prdcinfotech.com/career/')
  assert.match(scraper.dryRunFile, /prdcprivatelimited[\\/]jobs\.json$/i)
})
