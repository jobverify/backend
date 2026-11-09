import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Renault Group is registered as a verified Workday-backed provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'renaultgroup')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Renault Group')
  assert.equal(provider.companyCareerPage, 'https://www.renaultgroup.com/en/careers/')
  assert.equal(
    provider.officialWorkdayBoardUrl,
    'https://alliancewd.wd3.myworkdayjobs.com/renault-group-careers',
  )
  assert.equal(
    provider.jobsApiUrl,
    'https://alliancewd.wd3.myworkdayjobs.com/wday/cxs/alliancewd/renault-group-careers/jobs',
  )
  assert.equal(provider.atsPlatform, 'workday-jobs-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-careers-overview-plus-workday-jobs-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-overview+verified-current-workday-board+workday-jobs-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.companyDomain, 'renaultgroup.com')
  assert.match(provider.modulePath, /renaultgroup[\\/]script\.js$/i)
})

test('Renault Group resolves through company coverage to the exact-name sentinel provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Renault Group,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Renault Group', 'renaultgroup', 'Renault Group']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'renaultgroup')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'renaultgroup')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.renaultgroup.com/en/careers/')
  assert.match(scraper.dryRunFile, /renaultgroup[\\/]jobs\.json$/i)
})
