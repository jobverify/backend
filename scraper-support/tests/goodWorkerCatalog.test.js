import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/goodworker/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/goodworker/catalog.js')
  } catch {
    assert.fail('Expected GoodWorker catalog module at ../../scraper/goodworker/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/goodworker/script.js')
  } catch {
    assert.fail('Expected GoodWorker scraper module at ../../scraper/goodworker/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('GoodWorker local catalog captures the verified first-party timeout-only surface without a trustworthy public jobs page', async () => {
  const { GOODWORKER_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const goodWorker = await loadScriptModule()
  const provider = buildCatalogReadyProvider(GOODWORKER_CATALOG)

  assert.equal(defaultCatalog, GOODWORKER_CATALOG)
  assert.equal(provider.source, 'goodworker')
  assert.equal(provider.companyName, 'GoodWorker')
  assert.equal(provider.officialBrandName, 'GoodWorker')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://goodworker.in/')
  assert.equal(provider.companyCareerPage, 'https://goodworker.in/careers')
  assert.deepEqual(provider.firstPartyTimeoutUrls, [
    'https://goodworker.in/',
    'https://goodworker.in/careers',
  ])
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-exact-name-first-party-timeout-routes-skip')
  assert.equal(
    provider.extractionStrategy,
    'verified-exact-name-first-party-routes-timeout-without-public-jobs-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'goodworker.in')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/goodworker\.in\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/goodworker\.in\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /timed out/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /goodworker[\\/]jobs\.json$/i)

  assert.equal(goodWorker.PROVIDER_METADATA.source, provider.source)
  assert.equal(goodWorker.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(goodWorker.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('GoodWorker exact backlog row resolves from the local provider contract without alias churn', async () => {
  const { GOODWORKER_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'GoodWorker\n',
    catalog: [buildCatalogReadyProvider(GOODWORKER_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['GoodWorker', 'goodworker', 'GoodWorker']],
  )
})
