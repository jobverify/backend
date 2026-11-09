import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes FELDER Group as a custom careers portal scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'feldergroup')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'pimcore')
  assert.equal(provider.companyName, 'FELDER Group')
  assert.equal(provider.companyCareerPage, 'https://felder-group.jobs/en')
  assert.equal(provider.companyDomain, 'felder-group.jobs')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /feldergroup[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable FELDER Group scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'feldergroup')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.adapter, 'script')
  assert.equal(scraper.provider.parser, 'custom-script')
  assert.match(scraper.dryRunFile, /feldergroup[\\/]jobs\.json$/)
})

test('generateCompanyCoverageReport resolves FELDER Group to the FELDER Group provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'FELDER Group,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['FELDER Group', 'feldergroup', 'FELDER Group']],
  )
})
