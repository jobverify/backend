import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/uandsquaresolutions/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/uandsquaresolutions/catalog.js')
  } catch {
    assert.fail('Expected U&D Square Solutions catalog module at ../../scraper/uandsquaresolutions/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/uandsquaresolutions/script.js')
  } catch {
    assert.fail('Expected U&D Square Solutions scraper module at ../../scraper/uandsquaresolutions/script.js')
  }
}

test('U&D Square Solutions local catalog captures the verified MSP Square handoff contract', async () => {
  const { U_AND_D_SQUARE_SOLUTIONS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const uds = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(U_AND_D_SQUARE_SOLUTIONS_CATALOG)

  assert.equal(defaultCatalog, U_AND_D_SQUARE_SOLUTIONS_CATALOG)
  assert.equal(provider.source, 'uandsquaresolutions')
  assert.equal(provider.companyName, 'U&D Square Solutions')
  assert.equal(provider.officialBrandName, 'U&D Square Solutions')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'http://www.udsquare.com/')
  assert.equal(provider.companyCareerPage, 'http://www.udsquare.com/')
  assert.equal(provider.redirectTargetUrl, 'https://mspsquare.com/')
  assert.equal(provider.companyDomain, 'udsquare.com')
  assert.equal(provider.atsPlatform, 'redirected-first-party-homepage-contract')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'first-party-domain-redirect-to-msp-square-homepage')
  assert.equal(
    provider.extractionStrategy,
    'verified-domain-handoff-without-public-careers-or-job-links-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /MSP Square/i)
  assert.match(provider.verifiedSurfaceSummary, /About/i)
  assert.match(provider.verifiedSurfaceSummary, /Contact/i)
  assert.match(provider.verifiedSurfaceSummary, /no public careers or jobs navigation/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /uandsquaresolutions[\\/]jobs\.json$/i)

  assert.equal(uds.PROVIDER_METADATA.source, provider.source)
  assert.equal(uds.PROVIDER_METADATA.redirectTargetUrl, provider.redirectTargetUrl)
})

test('U&D Square Solutions exact backlog row resolves from the local provider contract', async () => {
  const { U_AND_D_SQUARE_SOLUTIONS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'U&D Square Solutions\n',
    catalog: [hydrateProviderCatalogEntry(U_AND_D_SQUARE_SOLUTIONS_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['U&D Square Solutions', 'uandsquaresolutions', 'U&D Square Solutions']],
  )
})
