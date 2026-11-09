import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/tranisticsdatatechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/tranisticsdatatechnologies/catalog.js')
  } catch {
    assert.fail('Expected Tranistics Data Technologies catalog module at ../../scraper/tranisticsdatatechnologies/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/tranisticsdatatechnologies/script.js')
  } catch {
    assert.fail('Expected Tranistics Data Technologies scraper module at ../../scraper/tranisticsdatatechnologies/script.js')
  }
}

test('Tranistics Data Technologies local catalog captures the verified no-public-careers surface', async () => {
  const { TRANISTICS_DATA_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const tranistics = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(TRANISTICS_DATA_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, TRANISTICS_DATA_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'tranisticsdatatechnologies')
  assert.equal(provider.companyName, 'Tranistics Data Technologies')
  assert.equal(provider.officialBrandName, 'Tranistics Data Technologies')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.tranistics.com/')
  assert.equal(provider.companyDomain, 'tranistics.com')
  assert.equal(provider.contactPageUrl, 'https://www.tranistics.com/contact-us/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-contact-plus-common-careers-route-validation')
  assert.equal(provider.extractionStrategy, 'verified-homepage+verified-contact-page+verified-missing-careers-routes-return-empty')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /tranisticsdatatechnologies[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /tranistics\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public careers or jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Tranistics Data Technologies'), false)

  assert.equal(tranistics.PROVIDER_METADATA.source, TRANISTICS_DATA_TECHNOLOGIES_CATALOG.source)
  assert.equal(tranistics.PROVIDER_METADATA.companyName, TRANISTICS_DATA_TECHNOLOGIES_CATALOG.companyName)
})

test('Tranistics Data Technologies exact backlog row matches directly from local provider metadata', async () => {
  const { TRANISTICS_DATA_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Tranistics Data Technologies\n',
    catalog: [hydrateProviderCatalogEntry(TRANISTICS_DATA_TECHNOLOGIES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Tranistics Data Technologies', 'tranisticsdatatechnologies', 'Tranistics Data Technologies']],
  )
})

test('Tranistics Data Technologies hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { TRANISTICS_DATA_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(TRANISTICS_DATA_TECHNOLOGIES_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Tranistics Data Technologies')
  assert.equal(provider.companyCareerPage, 'https://www.tranistics.com/')
  assert.equal(provider.companyDomain, 'tranistics.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /tranisticsdatatechnologies[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /tranisticsdatatechnologies[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
