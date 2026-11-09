import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('STT Global Data Centres India Private Limited is registered as a verified first-party careers sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'sttglobaldatacentresindia')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'STT Global Data Centres India Private Limited')
  assert.equal(provider.companyCareerPage, 'https://www.sttelemediagdc.com/in-en/about-us/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers-nonlisting')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-about-careers-and-contact-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-india-homepage+verified-about-page+verified-careers-page+verified-contact-page+email-only-careers-handoff+no-public-job-records-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.companyDomain, 'sttelemediagdc.com')
  assert.match(provider.modulePath, /sttglobaldatacentresindia[\\/]script\.js$/i)
})

test('STT Global Data Centres India Private Limited matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'STT Global Data Centres India Private Limited,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['STT Global Data Centres India Private Limited', 'sttglobaldatacentresindia', 'STT Global Data Centres India Private Limited']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'sttglobaldatacentresindia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'sttglobaldatacentresindia')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.sttelemediagdc.com/in-en/about-us/careers')
  assert.match(scraper.dryRunFile, /sttglobaldatacentresindia[\\/]jobs\.json$/i)
})
