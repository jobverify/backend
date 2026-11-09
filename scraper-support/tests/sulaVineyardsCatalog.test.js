import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/sulavineyards/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/sulavineyards/catalog.js')
  } catch {
    assert.fail('Expected Sula Vineyards catalog module at ../../scraper/sulavineyards/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/sulavineyards/script.js')
  } catch {
    assert.fail('Expected Sula Vineyards scraper module at ../../scraper/sulavineyards/script.js')
  }
}

test('Sula Vineyards local catalog captures the verified first-party careers page and fail-closed HROne handoff state', async () => {
  const { SULA_VINEYARDS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const sula = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(SULA_VINEYARDS_CATALOG)

  assert.equal(defaultCatalog, SULA_VINEYARDS_CATALOG)
  assert.equal(provider.source, 'sulavineyards')
  assert.equal(provider.companyName, 'Sula Vineyards')
  assert.equal(provider.officialBrandName, 'Sula Vineyards Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://sulavineyards.com/careers.php')
  assert.equal(provider.officialCareersPageUrl, 'https://sulavineyards.com/careers.php')
  assert.equal(
    provider.officialCareersHandoffUrl,
    'https://app.hrone.cloud/career-portal?appId=MHZzWpATk5uSVkWo1EwlhxzjgIG1VZ3pIZYpNVctJxMlUQo18qUoCm-17Y6BMlv4l0Cqdw6PNgHEZKAACmWo7upw3Rwo24m2v5XmXqZ2XGYc1Q2nq54JyLnImKiiIoss&dc=sula&rqt=m8jH4bpBQbccEU8MZpSP5Q&cc=eaqzS8e-weZZc3W_dw_T1Q',
  )
  assert.equal(provider.companyDomain, 'sulavineyards.com')
  assert.equal(provider.atsPlatform, 'hrone-handoff-unverifiable')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'official-careers-page-plus-external-hrone-handoff-no-verifiable-public-board',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-official-careers-page+verified-hrone-handoff+fail-closed-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-05')
  assert.match(provider.dryRunFile, /sulavineyards[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Wednesday, August 5, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/sulavineyards\.com\/careers\.php/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/app\.hrone\.cloud\/career-portal\?/i)
  assert.match(provider.verifiedSurfaceSummary, /Careers at Sula/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Sula Vineyards'), false)

  assert.equal(sula.PROVIDER_METADATA.source, SULA_VINEYARDS_CATALOG.source)
  assert.equal(sula.PROVIDER_METADATA.companyName, SULA_VINEYARDS_CATALOG.companyName)
})

test('Sula Vineyards exact backlog row matches directly from the local provider metadata', async () => {
  const { SULA_VINEYARDS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Sula Vineyards\n',
    catalog: [hydrateProviderCatalogEntry(SULA_VINEYARDS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Sula Vineyards', 'sulavineyards', 'Sula Vineyards']],
  )
})

test('Sula Vineyards hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { SULA_VINEYARDS_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SULA_VINEYARDS_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Sula Vineyards')
  assert.equal(provider.companyCareerPage, 'https://sulavineyards.com/careers.php')
  assert.equal(provider.companyDomain, 'sulavineyards.com')
  assert.equal(provider.atsPlatform, 'hrone-handoff-unverifiable')
  assert.match(provider.modulePath, /sulavineyards[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /sulavineyards[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
