import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const guru99ModulePath = path.resolve(currentDir, '../../scraper/guru99/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/guru99/catalog.js')
  } catch {
    assert.fail('Expected Guru99 catalog module at ../../scraper/guru99/catalog.js')
  }
}

const loadGuru99Module = async () => {
  try {
    return await import('../../scraper/guru99/script.js')
  } catch {
    assert.fail('Expected Guru99 scraper module at ../../scraper/guru99/script.js')
  }
}

test('Guru99 local catalog captures the verified first-party content surfaces without a public recruiting board', async () => {
  const { GURU99_CATALOG } = await loadCatalogModule()
  const guru99 = await loadGuru99Module()
  const provider = hydrateProviderCatalogEntry(GURU99_CATALOG)

  assert.equal(provider.source, 'guru99')
  assert.equal(provider.companyName, 'Guru99')
  assert.equal(provider.officialBrandName, 'Guru99')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.guru99.com/')
  assert.equal(provider.companyCareerPage, 'https://www.guru99.com/about-us')
  assert.equal(provider.contactPageUrl, 'https://www.guru99.com/contact-us')
  assert.equal(provider.termsUrl, 'https://www.guru99.com/terms-of-service')
  assert.equal(provider.careerContentSiteUrl, 'https://career.guru99.com/')
  assert.equal(provider.companyDomain, 'guru99.com')
  assert.equal(provider.atsPlatform, 'official-content-site-no-public-jobs')
  assert.equal(
    provider.paginationStrategy,
    'verified-first-party-about-contact-terms-plus-career-content-microsite',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-company-identity-pages+verified-career-content-microsite-without-employer-jobs-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.guru99\.com\/about-us/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.guru99\.com\/contact-us/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.guru99\.com\/terms-of-service/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/career\.guru99\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /Contribute a Tutorial/i)
  assert.match(provider.verifiedSurfaceSummary, /Interview Question Library/i)
  assert.equal(provider.modulePath, guru99ModulePath)
  assert.match(provider.dryRunFile, /guru99[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Guru99'), false)

  assert.equal(guru99.PROVIDER_METADATA.source, GURU99_CATALOG.source)
  assert.equal(guru99.PROVIDER_METADATA.companyCareerPage, GURU99_CATALOG.companyCareerPage)
  assert.equal(guru99.PROVIDER_METADATA.careerContentSiteUrl, GURU99_CATALOG.careerContentSiteUrl)
})

test('Guru99 backlog row matches directly from local provider metadata without alias churn', async () => {
  const { GURU99_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Guru99\n',
    catalog: [hydrateProviderCatalogEntry(GURU99_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Guru99', 'guru99', 'Guru99']],
  )
})
