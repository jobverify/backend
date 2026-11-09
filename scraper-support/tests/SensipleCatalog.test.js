import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/sensiple/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/sensiple/catalog.js')
  } catch {
    assert.fail('Expected Sensiple catalog module at ../../scraper/sensiple/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/sensiple/script.js')
  } catch {
    assert.fail('Expected Sensiple scraper module at ../../scraper/sensiple/script.js')
  }
}

test('Sensiple local catalog captures the verified first-party careers page and same-domain jobs AJAX payload', async () => {
  const { SENSIPLE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const sensiple = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(SENSIPLE_CATALOG)

  assert.equal(defaultCatalog, SENSIPLE_CATALOG)
  assert.equal(provider.source, 'sensiple')
  assert.equal(provider.companyName, 'Sensiple')
  assert.equal(provider.officialBrandName, 'Sensiple')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.sensiple.com/careers/')
  assert.equal(
    provider.jobsApiUrl,
    'https://www.sensiple.com/wp-admin/admin-ajax.php?action=get_jobs_secure',
  )
  assert.equal(provider.companyDomain, 'sensiple.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-admin-ajax-payload')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+same-domain-admin-ajax-jobs-payload',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /sensiple[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.sensiple\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /admin-ajax\.php\?action=get_jobs_secure/i)
  assert.match(provider.verifiedSurfaceSummary, /Business Development Executive/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Sensiple'), false)

  assert.equal(sensiple.PROVIDER_METADATA.source, SENSIPLE_CATALOG.source)
  assert.equal(sensiple.PROVIDER_METADATA.jobsApiUrl, SENSIPLE_CATALOG.jobsApiUrl)
})

test('Sensiple exact backlog row matches directly from local metadata without alias churn', async () => {
  const { SENSIPLE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Sensiple\n',
    catalog: [hydrateProviderCatalogEntry(SENSIPLE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Sensiple', 'sensiple', 'Sensiple']],
  )
})

test('Sensiple hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { SENSIPLE_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SENSIPLE_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Sensiple')
  assert.match(provider.modulePath, /sensiple[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /sensiple[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
