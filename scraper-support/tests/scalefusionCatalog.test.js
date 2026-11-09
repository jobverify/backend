import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/scalefusion/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/scalefusion/catalog.js')
  } catch {
    assert.fail('Expected Scalefusion catalog module at ../../scraper/scalefusion/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/scalefusion/script.js')
  } catch {
    assert.fail('Expected Scalefusion scraper module at ../../scraper/scalefusion/script.js')
  }
}

test('Scalefusion local catalog captures the verified exact-name careers handoff to ProMobi openings', async () => {
  const { SCALEFUSION_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const scalefusion = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(SCALEFUSION_CATALOG)

  assert.equal(defaultCatalog, SCALEFUSION_CATALOG)
  assert.equal(provider.source, 'scalefusion')
  assert.equal(provider.companyName, 'Scalefusion')
  assert.equal(provider.officialBrandName, 'Scalefusion')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://scalefusion.com/careers/')
  assert.equal(provider.officialCareersPageUrl, 'https://scalefusion.com/careers/')
  assert.equal(provider.officialCareersHandoffUrl, 'https://promobitech.com/careers')
  assert.equal(provider.verifiedJobListingPageUrl, 'https://promobitech.com/careers')
  assert.equal(provider.companyDomain, 'scalefusion.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-handoff-parent-site')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.verifiedPublicJobCount, 7)
  assert.equal(provider.verifiedSampleJobTitle, 'Ruby On Rails Developer')
  assert.equal(provider.verifiedSampleSecondaryJobTitle, 'Senior Product Engineer - Golang')
  assert.equal(
    provider.paginationStrategy,
    'verified-exact-name-careers-handoff-plus-single-parent-company-open-positions-page',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-exact-name-careers-page+verified-parent-company-careers-handoff+parent-company-open-position-cards+public-detail-pages',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /scalefusion[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/scalefusion\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/promobitech\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /Ruby On Rails Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Product Engineer - Golang/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Scalefusion'), false)

  assert.equal(scalefusion.PROVIDER_METADATA.source, SCALEFUSION_CATALOG.source)
  assert.equal(
    scalefusion.PROVIDER_METADATA.officialCareersHandoffUrl,
    SCALEFUSION_CATALOG.officialCareersHandoffUrl,
  )
})

test('Scalefusion exact backlog row matches directly from local provider metadata without aliases', async () => {
  const { SCALEFUSION_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Scalefusion\n',
    catalog: [hydrateProviderCatalogEntry(SCALEFUSION_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Scalefusion', 'scalefusion', 'Scalefusion']],
  )
})

test('Scalefusion hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { SCALEFUSION_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SCALEFUSION_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.match(provider.modulePath, /scalefusion[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /scalefusion[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
