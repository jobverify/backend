import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const yubiModulePath = path.resolve(currentDir, '../../scraper/yubi/script.js')

test('getScraperCatalog includes Yubi as a verified Zoho Recruit provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'yubi')

  assert.ok(provider, 'Expected Yubi provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Yubi')
  assert.equal(provider.officialBrandName, 'Yubi')
  assert.equal(provider.companyCareerPage, 'https://go-yubi.zohorecruit.in/jobs/Careers')
  assert.equal(provider.companyDomain, 'go-yubi.zohorecruit.in')
  assert.equal(provider.atsPlatform, 'zohorecruit')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-api-request')
  assert.equal(
    provider.extractionStrategy,
    'verified-public-zoho-portal+public-job-openings-api+exact-yubi-company-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.match(provider.modulePath, /yubi[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /go-yubi\.zohorecruit\.in\/jobs\/Careers/i)
  assert.match(provider.verifiedSurfaceSummary, /formerly known as CredAvenue/i)
  assert.match(provider.verifiedSurfaceSummary, /L1 Support Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /Voice Platform Operation Engineer/i)
})

test('Yubi exact-name rows and the CredAvenue alias both resolve to the same provider', () => {
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'CredAvenue'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Yubi\nCredAvenue\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Yubi', 'yubi', 'Yubi'],
      ['CredAvenue', 'yubi', 'Yubi'],
    ],
  )
})

test('buildScrapers exposes a runnable Yubi scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'yubi')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'yubi')
  assert.equal(scraper.provider.atsPlatform, 'zohorecruit')
  assert.match(scraper.dryRunFile, /yubi[\\/]jobs\.json$/i)
})
