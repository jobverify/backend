import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const kuveraModulePath = path.resolve(currentDir, '../../scraper/kuvera/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/kuvera/catalog.js')
  } catch {
    assert.fail('Expected Kuvera catalog module at ../../scraper/kuvera/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/kuvera/script.js')
  } catch {
    assert.fail('Expected Kuvera scraper module at ../../scraper/kuvera/script.js')
  }
}

test('Kuvera local catalog captures the verified resume-only first-party hiring surface without alias churn', async () => {
  const { KUVERA_CATALOG } = await loadCatalogModule()
  const kuvera = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(KUVERA_CATALOG)

  assert.equal(provider.source, 'kuvera')
  assert.equal(provider.companyName, 'Kuvera')
  assert.equal(provider.officialBrandName, 'Kuvera by CRED')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://kuvera.in/')
  assert.equal(provider.companyCareerPage, 'https://kuvera.in/about')
  assert.equal(provider.officialResumeSubmissionEmail, 'jobs@kuvera.in')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-first-party-about-page-resume-email-handoff',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-about-page+resume-email-handoff-without-public-listings-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'kuvera.in')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.dryRunFile, /kuvera[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, kuveraModulePath)
  assert.match(provider.verifiedSurfaceSummary, /July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/kuvera\.in\/about/i)
  assert.match(provider.verifiedSurfaceSummary, /jobs@kuvera\.in/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Kuvera'), false)

  assert.equal(kuvera.PROVIDER_METADATA.source, KUVERA_CATALOG.source)
  assert.equal(kuvera.PROVIDER_METADATA.companyName, KUVERA_CATALOG.companyName)
  assert.equal(
    kuvera.PROVIDER_METADATA.officialResumeSubmissionEmail,
    KUVERA_CATALOG.officialResumeSubmissionEmail,
  )
})

test('Kuvera backlog row matches directly from the local catalog without alias churn', async () => {
  const { KUVERA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Kuvera\n',
    catalog: [hydrateProviderCatalogEntry(KUVERA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Kuvera', 'kuvera', 'Kuvera']],
  )
})
