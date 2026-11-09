import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/rnftechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/rnftechnologies/catalog.js')
  } catch {
    assert.fail('Expected RNF Technologies catalog module at ../../scraper/rnftechnologies/catalog.js')
  }
}

test('RNF Technologies local catalog captures the verified current openings table and detail pages', async () => {
  const { RNF_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(RNF_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, RNF_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'rnftechnologies')
  assert.equal(provider.companyName, 'RNF Technologies')
  assert.equal(provider.officialBrandName, 'RNF Technologies')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://rnftechnologies.com/join-our-team')
  assert.equal(
    provider.companyCareerPage,
    'https://rnftechnologies.com/join-our-team/current-openings',
  )
  assert.equal(provider.companyDomain, 'rnftechnologies.com')
  assert.equal(provider.atsPlatform, 'official-first-party-job-table-plus-detail-pages')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-current-openings-page')
  assert.equal(provider.extractionStrategy, 'complete-current-role-cards+jsonld-details+legacy-job-table')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-09-13')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /rnftechnologies[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /September 13, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /seven current role cards/i)
  assert.match(provider.verifiedSurfaceSummary, /matching ItemList count/i)
  assert.match(provider.verifiedSurfaceSummary, /exact-employer JobPosting/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'RNF Technologies'), false)
})

test('RNF Technologies exact backlog row matches from the local catalog entry', async () => {
  const { RNF_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'RNF Technologies\n',
    catalog: [hydrateProviderCatalogEntry(RNF_TECHNOLOGIES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['RNF Technologies', 'rnftechnologies', 'RNF Technologies']],
  )
})

test('RNF Technologies hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { RNF_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(RNF_TECHNOLOGIES_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(
    provider.companyCareerPage,
    'https://rnftechnologies.com/join-our-team/current-openings',
  )
  assert.equal(provider.companyDomain, 'rnftechnologies.com')
  assert.match(provider.modulePath, /rnftechnologies[\\/]script\.js$/i)
  assert.equal(typeof module.run, 'function')
})
