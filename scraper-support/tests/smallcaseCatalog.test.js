import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/smallcase/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/smallcase/catalog.js')
  } catch {
    assert.fail('Expected Smallcase catalog module at ../../scraper/smallcase/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/smallcase/script.js')
  } catch {
    assert.fail('Expected Smallcase scraper module at ../../scraper/smallcase/script.js')
  }
}

test('Smallcase local catalog captures the verified first-party About page and fail-closed PyjamaHR handoff state', async () => {
  const { SMALLCASE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const smallcase = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(SMALLCASE_CATALOG)

  assert.equal(defaultCatalog, SMALLCASE_CATALOG)
  assert.equal(provider.source, 'smallcase')
  assert.equal(provider.companyName, 'Smallcase')
  assert.equal(provider.officialBrandName, 'smallcase')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.smallcase.com/about')
  assert.equal(provider.officialCareersPageUrl, 'https://www.smallcase.com/about')
  assert.equal(
    provider.officialCareersHandoffUrl,
    'https://app.pyjamahr.com/careers?company=smallcase&company_uuid=2615584222',
  )
  assert.equal(
    provider.verifiedSampleJobUrl,
    'https://jobs.pyjamahr.com/smallcase/software-engineer-level-ii-backend-development',
  )
  assert.equal(provider.companyDomain, 'smallcase.com')
  assert.equal(provider.atsPlatform, 'pyjamahr-handoff-unverifiable')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'official-about-page-plus-external-pyjamahr-handoff-no-verifiable-current-public-board',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-about-page+verified-pyjamahr-handoff+historical-public-jobdetail+fail-closed-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /smallcase[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.smallcase\.com\/about/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/app\.pyjamahr\.com\/careers\?company=smallcase&company_uuid=2615584222/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/jobs\.pyjamahr\.com\/smallcase\/software-engineer-level-ii-backend-development/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Smallcase'), false)

  assert.equal(smallcase.PROVIDER_METADATA.source, SMALLCASE_CATALOG.source)
  assert.equal(smallcase.PROVIDER_METADATA.companyName, SMALLCASE_CATALOG.companyName)
})

test('Smallcase exact backlog row matches directly from the local provider metadata', async () => {
  const { SMALLCASE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Smallcase\n',
    catalog: [hydrateProviderCatalogEntry(SMALLCASE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Smallcase', 'smallcase', 'Smallcase']],
  )
})

test('Smallcase hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { SMALLCASE_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SMALLCASE_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Smallcase')
  assert.equal(provider.companyCareerPage, 'https://www.smallcase.com/about')
  assert.equal(provider.companyDomain, 'smallcase.com')
  assert.equal(provider.atsPlatform, 'pyjamahr-handoff-unverifiable')
  assert.match(provider.modulePath, /smallcase[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /smallcase[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
