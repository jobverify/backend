import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes NeST Digital as a careers-plus-Zappyhire script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'nestdigital')

  assert.ok(provider)
  assert.equal(provider.companyName, 'NeST Digital')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'zappyhire')
  assert.equal(provider.companyCareerPage, 'https://nestdigital.com/career/')
  assert.equal(provider.companyDomain, 'nestdigital.com')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-careers-page-plus-zappyhire-api-pagination')
  assert.equal(provider.extractionStrategy, 'official-careers-page+zappyhire-config+zappyhire-filter-params+zappyhire-jobsearch+zappyhire-job-detail')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /nestdigital[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve the exact NeST Digital CSV backlog entry without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'nestdigital')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /nestdigital[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'nestdigital')

  const report = generateCompanyCoverageReport({
    csvText: 'NeST Digital,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['NeST Digital', 'nestdigital', 'NeST Digital']],
  )
})
