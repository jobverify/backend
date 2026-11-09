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

test('getScraperCatalog includes Microchip Technology on the official careers page backed by Workday', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'microchip')

  assert.ok(provider)
  assert.equal(provider.adapter, 'workday')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyName, 'Microchip Technology')
  assert.equal(provider.companyCareerPage, 'https://www.microchip.com/en-us/about/careers')
  assert.equal(provider.companyDomain, 'microchip.com')
  assert.equal(
    provider.baseUrl,
    'https://wd5.myworkdaysite.com/en-US/recruiting/microchiphr/External',
  )
})

test('buildScrapers exposes a runnable Microchip Technology Workday scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'microchip')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /microchip.workday[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'microchip')
  assert.equal(scraper.provider.atsPlatform, 'workday')
})

test('Microchip Workday local config switches the scraper onto the jobs API with the lowercase India country facet', () => {
  const config = loadConfig(path.join(testsDir, '../../scraper/microchip.workday'))

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://wd5.myworkdaysite.com/wday/cxs/microchiphr/External/jobs',
  )
  assert.equal(
    config.detailUrlBase,
    'https://wd5.myworkdaysite.com/recruiting/microchiphr/External',
  )
  assert.equal(config.countryFacetParameter, 'locationCountry')
})

test('generateCompanyCoverageReport resolves Microchip Technology to the Microchip provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Microchip Technology,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Microchip Technology', 'microchip', 'Microchip Technology']],
  )
})
