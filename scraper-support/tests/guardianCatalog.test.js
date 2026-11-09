import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import { loadConfig } from '../utils/loadConfig.js'

const testsDir = path.dirname(fileURLToPath(import.meta.url))

test('getScraperCatalog includes Guardian on the official careers pages backed by the public Workday board', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'guardian')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyName, 'Guardian')
  assert.equal(provider.companyCareerPage, 'https://www.guardianlife.com/careers/corporate')
  assert.equal(
    provider.officialIndiaCampusPageUrl,
    'https://www.guardianlife.com/about-guardian/where-we-work/india',
  )
  assert.equal(
    provider.officialWorkdayBoardUrl,
    'https://guardianlife.wd5.myworkdayjobs.com/Guardian-Life-Careers',
  )
  assert.equal(
    provider.jobsApiUrl,
    'https://guardianlife.wd5.myworkdayjobs.com/wday/cxs/guardianlife/Guardian-Life-Careers/jobs',
  )
  assert.equal(provider.companyDomain, 'guardianlife.com')
  assert.equal(provider.baseUrl, 'https://guardianlife.wd5.myworkdayjobs.com/Guardian-Life-Careers')
  assert.equal(provider.locationCountry, null)
  assert.equal(provider.verifiedOn, null)
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.historicalIndiaDiscovery.lastObservedStatus, 308)
  assert.equal(provider.publicInventoryVerification.wholeCompanyScope, null)
  assert.match(provider.modulePath, /guardian\.workday[\\/]script\.js$/)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Guardian'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Guardian India'), false)
})

test('buildScrapers and company coverage resolve both Guardian and Guardian India from the shared catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'guardian')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /guardian.workday[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'guardian')
  assert.equal(scraper.provider.atsPlatform, 'workday')

  const report = generateCompanyCoverageReport({
    csvText: 'Guardian\nGuardian India\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Guardian', 'guardian', 'Guardian'],
      ['Guardian India', 'guardian', 'Guardian'],
    ],
  )
})

test('Guardian local Workday config enumerates the complete current board without the obsolete India hiring-company facet', () => {
  const config = loadConfig(path.join(testsDir, '../../scraper/guardian.workday'))

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://guardianlife.wd5.myworkdayjobs.com/wday/cxs/guardianlife/Guardian-Life-Careers/jobs',
  )
  assert.equal(
    config.detailUrlBase,
    'https://guardianlife.wd5.myworkdayjobs.com/en-US/Guardian-Life-Careers',
  )
  assert.equal(config.countryFacetParameter, undefined)
  assert.equal(config.locationCountry, null)
  assert.equal(config.inventoryScope, 'complete-board-country-proof')
  assert.equal(config.officialCareersUrl, 'https://www.guardianlife.com/careers/corporate')
  assert.equal(config.retainProvenIndiaOnUnresolvedLocations, true)
  assert.equal(config.searchText, undefined)
  assert.equal(config.locationPattern, 'india|chennai|gurgaon|gurugram')
})
