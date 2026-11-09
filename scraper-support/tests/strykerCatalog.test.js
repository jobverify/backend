import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import { loadConfig } from '../utils/loadConfig.js'

const testsDir = path.dirname(fileURLToPath(import.meta.url))

test('getScraperCatalog includes Stryker on its first-party Workday jobs source', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'stryker')

  assert.ok(provider)
  assert.equal(provider.adapter, 'workday')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyName, 'Stryker')
  assert.equal(provider.companyCareerPage, 'https://careers.stryker.com/jobs')
  assert.equal(provider.companyDomain, 'careers.stryker.com')
  assert.equal(provider.locationCountry, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.equal(provider.baseUrl, 'https://stryker.wd1.myworkdayjobs.com/StrykerCareers')
})

test('buildScrapers exposes a runnable Stryker Workday scraper', () => {
  const scraper = buildScrapers().find((item) => item.name === 'stryker')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /stryker.workday[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'stryker')
  assert.equal(scraper.provider.atsPlatform, 'workday')
})

test('Stryker Workday config uses the verified jobs API and India country facet', () => {
  const config = loadConfig(path.join(testsDir, '../../scraper/stryker.workday'))

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://stryker.wd1.myworkdayjobs.com/wday/cxs/stryker/StrykerCareers/jobs',
  )
  assert.equal(config.detailUrlBase, 'https://stryker.wd1.myworkdayjobs.com/StrykerCareers')
  assert.equal(config.countryFacetParameter, 'Location_Country')
})

test("company coverage resolves the exact CSV name 'Stryker'", () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Stryker,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0].source, 'stryker')
  assert.equal(report.matched[0].provider?.companyName, 'Stryker')
})
