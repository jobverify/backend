import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/innoplexus/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/innoplexus/catalog.js')
  } catch {
    assert.fail('Expected Innoplexus catalog module at ../../scraper/innoplexus/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/innoplexus/script.js')
  } catch {
    assert.fail('Expected Innoplexus scraper module at ../../scraper/innoplexus/script.js')
  }
}

test('Innoplexus local catalog captures the verified careers redirect and embedded public openings array', async () => {
  const { INNOPLEXUS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const innoplexus = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(INNOPLEXUS_CATALOG)

  assert.equal(defaultCatalog, INNOPLEXUS_CATALOG)
  assert.equal(provider.source, 'innoplexus')
  assert.equal(provider.companyName, 'Innoplexus')
  assert.equal(provider.officialBrandName, 'Partex.AI')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.innoplexus.com/')
  assert.equal(provider.companyCareerPage, 'https://www.innoplexus.com/careers')
  assert.equal(provider.redirectedCareersPageUrl, 'https://partex.ai/en/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-with-embedded-job-array')
  assert.equal(
    provider.extractionStrategy,
    'innoplexus-careers-redirect+embedded-open-positions-array',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'innoplexus.com')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.innoplexus\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/partex\.ai\/en\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /AVP\/VP\/Sr\. VP\.\s*[–-]\s*Business Development/i)
  assert.match(provider.verifiedSurfaceSummary, /AI Engineer/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /innoplexus[\\/]jobs\.json$/i)

  assert.equal(innoplexus.PROVIDER_METADATA.source, provider.source)
  assert.equal(innoplexus.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(
    innoplexus.PROVIDER_METADATA.redirectedCareersPageUrl,
    provider.redirectedCareersPageUrl,
  )
})

test('Innoplexus coverage resolves the backlog company row without alias churn', async () => {
  const { INNOPLEXUS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Innoplexus\n',
    catalog: [hydrateProviderCatalogEntry(INNOPLEXUS_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Innoplexus', 'innoplexus', 'Innoplexus']],
  )
})
