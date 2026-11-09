import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/kaseyaindia/catalog.js')
  } catch {
    assert.fail('Expected Kaseya India catalog module at ../../scraper/kaseyaindia/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/kaseyaindia/script.js')
  } catch {
    assert.fail('Expected Kaseya India scraper module at ../../scraper/kaseyaindia/script.js')
  }
}

test('Kaseya India local catalog captures the verified first-party careers page plus Greenhouse contract', async () => {
  const { KASEYA_INDIA_CATALOG } = await loadCatalogModule()
  const kaseyaIndia = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(KASEYA_INDIA_CATALOG)

  assert.equal(KASEYA_INDIA_CATALOG.source, 'kaseyaindia')
  assert.equal(KASEYA_INDIA_CATALOG.companyName, 'Kaseya India')
  assert.equal(KASEYA_INDIA_CATALOG.officialBrandName, 'Kaseya')
  assert.equal(KASEYA_INDIA_CATALOG.adapter, 'script')
  assert.equal(KASEYA_INDIA_CATALOG.modulePath, '../../scraper/kaseyaindia/script.js')
  assert.equal(KASEYA_INDIA_CATALOG.dryRunFile, 'kaseyaindia/jobs.json')
  assert.equal(KASEYA_INDIA_CATALOG.homepageUrl, 'https://www.kaseya.com/careers/jobs/')
  assert.equal(KASEYA_INDIA_CATALOG.companyCareerPage, 'https://www.kaseya.com/careers/jobs/')
  assert.equal(
    KASEYA_INDIA_CATALOG.greenhouseEmbedScriptUrl,
    'https://boards.greenhouse.io/embed/job_board/js?for=kaseya',
  )
  assert.equal(
    KASEYA_INDIA_CATALOG.greenhouseJobsApiUrl,
    'https://boards-api.greenhouse.io/v1/boards/kaseya/jobs',
  )
  assert.equal(
    KASEYA_INDIA_CATALOG.verifiedSampleJobUrl,
    'https://www.kaseya.com/careers/jobs/id/6015830004/',
  )
  assert.equal(KASEYA_INDIA_CATALOG.companyDomain, 'kaseya.com')
  assert.equal(KASEYA_INDIA_CATALOG.atsPlatform, 'greenhouse')
  assert.equal(KASEYA_INDIA_CATALOG.countryFilter, 'India')
  assert.equal(
    KASEYA_INDIA_CATALOG.paginationStrategy,
    'verified-first-party-careers-page-plus-greenhouse-api',
  )
  assert.equal(
    KASEYA_INDIA_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+greenhouse-api+first-party-detail-urls',
  )
  assert.equal(KASEYA_INDIA_CATALOG.parser, 'custom-script')
  assert.equal(KASEYA_INDIA_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(KASEYA_INDIA_CATALOG.verifiedPublicJobCount, 261)
  assert.equal(KASEYA_INDIA_CATALOG.verifiedOn, '2026-08-04')
  assert.match(KASEYA_INDIA_CATALOG.verifiedSurfaceSummary, /Tuesday, August 4, 2026/i)
  assert.match(KASEYA_INDIA_CATALOG.verifiedSurfaceSummary, /kaseya\.com\/careers\/jobs/i)
  assert.match(KASEYA_INDIA_CATALOG.verifiedSurfaceSummary, /boards\.greenhouse\.io\/embed\/job_board\/js\?for=kaseya/i)
  assert.match(KASEYA_INDIA_CATALOG.verifiedSurfaceSummary, /boards-api\.greenhouse\.io\/v1\/boards\/kaseya\/jobs\?content=true/i)
  assert.match(KASEYA_INDIA_CATALOG.verifiedSurfaceSummary, /\bPune\b/i)
  assert.match(KASEYA_INDIA_CATALOG.verifiedSurfaceSummary, /\bBangalore\b/i)
  assert.match(KASEYA_INDIA_CATALOG.verifiedSurfaceSummary, /Remote India/i)

  assert.equal(provider.source, 'kaseyaindia')
  assert.equal(provider.companyName, 'Kaseya India')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.kaseya.com/careers/jobs/')
  assert.equal(provider.companyDomain, 'kaseya.com')
  assert.match(provider.modulePath, /kaseyaindia[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /kaseyaindia[\\/]jobs\.json$/i)

  assert.equal(kaseyaIndia.PROVIDER_METADATA.source, provider.source)
  assert.equal(kaseyaIndia.CAREERS_URL, provider.companyCareerPage)
  assert.equal(kaseyaIndia.GREENHOUSE_EMBED_URL, provider.greenhouseEmbedScriptUrl)
  assert.equal(kaseyaIndia.GREENHOUSE_JOBS_API_URL, provider.greenhouseJobsApiUrl)
})

test('Kaseya India exact-name backlog rows resolve directly from local metadata without a shared alias', async () => {
  const { KASEYA_INDIA_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Kaseya India\n',
    catalog: [hydrateProviderCatalogEntry(KASEYA_INDIA_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Kaseya India', 'kaseyaindia', 'Kaseya India']],
  )
})
