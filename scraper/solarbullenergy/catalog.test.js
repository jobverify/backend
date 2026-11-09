import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Solar Bull Energy is registered as an official-site empty-sentinel provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'solarbullenergy')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Solar Bull Energy')
  assert.equal(provider.companyCareerPage, 'https://www.solarbull.in/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyDomain, 'solarbull.in')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /solarbullenergy[\\/]script\.js$/i)
})

test('Solar Bull Energy matches the extracted CSV company row directly', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Solar Bull Energy,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Solar Bull Energy', 'solarbullenergy', 'Solar Bull Energy']],
  )
})

test('Solar Bull Energy remains runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'solarbullenergy')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /solarbullenergy[\\/]jobs\.json$/i)
})
