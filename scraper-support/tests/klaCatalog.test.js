import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { buildWorkdayAppliedFacets } from '../myworkday/engine.js'
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import { loadConfig } from '../utils/loadConfig.js'

const testsDir = path.dirname(fileURLToPath(import.meta.url))
const INDIA_FACET_ID = 'c4f78be1a8f14da0ab49ce1162348a5e'

test('registers KLA against the official careers page and Workday board', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'kla')

  assert.ok(provider)
  assert.equal(provider.companyName, 'KLA')
  assert.equal(provider.adapter, 'workday')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyCareerPage, 'https://www.kla.com/careers')
  assert.equal(provider.companyDomain, 'kla.com')
  assert.equal(provider.locationCountry, INDIA_FACET_ID)
  assert.equal(provider.baseUrl, 'https://kla.wd1.myworkdayjobs.com/Search')
})

test('buildScrapers exposes a runnable KLA Workday scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'kla')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /kla.workday[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'kla')
  assert.equal(scraper.provider.atsPlatform, 'workday')
})

test('KLA local Workday config switches the scraper onto the jobs API with the tenant-specific Country facet', () => {
  const config = loadConfig(path.join(testsDir, '../../scraper/kla.workday'))

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://kla.wd1.myworkdayjobs.com/wday/cxs/kla/Search/jobs',
  )
  assert.equal(
    config.detailUrlBase,
    'https://kla.wd1.myworkdayjobs.com/Search',
  )
  assert.equal(config.countryFacetParameter, 'Country')

  assert.deepEqual(
    buildWorkdayAppliedFacets(
      'https://kla.wd1.myworkdayjobs.com/Search',
      INDIA_FACET_ID,
      config.countryFacetParameter,
    ),
    {
      Country: [INDIA_FACET_ID],
    },
  )
})

test('generateCompanyCoverageReport resolves the CSV row KLA to the KLA Workday provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'KLA,\n',
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
    [['KLA', 'kla', 'KLA']],
  )
})
