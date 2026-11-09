import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/sifytechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/sifytechnologies/catalog.js')
  } catch {
    assert.fail('Expected Sify Technologies catalog module at ../../scraper/sifytechnologies/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/sifytechnologies/script.js')
  } catch {
    assert.fail('Expected Sify Technologies scraper module at ../../scraper/sifytechnologies/script.js')
  }
}

test('Sify Technologies local catalog captures the verified Tallite-backed first-party careers metadata', async () => {
  const { SIFY_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const sifyTechnologies = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(SIFY_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, SIFY_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'sifytechnologies')
  assert.equal(provider.companyName, 'Sify Technologies')
  assert.equal(provider.officialBrandName, 'Sify Technologies')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.sifytechnologies.com/')
  assert.equal(provider.officialAboutPageUrl, 'https://www.sifytechnologies.com/about-us/')
  assert.equal(provider.companyCareerPage, 'https://sifycareer.tallite.com/')
  assert.equal(provider.officialJobsPageUrl, 'https://sifycareer.tallite.com/jobs')
  assert.equal(provider.companyDomain, 'sifytechnologies.com')
  assert.equal(provider.atsPlatform, 'tallite')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'encrypted-post-body-page-number')
  assert.equal(
    provider.extractionStrategy,
    'verified-about-page-careers-link+public-tallite-encrypted-job-list+public-tallite-encrypted-job-detail',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-26')
  assert.equal(provider.sellerShortCode, 'SIF')
  assert.equal(provider.apiBaseUrl, 'https://www.tallite.com/api_sify/')
  assert.equal(
    provider.listingApiUrl,
    'https://www.tallite.com/api_sify/icrweb/home/tallite_career_portal_job_list?lngId=1&sellerShortCode=SIF',
  )
  assert.equal(
    provider.detailApiUrl,
    'https://www.tallite.com/api_sify/icrweb/home/tallite_career_portal_job_detail?lngId=1&sellerShortCode=SIF',
  )
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /sifytechnologies[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Sunday, July 26, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.sifytechnologies\.com\/about-us\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/sifycareer\.tallite\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /returned 36 India jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /Assistant Manager-Network Projects/i)
  assert.match(provider.verifiedSurfaceSummary, /public encrypted Tallite APIs/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Sify Technologies'), false)

  assert.equal(sifyTechnologies.PROVIDER_METADATA.source, SIFY_TECHNOLOGIES_CATALOG.source)
  assert.equal(sifyTechnologies.PROVIDER_METADATA.companyName, SIFY_TECHNOLOGIES_CATALOG.companyName)
  assert.equal(sifyTechnologies.PROVIDER_METADATA.sellerShortCode, SIFY_TECHNOLOGIES_CATALOG.sellerShortCode)
})

test('Sify Technologies backlog row matches directly from local provider metadata', async () => {
  const { SIFY_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Sify Technologies\n',
    catalog: [hydrateProviderCatalogEntry(SIFY_TECHNOLOGIES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Sify Technologies', 'sifytechnologies', 'Sify Technologies']],
  )
})

test('Sify Technologies hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { SIFY_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SIFY_TECHNOLOGIES_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Sify Technologies')
  assert.equal(provider.companyCareerPage, 'https://sifycareer.tallite.com/')
  assert.equal(provider.companyDomain, 'sifytechnologies.com')
  assert.equal(provider.atsPlatform, 'tallite')
  assert.match(provider.modulePath, /sifytechnologies[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /sifytechnologies[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
