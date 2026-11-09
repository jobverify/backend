import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/tcgdigitalsolutions/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/tcgdigitalsolutions/catalog.js')
  } catch {
    assert.fail('Expected TCG Digital Solutions catalog module at ../../scraper/tcgdigitalsolutions/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/tcgdigitalsolutions/script.js')
  } catch {
    assert.fail('Expected TCG Digital Solutions scraper module at ../../scraper/tcgdigitalsolutions/script.js')
  }
}

test('TCG Digital Solutions local catalog captures the verified first-party careers page', async () => {
  const { TCG_DIGITAL_SOLUTIONS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const tcg = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(TCG_DIGITAL_SOLUTIONS_CATALOG)

  assert.equal(defaultCatalog, TCG_DIGITAL_SOLUTIONS_CATALOG)
  assert.equal(provider.source, 'tcgdigitalsolutions')
  assert.equal(provider.companyName, 'Tcg Digital Solutions')
  assert.equal(provider.officialBrandName, 'TCG Digital')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.tcgdigital.com/')
  assert.equal(provider.companyCareerPage, 'https://www.tcgdigital.com/careers/')
  assert.equal(provider.companyDomain, 'tcgdigital.com')
  assert.equal(provider.atsPlatform, 'official-first-party-careers-page')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+repeating-openings-sections+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /AI Product Manager \/ Product Owner/i)
  assert.match(provider.verifiedSurfaceSummary, /Pune \(Hybrid\)/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Tcg Digital Solutions'), false)

  assert.equal(tcg.PROVIDER_METADATA.source, TCG_DIGITAL_SOLUTIONS_CATALOG.source)
  assert.equal(tcg.PROVIDER_METADATA.companyCareerPage, TCG_DIGITAL_SOLUTIONS_CATALOG.companyCareerPage)
})

test('Tcg Digital Solutions exact backlog row resolves from the local provider contract', async () => {
  const { TCG_DIGITAL_SOLUTIONS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Tcg Digital Solutions\n',
    catalog: [hydrateProviderCatalogEntry(TCG_DIGITAL_SOLUTIONS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Tcg Digital Solutions', 'tcgdigitalsolutions', 'Tcg Digital Solutions']],
  )
})
