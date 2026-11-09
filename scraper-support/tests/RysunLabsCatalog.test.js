import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/rysunlabs/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/rysunlabs/catalog.js')
  } catch {
    assert.fail('Expected Rysun Labs catalog module at ../../scraper/rysunlabs/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/rysunlabs/script.js')
  } catch {
    assert.fail('Expected Rysun Labs scraper module at ../../scraper/rysunlabs/script.js')
  }
}

test('Rysun Labs local catalog captures the untrusted third-party CareerPlug-only state', async () => {
  const { RYSUN_LABS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const rysun = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(RYSUN_LABS_CATALOG)

  assert.equal(defaultCatalog, RYSUN_LABS_CATALOG)
  assert.equal(provider.source, 'rysunlabs')
  assert.equal(provider.companyName, 'Rysun Labs')
  assert.equal(provider.officialBrandName, 'Rysun Labs')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.rysun.com/')
  assert.equal(provider.companyCareerPage, 'https://www.rysun.com/')
  assert.equal(provider.observedPublicJobsUrl, 'https://rysun-labs-inc.careerplug.com/jobs?locale=en')
  assert.equal(provider.companyDomain, 'rysun.com')
  assert.equal(provider.atsPlatform, 'third-party-careerplug-untrusted')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'third-party-board-sentinel')
  assert.equal(
    provider.extractionStrategy,
    'verified-third-party-careerplug-board-without-first-party-jobs-surface-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /CareerPlug/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy first-party jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Rysun Labs'), false)

  assert.equal(rysun.PROVIDER_METADATA.source, RYSUN_LABS_CATALOG.source)
  assert.equal(rysun.PROVIDER_METADATA.observedPublicJobsUrl, RYSUN_LABS_CATALOG.observedPublicJobsUrl)
})

test('Rysun Labs exact backlog row resolves from the local provider contract', async () => {
  const { RYSUN_LABS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Rysun Labs\n',
    catalog: [hydrateProviderCatalogEntry(RYSUN_LABS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Rysun Labs', 'rysunlabs', 'Rysun Labs']],
  )
})
