import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/aurigo/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/aurigo/catalog.js')
  } catch {
    assert.fail('Expected Aurigo Software Technologies catalog module at ../../scraper/aurigo/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/aurigo/script.js')
  } catch {
    assert.fail('Expected Aurigo Software Technologies scraper module at ../../scraper/aurigo/script.js')
  }
}

test('Aurigo Software Technologies local catalog captures the verified first-party jobs search surface', async () => {
  const { AURIGO_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const aurigo = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(AURIGO_CATALOG)

  assert.equal(defaultCatalog, AURIGO_CATALOG)
  assert.equal(provider.source, 'aurigo')
  assert.equal(provider.companyName, 'Aurigo Software Technologies')
  assert.equal(provider.officialBrandName, 'Aurigo Software Technologies')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.aurigo.com/')
  assert.equal(provider.companyCareerPage, 'https://careers.aurigo.com/')
  assert.equal(
    provider.searchResultsUrl,
    'https://careers.aurigo.com/search/?locale=en_US&previewLink=true&referrerSave=false&searchResultView=LIST',
  )
  assert.equal(provider.companyDomain, 'aurigo.com')
  assert.equal(provider.atsPlatform, 'official-first-party-search-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'api-page-number')
  assert.equal(provider.extractionStrategy, 'jobs2web-search-shell+first-party-jobs-api')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-01')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /aurigo[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /August 1, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /services\/recruiting\/v1\/jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /Director of Product/i)
  assert.match(provider.verifiedSurfaceSummary, /Software Engineer II/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Aurigo Software Technologies'), false)

  assert.equal(aurigo.PROVIDER_METADATA.source, AURIGO_CATALOG.source)
  assert.equal(aurigo.PROVIDER_METADATA.searchResultsUrl, AURIGO_CATALOG.searchResultsUrl)
})

test('Aurigo Software Technologies exact backlog row resolves from the local provider contract', async () => {
  const { AURIGO_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Aurigo Software Technologies\n',
    catalog: [hydrateProviderCatalogEntry(AURIGO_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aurigo Software Technologies', 'aurigo', 'Aurigo Software Technologies']],
  )
})
