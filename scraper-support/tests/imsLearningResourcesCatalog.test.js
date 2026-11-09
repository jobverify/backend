import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes IMS Learning Resources as an exact-name first-party zero-jobs script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'imslearningresources')

  assert.ok(provider)
  assert.equal(provider.companyName, 'IMS Learning Resources')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.imsindia.com/about-us/join-our-team/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyDomain, 'imsindia.com')
  assert.match(provider.modulePath, /imslearningresources[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve the IMS Learning Resources CSV row without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'imslearningresources')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /imslearningresources[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'imslearningresources')

  const report = generateCompanyCoverageReport({
    csvText: 'IMS Learning Resources,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['IMS Learning Resources', 'imslearningresources', 'IMS Learning Resources']],
  )
})
