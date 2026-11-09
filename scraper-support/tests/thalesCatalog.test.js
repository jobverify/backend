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

test('getScraperCatalog includes Thales on the official Workday careers source', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'thales')

  assert.ok(provider)
  assert.equal(provider.adapter, 'workday')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyName, 'Thales')
  assert.equal(provider.companyCareerPage, 'https://careers.thalesgroup.com/global/en/')
  assert.equal(provider.companyDomain, 'careers.thalesgroup.com')
  assert.equal(provider.locationCountry, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.equal(provider.baseUrl, 'https://thales.wd3.myworkdayjobs.com/Careers')
})

test('buildScrapers exposes a runnable Thales Workday scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'thales')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /thales.workday[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'thales')
  assert.equal(scraper.provider.atsPlatform, 'workday')
})

test('Thales Workday local config switches the scraper onto the jobs API with the India country facet', () => {
  const config = loadConfig(path.join(testsDir, '../../scraper/thales.workday'))

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://thales.wd3.myworkdayjobs.com/wday/cxs/thales/Careers/jobs',
  )
  assert.equal(
    config.detailUrlBase,
    'https://thales.wd3.myworkdayjobs.com/Careers',
  )
  assert.equal(config.countryFacetParameter, 'locationCountry')
})

test('generateCompanyCoverageReport resolves THALES and Thales Aerospace to the Thales provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'THALES,\nThales Aerospace,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [
      item.companyName,
      item.source,
      item.provider?.companyName ?? null,
    ]),
    [
      ['THALES', 'thales', 'Thales'],
      ['Thales Aerospace', 'thales', 'Thales'],
    ],
  )
})
