import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes BootLabs Technologies Pvt Ltd as a LinkedIn-routed script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'bootlabstechnologies')

  assert.ok(provider)
  assert.equal(provider.companyName, 'BootLabs Technologies Pvt Ltd')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'linkedin-public-employer-announcements')
  assert.equal(provider.companyCareerPage, 'https://www.bootlabstech.com/careers')
  assert.equal(provider.companyDomain, 'bootlabstech.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /bootlabstechnologies[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve BootLabs Technologies Pvt Ltd to the bootlabstechnologies source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'bootlabstechnologies')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /bootlabstechnologies[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'bootlabstechnologies')

  const report = generateCompanyCoverageReport({
    csvText: 'BootLabs Technologies Pvt Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['BootLabs Technologies Pvt Ltd', 'bootlabstechnologies', 'BootLabs Technologies Pvt Ltd']],
  )
})
