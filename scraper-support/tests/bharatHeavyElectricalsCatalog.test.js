import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/bharatheavyelectricals/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/bharatheavyelectricals/catalog.js')
  } catch {
    assert.fail('Expected Bharat Heavy Electricals catalog module at ../../scraper/bharatheavyelectricals/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/bharatheavyelectricals/script.js')
  } catch {
    assert.fail('Expected Bharat Heavy Electricals scraper module at ../../scraper/bharatheavyelectricals/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Bharat Heavy Electricals local catalog records the current native limited-scope recruitment contract', async () => {
  const { BHARAT_HEAVY_ELECTRICALS_CATALOG } = await loadCatalogModule()
  const bhel = await loadScraperModule()
  const provider = buildCatalogReadyProvider(BHARAT_HEAVY_ELECTRICALS_CATALOG)

  assert.equal(provider.source, 'bharatheavyelectricals')
  assert.equal(provider.companyName, 'Bharat Heavy Electricals')
  assert.equal(provider.officialBrandName, 'Bharat Heavy Electricals Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.bhel.com/')
  assert.equal(provider.homepageLinkedCareersUrl, 'https://careers.bhel.in/index.jsp')
  assert.equal(provider.companyCareerPage, 'https://careers.bhel.in/index.jsp')
  assert.equal(provider.companyDomain, 'bhel.com')
  assert.equal(provider.atsPlatform, 'official-recruitment-notices-pdf-bundles')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'company-declared-coupled-documents+bounded-sequential-first-failure-stop+scope-unverified',
  )
  assert.equal(
    provider.extractionStrategy,
    'company-careers-card+visible-announcements+native-advertisement-and-corrections+unit-trade-matrix+first-unqualified-stop',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-11-07')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /bharatheavyelectricals[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.bhel\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.bhel\.in\/index\.jsp/i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /two referenced corrigenda/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /country.*unverified|scope remain unverified/i)

  assert.equal(bhel.PROVIDER_METADATA.source, provider.source)
  assert.equal(bhel.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(bhel.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.equal(
    bhel.PROVIDER_METADATA.homepageLinkedCareersUrl,
    provider.homepageLinkedCareersUrl,
  )
})

test('Bharat Heavy Electricals exact backlog name matches from the local provider contract without aliases', async () => {
  const { BHARAT_HEAVY_ELECTRICALS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Bharat Heavy Electricals\n',
    catalog: [buildCatalogReadyProvider(BHARAT_HEAVY_ELECTRICALS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Bharat Heavy Electricals', 'bharatheavyelectricals', 'Bharat Heavy Electricals']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Bharat Heavy Electricals'), false)
})
