import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const logiNextModulePath = path.resolve(currentDir, '../../scraper/loginext/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/loginext/catalog.js')
  } catch {
    assert.fail('Expected LogiNext catalog module at ../../scraper/loginext/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/loginext/script.js')
  } catch {
    assert.fail('Expected LogiNext scraper module at ../../scraper/loginext/script.js')
  }
}

test('LogiNext local catalog captures the verified first-party Next.js jobs page and embedded Recruiterbox role links', async () => {
  const { LOGINEXT_CATALOG } = await loadCatalogModule()
  const logiNext = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(LOGINEXT_CATALOG)

  assert.equal(provider.source, 'loginext')
  assert.equal(provider.companyName, 'LogiNext')
  assert.equal(provider.officialBrandName, 'LogiNext')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.loginextsolutions.com/job-roles')
  assert.equal(provider.jobsBoardUrl, 'https://www.loginextsolutions.com/job-roles')
  assert.equal(provider.companyDomain, 'loginextsolutions.com')
  assert.equal(provider.atsPlatform, 'first-party-nextjs-page-with-recruiterbox-links')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-nextjs-job-roles-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-nextjs-flight-data+embedded-role-arrays+recruiterbox-apply-links',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.dryRunFile, /loginext[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, logiNextModulePath)
  assert.match(provider.verifiedSurfaceSummary, /July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.loginextsolutions\.com\/job-roles/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/loginext\.hire\.trakstar\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/loginext\.recruiterbox\.com\/jobs\//i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'LogiNext'), false)

  assert.equal(logiNext.PROVIDER_METADATA.source, LOGINEXT_CATALOG.source)
  assert.equal(logiNext.PROVIDER_METADATA.companyName, LOGINEXT_CATALOG.companyName)
  assert.equal(logiNext.PROVIDER_METADATA.jobsBoardUrl, LOGINEXT_CATALOG.jobsBoardUrl)
})

test('LogiNext backlog row matches directly from the local catalog without alias churn', async () => {
  const { LOGINEXT_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'LogiNext\n',
    catalog: [hydrateProviderCatalogEntry(LOGINEXT_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['LogiNext', 'loginext', 'LogiNext']],
  )
})
