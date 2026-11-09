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

test('getScraperCatalog includes Workday on the official Workday jobs board', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'workday')

  assert.ok(provider)
  assert.equal(provider.adapter, 'workday')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyName, 'Workday')
  assert.equal(provider.companyCareerPage, 'https://workday.wd5.myworkdayjobs.com/Workday')
  assert.equal(provider.companyDomain, 'workday.wd5.myworkdayjobs.com')
  assert.match(provider.baseUrl, /workday\.wd5\.myworkdayjobs\.com\/Workday/i)
})

test('buildScrapers and company coverage resolve Workday to a runnable Workday source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'workday')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /workday.workday[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'workday')

  const report = generateCompanyCoverageReport({
    csvText: 'Workday,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Workday', 'workday', 'Workday']],
  )
})

test('Workday local config switches the scraper onto the jobs API with the India country facet', () => {
  const config = loadConfig(path.join(testsDir, '../../scraper/workday.workday'))

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://workday.wd5.myworkdayjobs.com/wday/cxs/workday/Workday/jobs',
  )
  assert.equal(
    config.detailUrlBase,
    'https://workday.wd5.myworkdayjobs.com/Workday',
  )
  assert.equal(config.countryFacetParameter, undefined)
})
