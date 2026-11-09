import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/amagi/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/amagi/catalog.js')
  } catch {
    assert.fail('Expected Amagi Media Labs catalog module at ../../scraper/amagi/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/amagi/script.js')
  } catch {
    assert.fail('Expected Amagi Media Labs scraper module at ../../scraper/amagi/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Amagi Media Labs local catalog captures the verified first-party MyNextHire shell and listing API', async () => {
  const { AMAGI_MEDIA_LABS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const amagi = await loadScriptModule()
  const provider = buildCatalogReadyProvider(AMAGI_MEDIA_LABS_CATALOG)

  assert.equal(defaultCatalog, AMAGI_MEDIA_LABS_CATALOG)
  assert.equal(provider.source, 'amagi')
  assert.equal(provider.companyName, 'Amagi Media Labs')
  assert.equal(provider.officialBrandName, 'Amagi')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.amagi.com/')
  assert.equal(provider.companyCareerPage, 'https://www.amagi.com/careers/open-roles')
  assert.equal(provider.jobsBoardUrl, 'https://amagi.mynexthire.com/employer/jobs/careers')
  assert.equal(provider.listingApiUrl, 'https://amagi.mynexthire.com/employer/careers/reqlist/get')
  assert.equal(provider.atsPlatform, 'mynexthire')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-page')
  assert.equal(provider.extractionStrategy, 'api')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'amagi.com')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Current Openings \[18\]/i)
  assert.match(provider.verifiedSurfaceSummary, /Marketing Operations Lead \(GTM - RevOps\)/i)
  assert.match(provider.verifiedSurfaceSummary, /QA Engineer I/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /amagi[\\/]jobs\.json$/i)

  assert.equal(amagi.PROVIDER_METADATA.source, provider.source)
  assert.equal(amagi.PROVIDER_METADATA.listingApiUrl, provider.listingApiUrl)
})

test('Amagi Media Labs exact backlog row resolves from the local provider contract', async () => {
  const { AMAGI_MEDIA_LABS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Amagi Media Labs\n',
    catalog: [buildCatalogReadyProvider(AMAGI_MEDIA_LABS_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Amagi Media Labs', 'amagi', 'Amagi Media Labs']],
  )
})
