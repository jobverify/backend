import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fullertonIndiaModulePath = path.resolve(currentDir, '../../scraper/fullertonindia/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/fullertonindia/catalog.js')
  } catch {
    assert.fail('Expected Fullerton India catalog module at ../../scraper/fullertonindia/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/fullertonindia/script.js')
  } catch {
    assert.fail('Expected Fullerton India scraper module at ../../scraper/fullertonindia/script.js')
  }
}

test('Fullerton India local catalog captures the verified redirect plus Workline careers handoff contract on August 2, 2026', async () => {
  const { FULLERTON_INDIA_CATALOG } = await loadCatalogModule()
  const fullertonIndia = await loadScriptModule()

  assert.equal(FULLERTON_INDIA_CATALOG.source, 'fullertonindia')
  assert.equal(FULLERTON_INDIA_CATALOG.companyName, 'Fullerton India')
  assert.equal(FULLERTON_INDIA_CATALOG.officialBrandName, 'SMFG India Credit')
  assert.equal(FULLERTON_INDIA_CATALOG.adapter, 'script')
  assert.equal(FULLERTON_INDIA_CATALOG.homepageUrl, 'https://fullertonindia.com/')
  assert.equal(FULLERTON_INDIA_CATALOG.redirectedHomepageUrl, 'https://www.smfgindiacredit.com/')
  assert.equal(
    FULLERTON_INDIA_CATALOG.companyCareerPage,
    'https://www.smfgindiacredit.com/careers.aspx',
  )
  assert.equal(
    FULLERTON_INDIA_CATALOG.jobsBoardEntryUrl,
    'https://app52.workline.hr/Candidate/GeneralOpening.aspx',
  )
  assert.equal(
    FULLERTON_INDIA_CATALOG.jobsBoardUrl,
    'https://app52.workline.hr/Cportal/GeneralOpening.aspx',
  )
  assert.equal(
    FULLERTON_INDIA_CATALOG.jobsApiUrl,
    'https://app52.workline.hr/CPortal/generalopening.aspx/GetCurrentopening',
  )
  assert.equal(FULLERTON_INDIA_CATALOG.companyDomain, 'fullertonindia.com')
  assert.equal(FULLERTON_INDIA_CATALOG.atsPlatform, 'workline-public-jobs-api')
  assert.equal(FULLERTON_INDIA_CATALOG.countryFilter, 'India')
  assert.equal(
    FULLERTON_INDIA_CATALOG.paginationStrategy,
    'exact-name-homepage-redirect-plus-first-party-careers-handoff-plus-workline-current-opening-api',
  )
  assert.equal(
    FULLERTON_INDIA_CATALOG.extractionStrategy,
    'verified-first-party-handoff+current-native-India-listing+paired-public-role+published-view-only-full-PDF-description',
  )
  assert.equal(FULLERTON_INDIA_CATALOG.parser, 'custom-script')
  assert.equal(FULLERTON_INDIA_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(FULLERTON_INDIA_CATALOG.verifiedOn, '2026-08-02')
  assert.equal(FULLERTON_INDIA_CATALOG.dryRunFile, 'fullertonindia/jobs.json')
  assert.equal(FULLERTON_INDIA_CATALOG.modulePath, fullertonIndiaModulePath)
  assert.match(FULLERTON_INDIA_CATALOG.verifiedSurfaceSummary, /https:\/\/fullertonindia\.com\//i)
  assert.match(FULLERTON_INDIA_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.smfgindiacredit\.com\//i)
  assert.match(
    FULLERTON_INDIA_CATALOG.verifiedSurfaceSummary,
    /https:\/\/www\.smfgindiacredit\.com\/careers\.aspx/i,
  )
  assert.match(
    FULLERTON_INDIA_CATALOG.verifiedSurfaceSummary,
    /https:\/\/app52\.workline\.hr\/Candidate\/GeneralOpening\.aspx/i,
  )
  assert.match(
    FULLERTON_INDIA_CATALOG.verifiedSurfaceSummary,
    /https:\/\/app52\.workline\.hr\/Cportal\/GeneralOpening\.aspx/i,
  )
  assert.match(
    FULLERTON_INDIA_CATALOG.verifiedSurfaceSummary,
    /GetCurrentopening/i,
  )
  assert.match(
    FULLERTON_INDIA_CATALOG.verifiedSurfaceSummary,
    /fails closed if that public contract differs/i,
  )

  assert.equal(fullertonIndia.PROVIDER_METADATA.source, FULLERTON_INDIA_CATALOG.source)
  assert.equal(fullertonIndia.PROVIDER_METADATA.companyName, FULLERTON_INDIA_CATALOG.companyName)
  assert.equal(
    fullertonIndia.PROVIDER_METADATA.jobsBoardUrl,
    FULLERTON_INDIA_CATALOG.jobsBoardUrl,
  )
  assert.equal(
    fullertonIndia.PROVIDER_METADATA.jobsApiUrl,
    FULLERTON_INDIA_CATALOG.jobsApiUrl,
  )
})

test('Fullerton India backlog row hydrates locally from the local provider contract', async () => {
  const { FULLERTON_INDIA_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(FULLERTON_INDIA_CATALOG)

  assert.equal(provider.companyName, 'Fullerton India')
  assert.equal(provider.companyDomain, 'fullertonindia.com')
  assert.match(provider.modulePath, /fullertonindia[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /fullertonindia[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Fullerton India\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Fullerton India', 'fullertonindia', 'Fullerton India']],
  )
})
