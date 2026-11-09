import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const lybrateModulePath = path.resolve(currentDir, '../../scraper/lybrate/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/lybrate/catalog.js')
  } catch {
    assert.fail('Expected Lybrate catalog module at ../../scraper/lybrate/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/lybrate/script.js')
  } catch {
    assert.fail('Expected Lybrate scraper module at ../../scraper/lybrate/script.js')
  }
}

test('Lybrate local catalog captures the verified stale first-party jobs shell and dead embedded API state', async () => {
  const { LYBRATE_CATALOG } = await loadCatalogModule()
  const lybrate = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(LYBRATE_CATALOG)

  assert.equal(LYBRATE_CATALOG.source, 'lybrate')
  assert.equal(LYBRATE_CATALOG.companyName, 'Lybrate')
  assert.equal(LYBRATE_CATALOG.officialBrandName, 'Lybrate')
  assert.equal(LYBRATE_CATALOG.adapter, 'script')
  assert.equal(LYBRATE_CATALOG.modulePath, lybrateModulePath)
  assert.equal(LYBRATE_CATALOG.dryRunFile, 'lybrate/jobs.json')
  assert.equal(LYBRATE_CATALOG.homepageUrl, 'https://www.lybrate.com/')
  assert.equal(LYBRATE_CATALOG.jobsPageUrl, 'https://www.lybrate.com/jobs')
  assert.equal(LYBRATE_CATALOG.aboutPageUrl, 'https://www.lybrate.com/about')
  assert.equal(
    LYBRATE_CATALOG.embeddedJobsApiUrl,
    'https://api.lever.co/v0/postings/lybrate?group=team&mode=json',
  )
  assert.equal(LYBRATE_CATALOG.companyDomain, 'lybrate.com')
  assert.equal(LYBRATE_CATALOG.atsPlatform, 'official-jobs-page-with-dead-embedded-api')
  assert.equal(LYBRATE_CATALOG.countryFilter, 'India')
  assert.equal(LYBRATE_CATALOG.paginationStrategy, 'stale-first-party-jobs-shell-validation')
  assert.equal(
    LYBRATE_CATALOG.extractionStrategy,
    'verified-first-party-jobs-page+dead-embedded-api+return-empty',
  )
  assert.equal(LYBRATE_CATALOG.parser, 'custom-script')
  assert.equal(LYBRATE_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(LYBRATE_CATALOG.verifiedOn, '2026-08-04')
  assert.equal(LYBRATE_CATALOG.verifiedPublicPostingCount, 0)
  assert.match(LYBRATE_CATALOG.verifiedSurfaceSummary, /Tuesday, August 4, 2026/i)
  assert.match(LYBRATE_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.lybrate\.com\/jobs/i)
  assert.match(LYBRATE_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.lybrate\.com\/about/i)
  assert.match(LYBRATE_CATALOG.verifiedSurfaceSummary, /api\.lever\.co\/v0\/postings\/lybrate/i)
  assert.match(LYBRATE_CATALOG.verifiedSurfaceSummary, /HTTP 301/i)
  assert.match(LYBRATE_CATALOG.verifiedSurfaceSummary, /HTTP 308/i)
  assert.match(LYBRATE_CATALOG.verifiedSurfaceSummary, /redirect loop/i)
  assert.match(LYBRATE_CATALOG.verifiedSurfaceSummary, /Document not found/i)

  assert.equal(provider.source, 'lybrate')
  assert.equal(provider.companyName, 'Lybrate')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyDomain, 'lybrate.com')
  assert.match(provider.modulePath, /lybrate[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /lybrate[\\/]jobs\.json$/i)

  assert.equal(lybrate.PROVIDER_METADATA.source, provider.source)
  assert.equal(lybrate.PROVIDER_METADATA.embeddedJobsApiUrl, LYBRATE_CATALOG.embeddedJobsApiUrl)
})

test('Lybrate exact-name backlog rows resolve directly from local provider metadata without aliases', async () => {
  const { LYBRATE_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Lybrate\n',
    catalog: [hydrateProviderCatalogEntry(LYBRATE_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Lybrate', 'lybrate', 'Lybrate']],
  )
})
