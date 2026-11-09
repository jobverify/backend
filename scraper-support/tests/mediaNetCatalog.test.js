import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Media.net as an official first-party careers scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'medianet')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Media.net')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://careers.media.net/')
  assert.equal(provider.countryFilter, 'Global')
  assert.equal(provider.companyDomain, 'careers.media.net')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /medianet[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Media.net to the medianet source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'medianet')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /medianet[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'medianet')

  const report = generateCompanyCoverageReport({
    csvText: 'Media.net,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Media.net', 'medianet', 'Media.net']],
  )
})
