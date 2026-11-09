import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import { loadConfig } from '../utils/loadConfig.js'

const testsDir = path.dirname(fileURLToPath(import.meta.url))

test('getScraperCatalog includes Pfizer on the exact-name first-party careers page backed by Workday', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'pfizer')

  assert.ok(provider)
  assert.equal(provider.adapter, 'workday')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyName, 'Pfizer')
  assert.equal(provider.companyCareerPage, 'https://www.pfizer.com/about/careers/search-results')
  assert.equal(provider.companyDomain, 'pfizer.com')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.match(provider.baseUrl, /pfizer\.wd1\.myworkdayjobs\.com\/en-US\/PfizerCareers/i)
  assert.match(provider.verifiedSurfaceSummary, /Manager, Market Access in India - Mumbai/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior HCE in India - Chennai/i)
})

test('buildScrapers and company coverage resolve Pfizer to a runnable exact-name Workday source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'pfizer')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /pfizer.workday[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'pfizer')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.pfizer.com/about/careers/search-results')

  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nPfizer\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Pfizer', 'pfizer', 'Pfizer']],
  )
})

test('Pfizer local config pins the scraper to the verified Workday jobs API contract', () => {
  const config = loadConfig(path.join(testsDir, '../../scraper/pfizer.workday'))

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://pfizer.wd1.myworkdayjobs.com/wday/cxs/pfizer/PfizerCareers/jobs',
  )
  assert.equal(
    config.detailUrlBase,
    'https://pfizer.wd1.myworkdayjobs.com/en-US/PfizerCareers',
  )
  assert.equal(config.countryFacetParameter, 'Location_Country')
})
