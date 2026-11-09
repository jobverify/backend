import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { loadConfig } from '../utils/loadConfig.js'

const testsDir = path.dirname(fileURLToPath(import.meta.url))

test('getScraperCatalog includes KION Group on the official first-party careers page backed by Workday', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'kiongroup')

  assert.ok(provider)
  assert.equal(provider.adapter, 'workday')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyName, 'KION Group')
  assert.equal(provider.companyCareerPage, 'https://www.kiongroup.com/en/Careers/Career-Home/')
  assert.equal(provider.companyDomain, 'kiongroup.com')
  assert.match(provider.baseUrl, /kiongroup\.wd3\.myworkdayjobs\.com\/en-US\/KIONGroup/i)

  const config = loadConfig(path.join(testsDir, '../../scraper/kiongroup.workday'))
  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://kiongroup.wd3.myworkdayjobs.com/wday/cxs/kiongroup/KIONGroup/jobs',
  )
  assert.equal(config.detailUrlBase, 'https://kiongroup.wd3.myworkdayjobs.com/en-US/KIONGroup')
  assert.equal(config.countryFacetParameter, 'locationCountry')
})

test('buildScrapers exposes a runnable KION Group Workday scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'kiongroup')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /kiongroup.workday[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'kiongroup')
  assert.equal(scraper.provider.atsPlatform, 'workday')
})

test('company coverage resolves KION Group from the CSV against the official Workday-backed scraper', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,KION Group\n',
    catalog: getScraperCatalog(),
  })

  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source]),
    [['KION Group', 'kiongroup']],
  )
  assert.equal(report.unmatchedCount, 0)
})
