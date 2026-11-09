import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes BTL India as an official first-party careers scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'btlindia')

  assert.ok(provider)
  assert.equal(provider.companyName, 'BTL India Pvt. Ltd.')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.btlnet.co.in/careers.php')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyDomain, 'btlnet.co.in')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /btlindia[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve BTL India Pvt. Ltd. to the btlindia source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'btlindia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /btlindia[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'btlindia')

  const report = generateCompanyCoverageReport({
    csvText: 'BTL India Pvt. Ltd.,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['BTL India Pvt. Ltd.', 'btlindia', 'BTL India Pvt. Ltd.']],
  )
})
