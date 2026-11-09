import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/brainiuminformationtechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/brainiuminformationtechnologies/catalog.js')
  } catch {
    assert.fail('Expected Brainium Information Technologies catalog module at ../../scraper/brainiuminformationtechnologies/catalog.js')
  }
}

test('Brainium Information Technologies local catalog captures the verified first-party open roles surface', async () => {
  const { BRAINIUM_INFORMATION_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(BRAINIUM_INFORMATION_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, BRAINIUM_INFORMATION_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'brainiuminformationtechnologies')
  assert.equal(provider.companyName, 'Brainium Information Technologies')
  assert.equal(provider.officialBrandName, 'Brainium Information Technologies Pvt Ltd')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.brainiuminfotech.com/careers')
  assert.equal(provider.officialCareersPageUrl, 'https://www.brainiuminfotech.com/careers')
  assert.equal(provider.companyDomain, 'brainiuminfotech.com')
  assert.equal(provider.atsPlatform, 'first-party-html-open-roles')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'legacy-public-page-unverified-stop-on-access-denial')
  assert.equal(
    provider.extractionStrategy,
    'legacy-first-party-cards-unverified-access-denial-is-not-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-10-27')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /brainiuminformationtechnologies[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /October 27, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /HTTP 403/i)
  assert.match(provider.verifiedSurfaceSummary, /cannot establish empty inventory/i)
  assert.equal(companyAliases.Brainium, 'brainiuminformationtechnologies')
})

test('Brainium Information Technologies exact backlog row matches from the local catalog entry', async () => {
  const { BRAINIUM_INFORMATION_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Brainium Information Technologies\n',
    catalog: [hydrateProviderCatalogEntry(BRAINIUM_INFORMATION_TECHNOLOGIES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Brainium Information Technologies', 'brainiuminformationtechnologies', 'Brainium Information Technologies']],
  )
})

test('Brainium Information Technologies hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { BRAINIUM_INFORMATION_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(BRAINIUM_INFORMATION_TECHNOLOGIES_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.brainiuminfotech.com/careers')
  assert.equal(provider.companyDomain, 'brainiuminfotech.com')
  assert.match(provider.modulePath, /brainiuminformationtechnologies[\\/]script\.js$/i)
  assert.equal(typeof module.run, 'function')
})
