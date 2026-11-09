import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/fedorasolutions/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/fedorasolutions/catalog.js')
  } catch {
    assert.fail('Expected Fedora Solutions catalog module at ../../scraper/fedorasolutions/catalog.js')
  }
}

test('Fedora Solutions local catalog captures the verified email-only careers surface', async () => {
  const { FEDORA_SOLUTIONS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(FEDORA_SOLUTIONS_CATALOG)

  assert.equal(defaultCatalog, FEDORA_SOLUTIONS_CATALOG)
  assert.equal(provider.source, 'fedorasolutions')
  assert.equal(provider.companyName, 'Fedora Solutions')
  assert.equal(provider.officialBrandName, 'Fedora Healthcare Solutions')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.ifedora.com/careers/')
  assert.equal(provider.officialCareersPageUrl, 'https://www.ifedora.com/careers/')
  assert.equal(provider.companyDomain, 'ifedora.com')
  assert.equal(provider.contactPageUrl, 'https://www.ifedora.com/contact-in/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'careers-plus-contact-page-validation')
  assert.equal(provider.extractionStrategy, 'verified-first-party-careers-page+resume-email-only-return-empty')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /fedorasolutions[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /recruitment@ifedora\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Fedora Solutions'), false)
})

test('Fedora Solutions exact backlog row matches from the local catalog entry', async () => {
  const { FEDORA_SOLUTIONS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Fedora Solutions\n',
    catalog: [hydrateProviderCatalogEntry(FEDORA_SOLUTIONS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Fedora Solutions', 'fedorasolutions', 'Fedora Solutions']],
  )
})

test('Fedora Solutions hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { FEDORA_SOLUTIONS_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(FEDORA_SOLUTIONS_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.ifedora.com/careers/')
  assert.equal(provider.companyDomain, 'ifedora.com')
  assert.match(provider.modulePath, /fedorasolutions[\\/]script\.js$/i)
  assert.equal(typeof module.run, 'function')
})
