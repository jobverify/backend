import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/snapdeal/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/snapdeal/catalog.js')
  } catch {
    assert.fail('Expected Snapdeal catalog module at ../../scraper/snapdeal/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/snapdeal/script.js')
  } catch {
    assert.fail('Expected Snapdeal scraper module at ../../scraper/snapdeal/script.js')
  }
}

test('Snapdeal local catalog captures the verified first-party LinkedIn handoff', async () => {
  const { SNAPDEAL_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const snapdeal = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(SNAPDEAL_CATALOG)

  assert.equal(defaultCatalog, SNAPDEAL_CATALOG)
  assert.equal(provider.source, 'snapdeal')
  assert.equal(provider.companyName, 'Snapdeal')
  assert.equal(provider.officialBrandName, 'Snapdeal')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.snapdeal.com/')
  assert.equal(provider.officialCareersPageUrl, 'https://www.snapdeal.com/')
  assert.equal(provider.officialAboutPageUrl, 'https://www.snapdeal.com/page/about-us')
  assert.equal(provider.officialCareersHandoffUrl, 'https://www.linkedin.com/company/snapdeal/')
  assert.equal(provider.linkedinCompanyPageUrl, 'https://www.linkedin.com/company/snapdeal/')
  assert.equal(provider.linkedinWorldwideJobsUrl, 'https://www.linkedin.com/jobs/snapdeal-jobs-worldwide?f_C=2100709')
  assert.equal(provider.publicLinkedInJobsUrl, 'https://www.linkedin.com/jobs/search/?f_C=2100709&geoId=102713980')
  assert.equal(provider.companyDomain, 'snapdeal.com')
  assert.equal(provider.atsPlatform, 'linkedin-guest-search')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-company-search-page')
  assert.equal(
    provider.extractionStrategy,
    'official-homepage-and-about-page-linkedin-handoff+public-linkedin-company-search+public-detail-jsonld',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-14')
  assert.equal(provider.verifiedPublicJobCount, 3)
  assert.equal(provider.verifiedIndiaJobCount, 3)
  assert.match(provider.dryRunFile, /snapdeal[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 14, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.snapdeal\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.snapdeal\.com\/page\/about-us/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.linkedin\.com\/company\/snapdeal\//i)
  assert.match(provider.verifiedSurfaceSummary, /org id 2100709/i)
  assert.match(provider.verifiedSurfaceSummary, /Lead Software Engineer/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Snapdeal'), false)

  assert.equal(snapdeal.PROVIDER_METADATA.source, SNAPDEAL_CATALOG.source)
  assert.equal(snapdeal.PROVIDER_METADATA.companyName, SNAPDEAL_CATALOG.companyName)
})

test('Snapdeal exact backlog row matches directly from local provider metadata', async () => {
  const { SNAPDEAL_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Snapdeal\n',
    catalog: [hydrateProviderCatalogEntry(SNAPDEAL_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Snapdeal', 'snapdeal', 'Snapdeal']],
  )
})

test('Snapdeal hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { SNAPDEAL_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SNAPDEAL_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Snapdeal')
  assert.equal(provider.companyCareerPage, 'https://www.snapdeal.com/')
  assert.equal(provider.companyDomain, 'snapdeal.com')
  assert.equal(provider.atsPlatform, 'linkedin-guest-search')
  assert.match(provider.modulePath, /snapdeal[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /snapdeal[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
