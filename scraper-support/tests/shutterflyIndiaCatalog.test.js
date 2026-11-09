import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/shutterflyindia/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/shutterflyindia/catalog.js')
  } catch {
    assert.fail('Expected Shutterfly India catalog module at ../../scraper/shutterflyindia/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/shutterflyindia/script.js')
  } catch {
    assert.fail('Expected Shutterfly India scraper module at ../../scraper/shutterflyindia/script.js')
  }
}

test('Shutterfly India local catalog captures the verified overview plus Cloudflare-challenged TTC job surfaces', async () => {
  const { SHUTTERFLY_INDIA_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const shutterflyIndia = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(SHUTTERFLY_INDIA_CATALOG)

  assert.equal(defaultCatalog, SHUTTERFLY_INDIA_CATALOG)
  assert.equal(provider.source, 'shutterflyindia')
  assert.equal(provider.companyName, 'Shutterfly India')
  assert.equal(provider.officialBrandName, 'Shutterfly')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://shutterflyinc.com/overview/')
  assert.equal(provider.companyCareerPage, 'https://jobs.jobvite.com/shutterfly')
  assert.equal(provider.officialJobsPageUrl, 'https://shutterflycareers.ttcportals.com/?p=jobs&nl=1')
  assert.equal(provider.officialSearchResultsUrl, 'https://shutterflycareers.ttcportals.com/search/jobs')
  assert.equal(provider.companyDomain, 'shutterflyinc.com')
  assert.equal(provider.atsPlatform, 'jobvite-ttcportals-bot-gated-no-india-public-jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-overview-plus-bot-gated-ttc-job-surfaces')
  assert.equal(
    provider.extractionStrategy,
    'verified-overview-careers-link+verified-cloudflare-challenged-jobvite-entry+verified-cloudflare-challenged-search-results+return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-27')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /shutterflyindia[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Monday, July 27, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/shutterflyinc\.com\/overview\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/jobs\.jobvite\.com\/shutterfly/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/shutterflycareers\.ttcportals\.com\/search\/jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /Cloudflare/i)
  assert.match(provider.verifiedSurfaceSummary, /Just a moment/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy bot-accessible public India jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Shutterfly India'), false)

  assert.equal(shutterflyIndia.PROVIDER_METADATA.source, SHUTTERFLY_INDIA_CATALOG.source)
  assert.equal(shutterflyIndia.PROVIDER_METADATA.companyName, SHUTTERFLY_INDIA_CATALOG.companyName)
  assert.equal(
    shutterflyIndia.PROVIDER_METADATA.officialSearchResultsUrl,
    SHUTTERFLY_INDIA_CATALOG.officialSearchResultsUrl,
  )
})

test('Shutterfly India backlog row matches directly from local provider metadata', async () => {
  const { SHUTTERFLY_INDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Shutterfly India\n',
    catalog: [hydrateProviderCatalogEntry(SHUTTERFLY_INDIA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Shutterfly India', 'shutterflyindia', 'Shutterfly India']],
  )
})

test('Shutterfly India hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { SHUTTERFLY_INDIA_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SHUTTERFLY_INDIA_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Shutterfly India')
  assert.equal(provider.companyCareerPage, 'https://jobs.jobvite.com/shutterfly')
  assert.equal(provider.companyDomain, 'shutterflyinc.com')
  assert.equal(provider.atsPlatform, 'jobvite-ttcportals-bot-gated-no-india-public-jobs')
  assert.match(provider.modulePath, /shutterflyindia[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /shutterflyindia[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
