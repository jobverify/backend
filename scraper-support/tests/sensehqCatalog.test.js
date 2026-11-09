import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const expectedModulePath = path.resolve(currentDir, '../../scraper/sensehq/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/sensehq/catalog.js')
  } catch {
    assert.fail('Expected SenseHQ catalog module at ../../scraper/sensehq/catalog.js')
  }
}

test('SenseHQ local catalog captures the verified first-party SenseHQ board without alias churn', async () => {
  const { SENSEHQ_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SENSEHQ_CATALOG)

  assert.equal(defaultCatalog, SENSEHQ_CATALOG)
  assert.equal(provider.source, 'sensehq')
  assert.equal(provider.companyName, 'SenseHQ')
  assert.equal(provider.officialBrandName, 'Sense HQ')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.sensehq.com/')
  assert.equal(provider.companyCareerPage, 'https://www.sensehq.com/careers')
  assert.equal(provider.verifiedJobsPageUrl, 'https://sensehr.sensehq.com/careers')
  assert.equal(provider.sampleJobUrl, 'https://sensehr.sensehq.com/careers/jobs/217')
  assert.equal(provider.companyDomain, 'sensehq.com')
  assert.equal(provider.atsPlatform, 'sensehq')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.jobsDataSource, '__NEXT_DATA__.props.pageProps.jobsData.rows')
  assert.equal(
    provider.paginationStrategy,
    'verified-sensehq-board-next-data-rows-root-page-only',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-sensehq-next-data-rows+open-job-filter+india-country-filter+first-party-detail-url-build',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-04')
  assert.match(provider.dryRunFile, /sensehq[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, expectedModulePath)
  assert.match(provider.verifiedSurfaceSummary, /Tuesday, August 4, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.sensehq\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/sensehr\.sensehq\.com\/careers\/js\/sense-career-inject\.js/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/sensehr\.sensehq\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /\b10 open India roles\b/i)
  assert.match(provider.verifiedSurfaceSummary, /jobsData\.rows/i)
  assert.match(provider.verifiedSurfaceSummary, /DevOps Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /Lead Software Engineer II - Backend/i)
  assert.match(provider.verifiedSurfaceSummary, /count 11/i)
  assert.match(provider.verifiedSurfaceSummary, /page=2/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'SenseHQ'), false)
})

test('SenseHQ exact backlog row matches directly from the local provider metadata', async () => {
  const { SENSEHQ_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'SenseHQ\n',
    catalog: [hydrateProviderCatalogEntry(SENSEHQ_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['SenseHQ', 'sensehq', 'SenseHQ']],
  )
})

test('SenseHQ hydrated local catalog stays script-runner compatible for later shared-registry integration', async () => {
  const { SENSEHQ_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SENSEHQ_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'SenseHQ')
  assert.equal(provider.companyCareerPage, 'https://www.sensehq.com/careers')
  assert.equal(provider.companyDomain, 'sensehq.com')
  assert.equal(provider.atsPlatform, 'sensehq')
  assert.match(provider.modulePath, /sensehq[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /sensehq[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
