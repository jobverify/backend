import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/payu/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/payu/catalog.js')
  } catch {
    assert.fail('Expected PayU catalog module at ../../scraper/payu/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/payu/script.js')
  } catch {
    assert.fail('Expected PayU scraper module at ../../scraper/payu/script.js')
  }
}

test('PayU local catalog captures the verified India careers handoff and no-India global board state', async () => {
  const { PAYU_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const payu = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(PAYU_CATALOG)

  assert.equal(defaultCatalog, PAYU_CATALOG)
  assert.equal(provider.source, 'payu')
  assert.equal(provider.companyName, 'PayU')
  assert.equal(provider.officialBrandName, 'PayU India')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://corporate.payu.in/')
  assert.equal(provider.companyCareerPage, 'https://corporate.payu.in/careers/')
  assert.equal(provider.globalJobBoardUrl, 'https://corporate.payu.com/job-board/')
  assert.equal(provider.companyDomain, 'corporate.payu.in')
  assert.equal(provider.atsPlatform, 'official-careers-global-board-no-india-jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'official-india-careers-page-plus-global-job-board-no-india-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-india-careers-page+verified-global-job-board+verified-no-india-locations-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.equal(provider.verifiedGlobalJobCount, 16)
  assert.match(provider.dryRunFile, /payu[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/corporate\.payu\.in\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/corporate\.payu\.com\/job-board\//i)
  assert.match(provider.verifiedSurfaceSummary, /16 of 16 positions/i)
  assert.match(provider.verifiedSurfaceSummary, /no India locations published/i)

  assert.equal(payu.PROVIDER_METADATA.source, PAYU_CATALOG.source)
  assert.equal(payu.PROVIDER_METADATA.companyName, PAYU_CATALOG.companyName)
  assert.equal(payu.PROVIDER_METADATA.companyCareerPage, PAYU_CATALOG.companyCareerPage)
  assert.equal(payu.PROVIDER_METADATA.globalJobBoardUrl, PAYU_CATALOG.globalJobBoardUrl)
})

test('PayU exact backlog name matches directly from local provider metadata', async () => {
  const { PAYU_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'PayU\n',
    catalog: [hydrateProviderCatalogEntry(PAYU_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['PayU', 'payu', 'PayU']],
  )
})

test('PayU hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { PAYU_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(PAYU_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'PayU')
  assert.equal(provider.companyCareerPage, 'https://corporate.payu.in/careers/')
  assert.equal(provider.companyDomain, 'corporate.payu.in')
  assert.equal(provider.atsPlatform, 'official-careers-global-board-no-india-jobs')
  assert.match(provider.modulePath, /payu[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /payu[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
