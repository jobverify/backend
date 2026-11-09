import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const goApptivModulePath = path.resolve(currentDir, '../../scraper/goapptiv/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/goapptiv/catalog.js')
  } catch {
    assert.fail('Expected GoApptiv catalog module at ../../scraper/goapptiv/catalog.js')
  }
}

const loadGoApptivModule = async () => {
  try {
    return await import('../../scraper/goapptiv/script.js')
  } catch {
    assert.fail('Expected GoApptiv scraper module at ../../scraper/goapptiv/script.js')
  }
}

test('GoApptiv local catalog captures the verified homepage-plus-team page no-public-careers surface', async () => {
  const { GOAPPTIV_CATALOG } = await loadCatalogModule()
  const goApptiv = await loadGoApptivModule()

  assert.equal(GOAPPTIV_CATALOG.source, 'goapptiv')
  assert.equal(GOAPPTIV_CATALOG.companyName, 'GoApptiv')
  assert.equal(GOAPPTIV_CATALOG.officialBrandName, 'GoApptiv')
  assert.equal(GOAPPTIV_CATALOG.adapter, 'script')
  assert.equal(GOAPPTIV_CATALOG.companyCareerPage, 'https://www.goapptiv.com/')
  assert.equal(GOAPPTIV_CATALOG.companyDomain, 'goapptiv.com')
  assert.equal(GOAPPTIV_CATALOG.teamCulturePageUrl, 'https://www.goapptiv.com/teamandculture')
  assert.equal(GOAPPTIV_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(GOAPPTIV_CATALOG.countryFilter, 'India')
  assert.equal(
    GOAPPTIV_CATALOG.paginationStrategy,
    'homepage-plus-team-culture-plus-common-careers-route-validation',
  )
  assert.equal(
    GOAPPTIV_CATALOG.extractionStrategy,
    'verified-homepage+verified-team-culture+common-careers-routes-return-404-without-public-job-signals',
  )
  assert.equal(GOAPPTIV_CATALOG.parser, 'custom-script')
  assert.equal(GOAPPTIV_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(GOAPPTIV_CATALOG.verifiedOn, '2026-07-16')
  assert.match(GOAPPTIV_CATALOG.verifiedSurfaceSummary, /teamandculture/i)
  assert.match(GOAPPTIV_CATALOG.verifiedSurfaceSummary, /\/careers/i)
  assert.match(GOAPPTIV_CATALOG.verifiedSurfaceSummary, /no trustworthy public job listings/i)
  assert.equal(GOAPPTIV_CATALOG.modulePath, goApptivModulePath)

  assert.equal(goApptiv.PROVIDER_METADATA.source, GOAPPTIV_CATALOG.source)
  assert.equal(goApptiv.PROVIDER_METADATA.companyName, GOAPPTIV_CATALOG.companyName)
  assert.equal(goApptiv.PROVIDER_METADATA.companyCareerPage, GOAPPTIV_CATALOG.companyCareerPage)
  assert.equal(goApptiv.PROVIDER_METADATA.teamCulturePageUrl, GOAPPTIV_CATALOG.teamCulturePageUrl)
})

test('GoApptiv exact backlog row resolves directly from the local provider metadata without aliases', async () => {
  const { GOAPPTIV_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'GoApptiv\n',
    catalog: [GOAPPTIV_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['GoApptiv', 'goapptiv', 'GoApptiv']],
  )
})

test('getScraperCatalog includes GoApptiv as a verified no-public-jobs provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'goapptiv')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'GoApptiv')
  assert.equal(provider.companyCareerPage, 'https://www.goapptiv.com/')
  assert.equal(provider.companyDomain, 'goapptiv.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /goapptiv[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable GoApptiv scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'goapptiv')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'goapptiv')
  assert.equal(scraper.provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(scraper.dryRunFile, /goapptiv[\\/]jobs\.json$/i)
})
