import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('YANMAR is registered as a verified first-party non-listing careers sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'yanmar')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'YANMAR')
  assert.equal(provider.companyCareerPage, 'https://www.yanmar.com/global/career/jobs/')
  assert.equal(provider.atsPlatform, 'official-company-careers-nonlisting')
  assert.equal(provider.countryFilter, 'Global')
  assert.equal(provider.paginationStrategy, 'homepage-plus-about-career-jobs-and-contact-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-about-page+verified-career-page+verified-jobs-page+verified-contact-page+no-public-job-records-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.companyDomain, 'yanmar.com')
  assert.match(provider.modulePath, /yanmar[\\/]script\.js$/i)
})

test('YANMAR resolves through company coverage to the exact-name sentinel provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'YANMAR,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['YANMAR', 'yanmar', 'YANMAR']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'yanmar')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'yanmar')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.yanmar.com/global/career/jobs/')
  assert.match(scraper.dryRunFile, /yanmar[\\/]jobs\.json$/i)
})
