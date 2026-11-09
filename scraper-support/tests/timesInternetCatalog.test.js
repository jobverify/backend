import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/timesinternet/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/timesinternet/catalog.js')
  } catch {
    assert.fail('Expected Times Internet catalog module at ../../scraper/timesinternet/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/timesinternet/script.js')
  } catch {
    assert.fail('Expected Times Internet scraper module at ../../scraper/timesinternet/script.js')
  }
}

test('Times Internet local catalog captures the verified first-party listing page and detail pages', async () => {
  const { TIMES_INTERNET_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const timesInternet = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(TIMES_INTERNET_CATALOG)

  assert.equal(defaultCatalog, TIMES_INTERNET_CATALOG)
  assert.equal(provider.source, 'timesinternet')
  assert.equal(provider.companyName, 'Times Internet')
  assert.equal(provider.officialBrandName, 'Times Internet')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://timesinternet.in/careers/job-list')
  assert.equal(provider.officialCareersPageUrl, 'https://timesinternet.in/careers/job-list')
  assert.deepEqual(provider.verifiedJobDetailUrls, [
    'https://timesinternet.in/careers/job-detail/6abb601846c5d2b24a35bd82',
    'https://timesinternet.in/careers/job-detail/644b66c280bea7e80b7a229d',
  ])
  assert.equal(provider.companyDomain, 'timesinternet.in')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-job-list-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-job-list+same-domain-detail-pages',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.match(provider.dryRunFile, /timesinternet[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /October 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /10 current roles/i)
  assert.match(provider.verifiedSurfaceSummary, /unstructured job description/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Times Internet'), false)

  assert.equal(timesInternet.PROVIDER_METADATA.source, TIMES_INTERNET_CATALOG.source)
  assert.equal(timesInternet.PROVIDER_METADATA.companyName, TIMES_INTERNET_CATALOG.companyName)
})

test('Times Internet exact backlog row matches directly from the local provider metadata', async () => {
  const { TIMES_INTERNET_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Times Internet\n',
    catalog: [hydrateProviderCatalogEntry(TIMES_INTERNET_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Times Internet', 'timesinternet', 'Times Internet']],
  )
})

test('Times Internet hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { TIMES_INTERNET_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(TIMES_INTERNET_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Times Internet')
  assert.equal(provider.companyCareerPage, 'https://timesinternet.in/careers/job-list')
  assert.equal(provider.companyDomain, 'timesinternet.in')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.match(provider.modulePath, /timesinternet[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /timesinternet[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
