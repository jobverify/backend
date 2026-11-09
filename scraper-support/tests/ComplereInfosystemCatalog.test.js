import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/complereinfosystem/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/complereinfosystem/catalog.js')
  } catch {
    assert.fail('Expected Complere Infosystem catalog module at ../../scraper/complereinfosystem/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/complereinfosystem/script.js')
  } catch {
    assert.fail('Expected Complere Infosystem scraper module at ../../scraper/complereinfosystem/script.js')
  }
}

test('Complere Infosystem local catalog captures the verified first-party no-structured-openings page', async () => {
  const { COMPLERE_INFOSYSTEM_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const complere = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(COMPLERE_INFOSYSTEM_CATALOG)

  assert.equal(defaultCatalog, COMPLERE_INFOSYSTEM_CATALOG)
  assert.equal(provider.source, 'complereinfosystem')
  assert.equal(provider.companyName, 'Complere Infosystem')
  assert.equal(provider.officialBrandName, 'Complere Infosystem')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://complereinfosystem.com/career-opportunities')
  assert.equal(provider.officialCareersPageUrl, 'https://complereinfosystem.com/career-opportunities')
  assert.equal(provider.companyDomain, 'complereinfosystem.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-no-structured-openings')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-page')
  assert.equal(provider.extractionStrategy, 'verified-first-party-careers-page+email-only-openings-return-empty')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /complereinfosystem[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /career-opportunities/i)
  assert.match(provider.verifiedSurfaceSummary, /hr@complereinfosystem\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /no structured public job listings/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Complere Infosystem'), false)

  assert.equal(complere.PROVIDER_METADATA.source, COMPLERE_INFOSYSTEM_CATALOG.source)
  assert.equal(complere.PROVIDER_METADATA.companyName, COMPLERE_INFOSYSTEM_CATALOG.companyName)
})

test('Complere Infosystem exact backlog row matches directly from local provider metadata', async () => {
  const { COMPLERE_INFOSYSTEM_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Complere Infosystem\n',
    catalog: [hydrateProviderCatalogEntry(COMPLERE_INFOSYSTEM_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Complere Infosystem', 'complereinfosystem', 'Complere Infosystem']],
  )
})

test('Complere Infosystem hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { COMPLERE_INFOSYSTEM_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(COMPLERE_INFOSYSTEM_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Complere Infosystem')
  assert.equal(provider.companyCareerPage, 'https://complereinfosystem.com/career-opportunities')
  assert.equal(provider.companyDomain, 'complereinfosystem.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-no-structured-openings')
  assert.match(provider.modulePath, /complereinfosystem[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /complereinfosystem[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
