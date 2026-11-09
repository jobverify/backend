import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes ZF Group on the official careers page backed by the public jobs.zf.com portal', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'zf')

  assert.ok(provider)
  assert.equal(provider.companyName, 'ZF Group')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'successfactors')
  assert.equal(provider.companyCareerPage, 'https://www.zf.com/mobile/en/careers/careers.html')
  assert.equal(provider.baseUrl, 'https://jobs.zf.com')
  assert.equal(provider.companyDomain, 'zf.com')
  assert.match(provider.modulePath, /zf[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve both ZF and ZF Group to the zf source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'zf')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /zf[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'zf')

  const report = generateCompanyCoverageReport({
    csvText: 'ZF,\nZF Group,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['ZF', 'zf', 'ZF Group'],
      ['ZF Group', 'zf', 'ZF Group'],
    ],
  )
})
