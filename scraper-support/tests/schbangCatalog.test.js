import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/schbang/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/schbang/catalog.js')
  } catch {
    assert.fail('Expected Schbang catalog module at ../../scraper/schbang/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/schbang/script.js')
  } catch {
    assert.fail('Expected Schbang scraper module at ../../scraper/schbang/script.js')
  }
}

test('Schbang local catalog captures the verified official careers handoff and live Zoho Recruit API contract', async () => {
  const { SCHBANG_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const schbang = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(SCHBANG_CATALOG)

  assert.equal(defaultCatalog, SCHBANG_CATALOG)
  assert.equal(provider.source, 'schbang')
  assert.equal(provider.companyName, 'Schbang')
  assert.equal(provider.officialBrandName, 'Schbang')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.schbang.com/careers')
  assert.equal(provider.officialCareersPageUrl, 'https://www.schbang.com/careers')
  assert.equal(provider.careersPortalUrl, 'https://careers.schbang.com/jobs/Careers')
  assert.equal(
    provider.jobOpeningsApiUrl,
    'https://careers.schbang.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(provider.companyDomain, 'schbang.com')
  assert.equal(provider.atsPlatform, 'zohorecruit')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.verifiedPublicJobCount, 1)
  assert.equal(provider.verifiedSampleJobTitle, 'Creative Strategist')
  assert.equal(provider.paginationStrategy, 'official-careers-page-handoff-plus-public-zoho-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-hiring-portal-handoff+public-zoho-job-openings-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /schbang[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.schbang\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.schbang\.com\/jobs\/Careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.schbang\.com\/recruit\/v2\/public\/Job_Openings/i)
  assert.match(provider.verifiedSurfaceSummary, /Creative Strategist/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Schbang'), false)

  assert.equal(schbang.PROVIDER_METADATA.source, SCHBANG_CATALOG.source)
  assert.equal(schbang.PROVIDER_METADATA.jobOpeningsApiUrl, SCHBANG_CATALOG.jobOpeningsApiUrl)
})

test('Schbang exact backlog row matches directly from local provider metadata without aliases', async () => {
  const { SCHBANG_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Schbang\n',
    catalog: [hydrateProviderCatalogEntry(SCHBANG_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Schbang', 'schbang', 'Schbang']],
  )
})

test('Schbang hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { SCHBANG_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SCHBANG_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.match(provider.modulePath, /schbang[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /schbang[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
