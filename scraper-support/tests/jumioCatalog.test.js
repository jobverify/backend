import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const jumioModulePath = path.resolve(currentDir, '../../scraper/jumio/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/jumio/catalog.js')
  } catch {
    assert.fail('Expected Jumio catalog module at ../../scraper/jumio/catalog.js')
  }
}

const loadJumioModule = async () => {
  try {
    return await import('../../scraper/jumio/script.js')
  } catch {
    assert.fail('Expected Jumio scraper module at ../../scraper/jumio/script.js')
  }
}

test('Jumio local catalog captures the verified first-party openings page and jobs API without aliases', async () => {
  const { JUMIO_CATALOG } = await loadCatalogModule()
  const jumio = await loadJumioModule()
  const provider = hydrateProviderCatalogEntry(JUMIO_CATALOG)

  assert.equal(provider.source, 'jumio')
  assert.equal(provider.companyName, 'Jumio')
  assert.equal(provider.officialBrandName, 'Jumio')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.jumio.com/careers/job-listings/')
  assert.equal(provider.jobsApiUrl, 'https://www.jumio.com/wp-json/jobs/filter')
  assert.equal(provider.greenhouseBoardUrl, 'https://job-boards.greenhouse.io/jumio')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-jobs-api-response')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-job-listings-page+wp-json-jobs-filter+greenhouse-public-detail-urls+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'jumio.com')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.dryRunFile, /jumio[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.jumio\.com\/careers\/job-listings\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.jumio\.com\/wp-json\/jobs\/filter/i)
  assert.match(provider.verifiedSurfaceSummary, /DevOps Engineer IV \(Obs\)/i)
  assert.match(provider.verifiedSurfaceSummary, /SDE III - MLOps/i)
  assert.equal(provider.modulePath, jumioModulePath)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Jumio'), false)

  assert.equal(jumio.PROVIDER_METADATA.source, JUMIO_CATALOG.source)
  assert.equal(jumio.PROVIDER_METADATA.companyName, JUMIO_CATALOG.companyName)
  assert.equal(jumio.PROVIDER_METADATA.jobsApiUrl, JUMIO_CATALOG.jobsApiUrl)
})

test('Jumio backlog row matches directly from the local catalog without alias churn', async () => {
  const { JUMIO_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Jumio\n',
    catalog: [hydrateProviderCatalogEntry(JUMIO_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Jumio', 'jumio', 'Jumio']],
  )
})
