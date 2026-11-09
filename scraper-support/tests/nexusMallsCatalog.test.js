import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Nexus Malls as a verified zero-jobs script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'nexusmalls')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Nexus Malls')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-site')
  assert.equal(provider.companyCareerPage, 'https://www.nexusselecttrust.com/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-missing-careers-routes')
  assert.equal(provider.extractionStrategy, 'official-site+404-careers-check')
  assert.equal(provider.companyDomain, 'nexusselecttrust.com')
  assert.match(provider.modulePath, /nexusmalls[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Nexus Malls scraper and exact-name coverage works without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'nexusmalls')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'nexusmalls')
  assert.match(scraper.dryRunFile, /nexusmalls[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,Nexus Malls\n',
    catalog: getScraperCatalog(),
  })

  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.source ?? null]),
    [['Nexus Malls', 'nexusmalls', 'nexusmalls']],
  )
  assert.equal(report.unmatchedCount, 0)
})
