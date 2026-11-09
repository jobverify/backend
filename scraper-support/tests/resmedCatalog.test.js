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

test('getScraperCatalog includes ResMed Technology Pvt Ltd on the official Workday careers source', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'resmed')

  assert.ok(provider)
  assert.equal(provider.adapter, 'workday')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyName, 'ResMed Technology Pvt Ltd')
  assert.equal(provider.companyCareerPage, 'https://careers.resmed.com/')
  assert.equal(provider.companyDomain, 'careers.resmed.com')
  assert.equal(provider.locationCountry, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.equal(
    provider.baseUrl,
    'https://resmed.wd3.myworkdayjobs.com/en-US/Resmed_External_Careers',
  )
})

test('buildScrapers exposes a runnable ResMed Workday scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'resmed')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /resmed.workday[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'resmed')
  assert.equal(scraper.provider.atsPlatform, 'workday')
})

test('ResMed Workday local config switches the scraper onto the jobs API with the India country facet', () => {
  const config = loadConfig(path.join(testsDir, '../../scraper/resmed.workday'))

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://resmed.wd3.myworkdayjobs.com/wday/cxs/resmed/Resmed_External_Careers/jobs',
  )
  assert.equal(
    config.detailUrlBase,
    'https://resmed.wd3.myworkdayjobs.com/en-US/Resmed_External_Careers',
  )
  assert.equal(config.countryFacetParameter, 'locationCountry')
})

test('generateCompanyCoverageReport resolves ResMed Technology Pvt Ltd to the ResMed provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'ResMed Technology Pvt Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [
      item.companyName,
      item.source,
      item.provider?.companyName ?? null,
    ]),
    [['ResMed Technology Pvt Ltd', 'resmed', 'ResMed Technology Pvt Ltd']],
  )
})
