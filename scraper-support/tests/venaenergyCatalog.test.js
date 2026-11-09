import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../utils/loadConfig.js'
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const testsDir = path.dirname(fileURLToPath(import.meta.url))

test('registers Vena Energy against the official Vena Group careers page and public Workday source', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'venaenergy')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Vena Energy')
  assert.equal(provider.adapter, 'workday')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyCareerPage, 'https://venagroup.com/careers/')
  assert.equal(provider.companyDomain, 'venagroup.com')
  assert.equal(provider.countryFilter, 'Global')
  assert.equal(provider.baseUrl, 'https://venaenergy.wd102.myworkdayjobs.com/External')

  const scraper = buildScrapers().find((candidate) => candidate.name === 'venaenergy')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /venaenergy.workday[\\/]jobs\.json$/)
})

test('uses the Vena Energy public Workday jobs API without forcing an India-only facet while narrowing search and detail fetches to verified India roles', () => {
  const config = loadConfig(path.join(testsDir, '../../scraper/venaenergy.workday'))

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://venaenergy.wd102.myworkdayjobs.com/wday/cxs/venaenergy/External/jobs',
  )
  assert.equal(
    config.detailUrlBase,
    'https://venaenergy.wd102.myworkdayjobs.com/External',
  )
  assert.equal(config.locationCountry, '')
  assert.equal(config.searchText, 'India')
  assert.match(config.locationPattern, /india|karnataka|mumbai|pune|bangalore|bengaluru|hyderabad|gurgaon|gurugram/i)
})

test('company coverage resolves Vena Energy directly through the provider catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,Vena Energy\n',
    catalog: getScraperCatalog(),
  })

  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Vena Energy', 'venaenergy', 'Vena Energy']],
  )
  assert.equal(report.unmatchedCount, 0)
})
