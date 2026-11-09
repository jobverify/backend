import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const mairfinModulePath = path.resolve(currentDir, '../../scraper/mairfin/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/mairfin/catalog.js')
  } catch {
    assert.fail('Expected Mairfin catalog module at ../../scraper/mairfin/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/mairfin/script.js')
  } catch {
    assert.fail('Expected Mairfin scraper module at ../../scraper/mairfin/script.js')
  }
}

test('Mairfin local catalog captures the fail-closed exact-name domain sentinel metadata without alias churn', async () => {
  const { MAIRFIN_CATALOG } = await loadCatalogModule()
  const mairfin = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(MAIRFIN_CATALOG)

  assert.equal(provider.source, 'mairfin')
  assert.equal(provider.companyName, 'Mairfin')
  assert.equal(provider.officialBrandName, 'Mairfin')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://mairfin.com/')
  assert.equal(provider.homepageUrl, 'https://mairfin.com/')
  assert.equal(provider.companyDomain, 'mairfin.com')
  assert.equal(provider.atsPlatform, 'exact-name-domains-unresolvable-or-untrusted')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'candidate-exact-name-domain-resolution-and-trust-validation')
  assert.equal(
    provider.extractionStrategy,
    'exact-name-first-party-domain-candidates-unresolvable-or-untrusted-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.deepEqual(provider.candidateFirstPartyUrls, [
    'https://mairfin.com/',
    'https://www.mairfin.com/',
    'https://mairfin.in/',
    'https://www.mairfin.in/',
  ])
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/mairfin\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.mairfin\.in\//i)
  assert.match(provider.verifiedSurfaceSummary, /Could not resolve host/i)
  assert.match(provider.verifiedSurfaceSummary, /trust relationship/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.match(provider.dryRunFile, /mairfin[\\/]jobs\.json$/i)
  assert.match(provider.modulePath, /mairfin[\\/]script\.js$/i)
  assert.equal(provider.modulePath, mairfinModulePath)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Mairfin'), false)

  assert.equal(mairfin.PROVIDER_METADATA.source, MAIRFIN_CATALOG.source)
  assert.deepEqual(mairfin.CANDIDATE_FIRST_PARTY_URLS, MAIRFIN_CATALOG.candidateFirstPartyUrls)
})

test('Mairfin backlog row matches directly from local provider metadata without alias churn', async () => {
  const { MAIRFIN_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Mairfin\n',
    catalog: [hydrateProviderCatalogEntry(MAIRFIN_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Mairfin', 'mairfin', 'Mairfin']],
  )
})
