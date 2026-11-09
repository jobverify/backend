import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/quboleindia/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/quboleindia/catalog.js')
  } catch {
    assert.fail('Expected Qubole India catalog module at ../../scraper/quboleindia/catalog.js')
  }
}

test('Qubole India local catalog captures the verified first-party self-looping careers sentinel surface', async () => {
  const { QUBOLE_INDIA_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(QUBOLE_INDIA_CATALOG)

  assert.equal(defaultCatalog, QUBOLE_INDIA_CATALOG)
  assert.equal(provider.source, 'quboleindia')
  assert.equal(provider.companyName, 'Qubole India')
  assert.equal(provider.officialBrandName, 'Qubole')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.qubole.com/')
  assert.equal(provider.companyCareerPage, 'https://www.qubole.com/company/careers')
  assert.equal(provider.verifiedOpenPositionsUrl, 'https://www.qubole.com/company/careers')
  assert.equal(provider.companyDomain, 'qubole.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-self-looping-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+self-looping-open-positions-cta+no-public-listings-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /quboleindia[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.qubole\.com\/company\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /View Open Positions/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Qubole India'), false)
})

test('Qubole India backlog row matches directly from the local catalog without alias churn', async () => {
  const { QUBOLE_INDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Qubole India\n',
    catalog: [hydrateProviderCatalogEntry(QUBOLE_INDIA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Qubole India', 'quboleindia', 'Qubole India']],
  )
})

test('Qubole India hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { QUBOLE_INDIA_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(QUBOLE_INDIA_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Qubole India')
  assert.equal(provider.companyCareerPage, 'https://www.qubole.com/company/careers')
  assert.equal(provider.companyDomain, 'qubole.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /quboleindia[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /quboleindia[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
