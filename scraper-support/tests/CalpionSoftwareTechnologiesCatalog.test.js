import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/calpionsoftwaretechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/calpionsoftwaretechnologies/catalog.js')
  } catch {
    assert.fail('Expected Calpion Software Technologies catalog module at ../../scraper/calpionsoftwaretechnologies/catalog.js')
  }
}

test('Calpion Software Technologies local catalog captures the verified first-party career-card listings page', async () => {
  const { CALPION_SOFTWARE_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(CALPION_SOFTWARE_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, CALPION_SOFTWARE_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'calpionsoftwaretechnologies')
  assert.equal(provider.companyName, 'Calpion Software Technologies')
  assert.equal(provider.officialBrandName, 'Calpion')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.calpion.com/')
  assert.equal(provider.companyCareerPage, 'https://www.calpion.com/career')
  assert.equal(provider.companyDomain, 'calpion.com')
  assert.equal(provider.atsPlatform, 'official-first-party-career-cards')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-career-page')
  assert.equal(provider.extractionStrategy, 'webflow-career-card-listing-plus-detail-pages')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-01')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /calpionsoftwaretechnologies[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, August 1, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Lead - Full Stack Software Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /AI\/ML Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /Quality Manager Medical Coding/i)
  assert.match(provider.verifiedSurfaceSummary, /Bengaluru\/Bangalore locations/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Calpion Software Technologies'), false)
})

test('Calpion Software Technologies exact backlog row matches from the local catalog entry', async () => {
  const { CALPION_SOFTWARE_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Calpion Software Technologies\n',
    catalog: [hydrateProviderCatalogEntry(CALPION_SOFTWARE_TECHNOLOGIES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[
      'Calpion Software Technologies',
      'calpionsoftwaretechnologies',
      'Calpion Software Technologies',
    ]],
  )
})

test('Calpion Software Technologies hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { CALPION_SOFTWARE_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(CALPION_SOFTWARE_TECHNOLOGIES_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.calpion.com/career')
  assert.equal(provider.companyDomain, 'calpion.com')
  assert.match(provider.modulePath, /calpionsoftwaretechnologies[\\/]script\.js$/i)
  assert.equal(typeof module.run, 'function')
})
