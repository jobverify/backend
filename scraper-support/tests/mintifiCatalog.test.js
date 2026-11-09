import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const mintifiModulePath = path.resolve(currentDir, '../../scraper/mintifi/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/mintifi/catalog.js')
  } catch {
    assert.fail('Expected Mintifi catalog module at ../../scraper/mintifi/catalog.js')
  }
}

const loadMintifiModule = async () => {
  try {
    return await import('../../scraper/mintifi/script.js')
  } catch {
    assert.fail('Expected Mintifi scraper module at ../../scraper/mintifi/script.js')
  }
}

test('Mintifi local catalog captures the verified first-party careers page and embedded Keka jobs surface', async () => {
  const { MINTIFI_CATALOG } = await loadCatalogModule()
  const mintifi = await loadMintifiModule()
  const provider = hydrateProviderCatalogEntry(MINTIFI_CATALOG)

  assert.equal(provider.source, 'mintifi')
  assert.equal(provider.companyName, 'Mintifi')
  assert.equal(provider.officialBrandName, 'Mintifi')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://mintifi.com/careers')
  assert.equal(provider.officialHomepageUrl, 'https://mintifi.com/')
  assert.equal(provider.kekaCareerPageUrl, 'https://mintifi.keka.com/careers/')
  assert.equal(
    provider.kekaCareerPortalInfoUrl,
    'https://mintifi.keka.com/careers/api/organization/default/careerportalinfo',
  )
  assert.equal(
    provider.kekaActiveJobsUrl,
    'https://mintifi.keka.com/careers/api/embedjobs/default/active/0bdc40eb-1cda-4070-83e9-cd5c222a6399',
  )
  assert.equal(provider.expectedKekaIdentifier, '0bdc40eb-1cda-4070-83e9-cd5c222a6399')
  assert.equal(provider.expectedKekaDomain, 'https://mintifi.keka.com/careers/')
  assert.equal(provider.expectedPortalName, 'Mintifi')
  assert.equal(provider.atsPlatform, 'keka-embed-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'first-party-careers-page-plus-single-keka-active-jobs-endpoint')
  assert.equal(
    provider.extractionStrategy,
    'current-first-party-Keka-configuration+declared-renderer+native-account+full-active-records+all-typed-India-placements',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'mintifi.com')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.dryRunFile, /mintifi[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/mintifi\.com\/careers/i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/mintifi\.keka\.com\/careers\/api\/organization\/default\/careerportalinfo/i,
  )
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/mintifi\.keka\.com\/careers\/api\/embedjobs\/default\/active\/0bdc40eb-1cda-4070-83e9-cd5c222a6399/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /Sales Manager - Retail/i)
  assert.match(provider.verifiedSurfaceSummary, /Compliance Manager/i)
  assert.match(provider.verifiedSurfaceSummary, /Internal Audit Intern/i)
  assert.equal(provider.modulePath, mintifiModulePath)

  assert.equal(mintifi.PROVIDER_METADATA.source, MINTIFI_CATALOG.source)
  assert.equal(mintifi.PROVIDER_METADATA.companyName, MINTIFI_CATALOG.companyName)
  assert.equal(mintifi.PROVIDER_METADATA.kekaActiveJobsUrl, MINTIFI_CATALOG.kekaActiveJobsUrl)
})

test('Mintifi backlog row matches directly from the local catalog without alias changes', async () => {
  const { MINTIFI_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Mintifi\n',
    catalog: [hydrateProviderCatalogEntry(MINTIFI_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Mintifi', 'mintifi', 'Mintifi']],
  )
})
