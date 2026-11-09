import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/shoreinfotechindia/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/shoreinfotechindia/catalog.js')
  } catch {
    assert.fail('Expected Shore Infotech India catalog module at ../../scraper/shoreinfotechindia/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/shoreinfotechindia/script.js')
  } catch {
    assert.fail('Expected Shore Infotech India scraper module at ../../scraper/shoreinfotechindia/script.js')
  }
}

test('Shore Infotech India local catalog captures the verified no-public-careers surface', async () => {
  const { SHORE_INFOTECH_INDIA_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const shore = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(SHORE_INFOTECH_INDIA_CATALOG)

  assert.equal(defaultCatalog, SHORE_INFOTECH_INDIA_CATALOG)
  assert.equal(provider.source, 'shoreinfotechindia')
  assert.equal(provider.companyName, 'Shore Infotech India')
  assert.equal(provider.officialBrandName, 'Shore Group')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.shoregrp.com/')
  assert.equal(provider.companyDomain, 'shoregrp.com')
  assert.equal(provider.contactPageUrl, 'https://www.shoregrp.com/contact')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-contact-plus-common-careers-route-validation')
  assert.equal(provider.extractionStrategy, 'verified-homepage+verified-contact-page+verified-missing-careers-routes-return-empty')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-10-09')
  assert.match(provider.dryRunFile, /shoreinfotechindia[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /shoregrp\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /Shore Infotech India/i)
  assert.match(provider.verifiedSurfaceSummary, /2026-10-09/i)
  assert.match(provider.verifiedSurfaceSummary, /\/contact/i)
  assert.match(provider.verifiedSurfaceSummary, /discovery-only.*incomplete inventory.*unknown vacancy counts/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Shore Infotech India'), false)

  assert.equal(shore.PROVIDER_METADATA.source, SHORE_INFOTECH_INDIA_CATALOG.source)
  assert.equal(shore.PROVIDER_METADATA.companyName, SHORE_INFOTECH_INDIA_CATALOG.companyName)
})

test('Shore Infotech India exact backlog row matches directly from local provider metadata', async () => {
  const { SHORE_INFOTECH_INDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Shore Infotech India\n',
    catalog: [hydrateProviderCatalogEntry(SHORE_INFOTECH_INDIA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Shore Infotech India', 'shoreinfotechindia', 'Shore Infotech India']],
  )
})

test('Shore Infotech India hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { SHORE_INFOTECH_INDIA_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SHORE_INFOTECH_INDIA_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Shore Infotech India')
  assert.equal(provider.companyCareerPage, 'https://www.shoregrp.com/')
  assert.equal(provider.companyDomain, 'shoregrp.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /shoreinfotechindia[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /shoreinfotechindia[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
