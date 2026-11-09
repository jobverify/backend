import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Karomi Technology as an official homepage plus Zoho Recruit script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'karomitechnology')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'zohorecruit')
  assert.equal(provider.companyName, 'Karomi Technology')
  assert.equal(provider.companyCareerPage, 'https://www.karomi.com/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyDomain, 'karomi.com')
  assert.match(provider.modulePath, /karomitechnology[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Karomi Technology without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'karomitechnology')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'karomitechnology')
  assert.equal(scraper.provider.atsPlatform, 'zohorecruit')
  assert.match(scraper.dryRunFile, /karomitechnology[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Karomi Technology,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Karomi Technology', 'karomitechnology', 'Karomi Technology']],
  )
})
