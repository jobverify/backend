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

test('getScraperCatalog includes TransUnion CIBIL on the official India careers page backed by Workday', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'transunioncibil')

  assert.ok(provider)
  assert.equal(provider.adapter, 'workday')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyName, 'TransUnion CIBIL')
  assert.equal(provider.companyCareerPage, 'https://www.transunioncibil.com/careers/careers-at-tu')
  assert.equal(provider.companyDomain, 'transunioncibil.com')
  assert.equal(
    provider.officialWorkdayBoardUrl,
    'https://transunion.wd5.myworkdayjobs.com/transunion',
  )
  assert.equal(
    provider.jobsApiUrl,
    'https://transunion.wd5.myworkdayjobs.com/wday/cxs/transunion/transunion/jobs',
  )
  assert.equal(provider.baseUrl, 'https://transunion.wd5.myworkdayjobs.com/transunion')
  assert.equal(provider.locationCountry, null)
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.transunioncibil\.com\/careers\/careers-at-tu/i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/transunion\.wd5\.myworkdayjobs\.com\/transunion/i,
  )
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/transunion\.wd5\.myworkdayjobs\.com\/wday\/cxs\/transunion\/transunion\/jobs/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /India|Mumbai|Pune|Chennai|Bengaluru|Hyderabad/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'TransUnion CIBIL'), false)
})

test('buildScrapers and company coverage resolve TransUnion CIBIL from the shared Workday catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'transunioncibil')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /transunioncibil.workday[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'transunioncibil')
  assert.equal(scraper.provider.atsPlatform, 'workday')

  const report = generateCompanyCoverageReport({
    csvText: 'TransUnion CIBIL\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['TransUnion CIBIL', 'transunioncibil', 'TransUnion CIBIL']],
  )
})

test('TransUnion CIBIL local Workday config switches the shared runner onto jobs-api searchText filtering for India roles', () => {
  const config = loadConfig(path.join(testsDir, '../../scraper/transunioncibil.workday'))

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://transunion.wd5.myworkdayjobs.com/wday/cxs/transunion/transunion/jobs',
  )
  assert.equal(
    config.detailUrlBase,
    'https://transunion.wd5.myworkdayjobs.com/en-US/transunion',
  )
  assert.equal(config.locationCountry, null)
  assert.equal(config.searchText, 'India')
  assert.equal(config.locationPattern, 'india|mumbai|pune|chennai|hyderabad|bengaluru|bangalore')
})
