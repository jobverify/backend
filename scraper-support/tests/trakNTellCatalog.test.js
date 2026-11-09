import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/trakntell/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/trakntell/catalog.js')
  } catch {
    assert.fail('Expected Trak N Tell catalog module at ../../scraper/trakntell/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/trakntell/script.js')
  } catch {
    assert.fail('Expected Trak N Tell scraper module at ../../scraper/trakntell/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Trak N Tell local catalog captures the verified September 3 product and contact surfaces without a public jobs page', async () => {
  const { TRAK_N_TELL_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const trakNTell = await loadScriptModule()
  const provider = buildCatalogReadyProvider(TRAK_N_TELL_CATALOG)

  assert.equal(defaultCatalog, TRAK_N_TELL_CATALOG)
  assert.equal(provider.source, 'trakntell')
  assert.equal(provider.companyName, 'Trak N Tell')
  assert.equal(provider.officialBrandName, 'Trak N Tell')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.trakntell.com/')
  assert.equal(provider.companyCareerPage, 'https://www.trakntell.com/')
  assert.equal(provider.contactPageUrl, 'https://www.trakntell.com/contact-us/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-first-party-homepage-plus-product-contact-page-without-public-jobs-skip',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-homepage+verified-contact-page-without-public-jobs-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'trakntell.com')
  assert.equal(provider.verifiedOn, '2026-09-03')
  assert.match(provider.verifiedSurfaceSummary, /September 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.trakntell\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.trakntell\.com\/contact-us\//i)
  assert.match(provider.verifiedSurfaceSummary, /Experience India's 1st OEM GPS Vehicle Tracker/i)
  assert.match(provider.verifiedSurfaceSummary, /care@trakntell\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /8010-80-8010/i)
  assert.match(provider.verifiedSurfaceSummary, /Gurugram/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /trakntell[\\/]jobs\.json$/i)

  assert.equal(trakNTell.PROVIDER_METADATA.source, provider.source)
  assert.equal(trakNTell.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(trakNTell.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('Trak N Tell exact backlog row resolves from the local provider contract without alias churn', async () => {
  const { TRAK_N_TELL_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Trak N Tell\n',
    catalog: [buildCatalogReadyProvider(TRAK_N_TELL_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Trak N Tell', 'trakntell', 'Trak N Tell']],
  )
})
