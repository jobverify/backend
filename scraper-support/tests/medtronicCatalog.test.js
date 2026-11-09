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

test('getScraperCatalog includes Medtronic on the official Workday careers source', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'medtronic')

  assert.ok(provider)
  assert.equal(provider.adapter, 'workday')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyName, 'Medtronic')
  assert.equal(provider.companyCareerPage, 'https://www.medtronic.com/en-us/our-company/careers.html')
  assert.equal(provider.companyDomain, 'medtronic.com')
  assert.equal(provider.locationCountry, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.equal(provider.baseUrl, 'https://medtronic.wd1.myworkdayjobs.com/MedtronicCareers')
})

test('buildScrapers exposes a runnable Medtronic Workday scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'medtronic')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /medtronic.workday[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'medtronic')
  assert.equal(scraper.provider.atsPlatform, 'workday')
})

test('Medtronic Workday local config switches the scraper onto the jobs API with the lowercase India country facet', () => {
  const config = loadConfig(path.join(testsDir, '../../scraper/medtronic.workday'))

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://medtronic.wd1.myworkdayjobs.com/wday/cxs/medtronic/MedtronicCareers/jobs',
  )
  assert.equal(
    config.detailUrlBase,
    'https://medtronic.wd1.myworkdayjobs.com/MedtronicCareers',
  )
  assert.equal(config.countryFacetParameter, 'locationCountry')
})

test('generateCompanyCoverageReport resolves Medtronic backlog name variants to the Medtronic provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Medtronic,\nMedtronic Engineering & Innovation Centre,\nMedtronic Engineering & Innovation Center,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 3)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Medtronic', 'medtronic', 'Medtronic'],
      ['Medtronic Engineering & Innovation Centre', 'medtronic', 'Medtronic'],
      ['Medtronic Engineering & Innovation Center', 'medtronic', 'Medtronic'],
    ],
  )
})
