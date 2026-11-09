import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/volksoft/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/volksoft/catalog.js')
  } catch {
    assert.fail('Expected Volksoft Technologies catalog module at ../../scraper/volksoft/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/volksoft/script.js')
  } catch {
    assert.fail('Expected Volksoft Technologies scraper module at ../../scraper/volksoft/script.js')
  }
}

test('Volksoft Technologies local catalog captures the verified placeholder-only first-party careers surface', async () => {
  const { VOLKSOFT_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const volksoft = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(VOLKSOFT_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, VOLKSOFT_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'volksoft')
  assert.equal(provider.companyName, 'Volksoft Technologies')
  assert.equal(provider.officialBrandName, 'VolkSoft')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://volksoft.in/')
  assert.equal(provider.companyCareerPage, 'https://volksoft.in/careers/')
  assert.equal(provider.companyDomain, 'volksoft.in')
  assert.equal(provider.atsPlatform, 'official-company-careers-placeholder-openings')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-single-careers-page-plus-placeholder-opening-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-placeholder-opening-cards+resume-upload-form-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/volksoft\.in\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /Lorem ipsum dolor sit amet/i)
  assert.match(provider.verifiedSurfaceSummary, /Position Applying For/i)
  assert.match(provider.verifiedSurfaceSummary, /not trustworthy public job listings/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /volksoft[\\/]jobs\.json$/i)

  assert.equal(volksoft.PROVIDER_METADATA.source, provider.source)
  assert.equal(volksoft.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('Volksoft Technologies exact backlog row resolves from the local provider contract', async () => {
  const { VOLKSOFT_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Volksoft Technologies\n',
    catalog: [hydrateProviderCatalogEntry(VOLKSOFT_TECHNOLOGIES_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Volksoft Technologies', 'volksoft', 'Volksoft Technologies']],
  )
})
