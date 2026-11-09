import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/finolexcables/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/finolexcables/catalog.js')
  } catch {
    assert.fail('Expected Finolex Cables catalog module at ../../scraper/finolexcables/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/finolexcables/script.js')
  } catch {
    assert.fail('Expected Finolex Cables scraper module at ../../scraper/finolexcables/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Finolex Cables local catalog captures the verified first-party careers surface', async () => {
  const { FINOLEX_CABLES_CATALOG } = await loadCatalogModule()
  const finolex = await loadScraperModule()
  const provider = buildCatalogReadyProvider(FINOLEX_CABLES_CATALOG)

  assert.equal(provider.source, 'finolexcables')
  assert.equal(provider.companyName, 'Finolex Cables')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.finolex.com/')
  assert.equal(provider.homepageCareersLinkUrl, 'https://www.finolex.com/View/Page/Career')
  assert.equal(provider.companyCareerPage, 'https://www.finolex.com/Team/Career')
  assert.equal(provider.checkedLoginCareersRouteUrl, 'https://www.finolex.com/careers')
  assert.equal(provider.companyDomain, 'finolex.com')
  assert.equal(provider.atsPlatform, 'official-company-html-table')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-table-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-finolex-homepage-careers-link+verified-first-party-careers-table-row+verified-inline-apply-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.finolex\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.finolex\.com\/View\/Page\/Career/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.finolex\.com\/Team\/Career/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.finolex\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /Polymer Compounding Engineer \(Production\)/i)
  assert.match(provider.verifiedSurfaceSummary, /Application Form/i)
  assert.match(provider.verifiedSurfaceSummary, /hr@finolex\.com/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /finolexcables[\\/]jobs\.json$/i)

  assert.equal(finolex.PROVIDER_METADATA.source, provider.source)
  assert.equal(finolex.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(finolex.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.equal(finolex.PROVIDER_METADATA.homepageCareersLinkUrl, provider.homepageCareersLinkUrl)
})

test('Finolex Cables exact backlog row matches from the local provider contract without aliases', async () => {
  const { FINOLEX_CABLES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Finolex Cables\n',
    catalog: [buildCatalogReadyProvider(FINOLEX_CABLES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Finolex Cables', 'finolexcables', 'Finolex Cables']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Finolex Cables'), false)
})
