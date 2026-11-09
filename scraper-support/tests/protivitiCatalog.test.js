import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { loadConfig } from '../utils/loadConfig.js'
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const testsDir = path.dirname(fileURLToPath(import.meta.url))
const INDIA_WORKDAY_COUNTRY_FACET = 'c4f78be1a8f14da0ab49ce1162348a5e'

test('registers Protiviti against the official careers page and verified public Workday source', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'protiviti')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Protiviti')
  assert.equal(provider.adapter, 'workday')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyCareerPage, 'https://www.protiviti.com/in-pcc/careers')
  assert.equal(provider.companyDomain, 'protiviti.com')
  assert.equal(provider.baseUrl, 'https://roberthalf.wd1.myworkdayjobs.com/en-US/ProtivitiIndia')
  assert.equal(provider.locationCountry, INDIA_WORKDAY_COUNTRY_FACET)

  const scraper = buildScrapers().find((candidate) => candidate.name === 'protiviti')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /protiviti.workday[\\/]jobs\.json$/)
})

test('uses the Protiviti India Workday board with the native India country facet', () => {
  const config = loadConfig(path.join(testsDir, '../../scraper/protiviti.workday'))

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://roberthalf.wd1.myworkdayjobs.com/wday/cxs/roberthalf/ProtivitiIndia/jobs',
  )
  assert.equal(
    config.detailUrlBase,
    'https://roberthalf.wd1.myworkdayjobs.com/en-US/ProtivitiIndia',
  )
  assert.equal(config.countryFacetParameter, 'Location_Country')
  assert.equal(config.locationCountry, INDIA_WORKDAY_COUNTRY_FACET)
})

test('company coverage resolves Protiviti Global Business Consulting to the Protiviti provider', () => {
  assert.equal(companyAliases['Protiviti Global Business Consulting'], 'protiviti')

  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,Protiviti Global Business Consulting\n',
    catalog: getScraperCatalog(),
  })

  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Protiviti Global Business Consulting', 'protiviti', 'Protiviti']],
  )
  assert.equal(report.unmatchedCount, 0)
})
