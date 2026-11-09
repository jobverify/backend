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

test('registers GE Appliances against the official careers page and Workday board', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'geappliances')

  assert.ok(provider)
  assert.equal(provider.companyName, 'GE Appliances')
  assert.equal(provider.adapter, 'workday')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyCareerPage, 'https://careers.geappliances.com/')
  assert.equal(provider.companyDomain, 'careers.geappliances.com')
  assert.equal(provider.locationCountry, INDIA_FACET_ID)
  assert.equal(provider.baseUrl, 'https://haier.wd3.myworkdayjobs.com/GE_Appliances')
})

test('buildScrapers exposes a runnable GE Appliances Workday scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'geappliances')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /geappliances.workday[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'geappliances')
  assert.equal(scraper.provider.atsPlatform, 'workday')
})

test('GE Appliances local Workday config switches the scraper onto the jobs API with the India country facet', () => {
  const config = loadConfig(path.join(testsDir, '../../scraper/geappliances.workday'))

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://haier.wd3.myworkdayjobs.com/wday/cxs/haier/GE_Appliances/jobs',
  )
  assert.equal(
    config.detailUrlBase,
    'https://haier.wd3.myworkdayjobs.com/en-US/GE_Appliances',
  )
  assert.equal(config.countryFacetParameter, 'locationCountry')

  assert.deepEqual(
    buildWorkdayAppliedFacets(
      'https://haier.wd3.myworkdayjobs.com/GE_Appliances',
      INDIA_FACET_ID,
      config.countryFacetParameter,
    ),
    {
      locationCountry: [INDIA_FACET_ID],
    },
  )
})

test('generateCompanyCoverageReport resolves the CSV row GE appliances to the GE Appliances Workday provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'GE appliances,\n',
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
    [['GE appliances', 'geappliances', 'GE Appliances']],
  )
})
