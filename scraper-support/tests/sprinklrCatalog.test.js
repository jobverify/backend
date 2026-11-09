import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import { loadConfig } from '../utils/loadConfig.js'

const testsDir = path.dirname(fileURLToPath(import.meta.url))

test('getScraperCatalog includes Sprinklr on the official first-party careers page with a Workday handoff', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'sprinklr')

  assert.ok(provider)
  assert.equal(provider.adapter, 'workday')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyName, 'Sprinklr')
  assert.equal(provider.companyCareerPage, 'https://www.sprinklr.com/careers/')
  assert.equal(provider.companyDomain, 'sprinklr.com')
  assert.equal(provider.locationCountry, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.equal(provider.baseUrl, 'https://sprinklr.wd1.myworkdayjobs.com/careers')
})

test('buildScrapers exposes a runnable Sprinklr Workday scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'sprinklr')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /sprinklr.workday[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'sprinklr')
  assert.equal(scraper.provider.atsPlatform, 'workday')
})

test('Sprinklr Workday local config switches the scraper onto the verified jobs API with the lowercase India country facet', () => {
  const config = loadConfig(path.join(testsDir, '../../scraper/sprinklr.workday'))

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://sprinklr.wd1.myworkdayjobs.com/wday/cxs/sprinklr/careers/jobs',
  )
  assert.equal(
    config.detailUrlBase,
    'https://sprinklr.wd1.myworkdayjobs.com/careers',
  )
  assert.equal(config.countryFacetParameter, 'locationCountry')
})

test('generateCompanyCoverageReport resolves Sprinklr and Sprinklr India to the shared Sprinklr provider', () => {
  assert.equal(companyAliases['Sprinklr India'], 'sprinklr')

  const report = generateCompanyCoverageReport({
    csvText: 'Sprinklr,\nSprinklr India,\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
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
      ['Sprinklr', 'sprinklr', 'Sprinklr'],
      ['Sprinklr India', 'sprinklr', 'Sprinklr'],
    ],
  )
})
