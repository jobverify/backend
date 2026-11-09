import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/omprimetechnologyprivatelimited/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/omprimetechnologyprivatelimited/catalog.js')
  } catch {
    assert.fail('Expected Omprime Technology Private Limited catalog module at ../../scraper/omprimetechnologyprivatelimited/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/omprimetechnologyprivatelimited/script.js')
  } catch {
    assert.fail('Expected Omprime Technology Private Limited scraper module at ../../scraper/omprimetechnologyprivatelimited/script.js')
  }
}

test('Omprime Technology Private Limited local catalog captures the verified first-party careers page', async () => {
  const { OMPRIME_TECHNOLOGY_PRIVATE_LIMITED_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const omprime = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(OMPRIME_TECHNOLOGY_PRIVATE_LIMITED_CATALOG)

  assert.equal(defaultCatalog, OMPRIME_TECHNOLOGY_PRIVATE_LIMITED_CATALOG)
  assert.equal(provider.source, 'omprimetechnologyprivatelimited')
  assert.equal(provider.companyName, 'Omprime Technology Private Limited')
  assert.equal(provider.officialBrandName, 'OMPRIME')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://omprime.com/')
  assert.equal(provider.companyCareerPage, 'https://omprime.com/careers/')
  assert.equal(provider.companyDomain, 'omprime.com')
  assert.equal(provider.atsPlatform, 'official-first-party-careers-page')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+jobs-list-links+non-india-region-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Customer Support – Chat/i)
  assert.match(provider.verifiedSurfaceSummary, /Choose Region/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Omprime Technology Private Limited'), false)

  assert.equal(omprime.PROVIDER_METADATA.source, OMPRIME_TECHNOLOGY_PRIVATE_LIMITED_CATALOG.source)
  assert.equal(omprime.PROVIDER_METADATA.companyCareerPage, OMPRIME_TECHNOLOGY_PRIVATE_LIMITED_CATALOG.companyCareerPage)
})

test('Omprime Technology Private Limited exact backlog row resolves from the local provider contract', async () => {
  const { OMPRIME_TECHNOLOGY_PRIVATE_LIMITED_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Omprime Technology Private Limited\n',
    catalog: [hydrateProviderCatalogEntry(OMPRIME_TECHNOLOGY_PRIVATE_LIMITED_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Omprime Technology Private Limited', 'omprimetechnologyprivatelimited', 'Omprime Technology Private Limited']],
  )
})
