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

test('getScraperCatalog includes IMEG on the official careers page backed by a first-party Workday handoff', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'imeg')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyName, 'IMEG')
  assert.equal(provider.companyCareerPage, 'https://imegcorp.com/careers/')
  assert.equal(provider.companyDomain, 'imegcorp.com')
})

test('buildScrapers exposes a runnable IMEG scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'imeg')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /imeg.workday[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'imeg')
  assert.equal(scraper.provider.atsPlatform, 'workday')
})

test('IMEG local Workday config switches the shared runner onto the public jobs API with the lowercase India country facet', () => {
  const config = loadConfig(path.join(testsDir, '../../scraper/imeg.workday'))

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://wd1.myworkdaysite.com/wday/cxs/imeg/Imeg_Careers/jobs',
  )
  assert.equal(
    config.detailUrlBase,
    'https://wd1.myworkdaysite.com/en-US/recruiting/imeg/Imeg_Careers',
  )
  assert.equal(config.countryFacetParameter, 'locationCountry')
})

test('generateCompanyCoverageReport resolves the CSV row IMEG to the IMEG provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'IMEG,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['IMEG', 'imeg', 'IMEG']],
  )
})
