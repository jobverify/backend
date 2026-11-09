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

test('getScraperCatalog includes Valeo on the official Workday jobs board', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'valeo')

  assert.ok(provider)
  assert.equal(provider.adapter, 'workday')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyName, 'Valeo')
  assert.equal(provider.companyCareerPage, 'https://www.valeo.com/en/careers/')
  assert.equal(provider.companyDomain, 'valeo.com')
  assert.equal(provider.locationCountry, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.match(provider.baseUrl, /valeo\.wd3\.myworkdayjobs\.com\/en-US\/valeo_jobs/i)
})

test('buildScrapers and company coverage resolve Valeo to a runnable Workday source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'valeo')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /valeo.workday[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'valeo')

  const report = generateCompanyCoverageReport({
    csvText: 'Valeo,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Valeo', 'valeo', 'Valeo']],
  )
})

test('Valeo Workday local config switches the scraper onto the jobs API with the India country facet', () => {
  const config = loadConfig(path.join(testsDir, '../../scraper/valeo.workday'))

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://valeo.wd3.myworkdayjobs.com/wday/cxs/valeo/valeo_jobs/jobs',
  )
  assert.equal(
    config.detailUrlBase,
    'https://valeo.wd3.myworkdayjobs.com/en-US/valeo_jobs',
  )
  assert.equal(config.countryFacetParameter, 'locationCountry')
})
