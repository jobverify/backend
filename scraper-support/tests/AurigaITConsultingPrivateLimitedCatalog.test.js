import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/aurigaitconsultingprivatelimited/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/aurigaitconsultingprivatelimited/catalog.js')
  } catch {
    assert.fail('Expected Auriga IT Consulting Private Limited catalog module at ../../scraper/aurigaitconsultingprivatelimited/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/aurigaitconsultingprivatelimited/script.js')
  } catch {
    assert.fail('Expected Auriga IT Consulting Private Limited scraper module at ../../scraper/aurigaitconsultingprivatelimited/script.js')
  }
}

test('Auriga IT Consulting Private Limited local catalog captures the verified first-party shell and Keka handoff', async () => {
  const { AURIGA_IT_CONSULTING_PRIVATE_LIMITED_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const auriga = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(AURIGA_IT_CONSULTING_PRIVATE_LIMITED_CATALOG)

  assert.equal(defaultCatalog, AURIGA_IT_CONSULTING_PRIVATE_LIMITED_CATALOG)
  assert.equal(provider.source, 'aurigaitconsultingprivatelimited')
  assert.equal(provider.companyName, 'Auriga IT Consulting Private Limited')
  assert.equal(provider.officialBrandName, 'Auriga')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://aurigait.com/')
  assert.equal(provider.companyCareerPage, 'https://aurigait.com/careers/')
  assert.equal(provider.externalHandoffUrl, 'https://aurigait.keka.com/careers')
  assert.equal(provider.companyDomain, 'aurigait.com')
  assert.equal(provider.atsPlatform, 'keka-embed-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'first-party-careers-page-plus-single-keka-active-jobs-endpoint')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-keka-handoff+embedded-khConfig-or-bootstrapped-careerportal-document+active-keka-embed-api+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-01')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Find Job Openings/i)
  assert.match(provider.verifiedSurfaceSummary, /aurigait\.keka\.com/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Auriga IT Consulting Private Limited'), false)

  assert.equal(auriga.PROVIDER_METADATA.source, AURIGA_IT_CONSULTING_PRIVATE_LIMITED_CATALOG.source)
  assert.equal(auriga.PROVIDER_METADATA.externalHandoffUrl, AURIGA_IT_CONSULTING_PRIVATE_LIMITED_CATALOG.externalHandoffUrl)
})

test('Auriga IT Consulting Private Limited exact backlog row resolves from the local provider contract', async () => {
  const { AURIGA_IT_CONSULTING_PRIVATE_LIMITED_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Auriga IT Consulting Private Limited\n',
    catalog: [hydrateProviderCatalogEntry(AURIGA_IT_CONSULTING_PRIVATE_LIMITED_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Auriga IT Consulting Private Limited', 'aurigaitconsultingprivatelimited', 'Auriga IT Consulting Private Limited']],
  )
})
