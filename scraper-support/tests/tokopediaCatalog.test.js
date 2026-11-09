import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/tokopedia/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/tokopedia/catalog.js')
  } catch {
    assert.fail('Expected Tokopedia catalog module at ../../scraper/tokopedia/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/tokopedia/script.js')
  } catch {
    assert.fail('Expected Tokopedia scraper module at ../../scraper/tokopedia/script.js')
  }
}

test('Tokopedia local catalog captures the verified GoTo reference and opaque Darwinbox sentinel without alias churn', async () => {
  const { TOKOPEDIA_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const tokopedia = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(TOKOPEDIA_CATALOG)

  assert.equal(defaultCatalog, TOKOPEDIA_CATALOG)
  assert.equal(provider.source, 'tokopedia')
  assert.equal(provider.companyName, 'Tokopedia')
  assert.equal(provider.officialBrandName, 'Tokopedia')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.gotocompany.com/careers')
  assert.equal(
    provider.officialCareersReferenceUrl,
    'https://www.gotocompany.com/en/news/press/goto-group-fake-job-listings',
  )
  assert.equal(provider.officialCareersHandoffUrl, 'https://tokopedia.darwinbox.com/ms/candidate/careers')
  assert.equal(provider.companyDomain, 'tokopedia.com')
  assert.equal(provider.atsPlatform, 'shared-parent-careers-darwinbox-shell-unverifiable')
  assert.equal(provider.countryFilter, 'Indonesia')
  assert.equal(
    provider.paginationStrategy,
    'verified-goto-careers-plus-authorized-darwinbox-shell-no-verifiable-public-board',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-goto-careers-page+verified-tokopedia-authorized-handoff+verified-opaque-darwinbox-shell+fail-closed-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-06')
  assert.match(provider.dryRunFile, /tokopedia[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, August 6, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.gotocompany\.com\/careers/i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/www\.gotocompany\.com\/en\/news\/press\/goto-group-fake-job-listings/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/tokopedia\.darwinbox\.com\/ms\/candidate\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /JavaScript bootstrap shell/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Tokopedia'), false)

  assert.equal(tokopedia.PROVIDER_METADATA.source, TOKOPEDIA_CATALOG.source)
  assert.equal(tokopedia.PROVIDER_METADATA.companyName, TOKOPEDIA_CATALOG.companyName)
})

test('Tokopedia exact backlog row matches directly from the local provider metadata', async () => {
  const { TOKOPEDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Tokopedia\n',
    catalog: [hydrateProviderCatalogEntry(TOKOPEDIA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Tokopedia', 'tokopedia', 'Tokopedia']],
  )
})

test('Tokopedia hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { TOKOPEDIA_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(TOKOPEDIA_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Tokopedia')
  assert.equal(provider.companyCareerPage, 'https://www.gotocompany.com/careers')
  assert.equal(provider.companyDomain, 'tokopedia.com')
  assert.equal(provider.atsPlatform, 'shared-parent-careers-darwinbox-shell-unverifiable')
  assert.match(provider.modulePath, /tokopedia[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /tokopedia[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
