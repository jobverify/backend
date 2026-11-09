import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/einfochips.workday/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/einfochips.workday/catalog.js')
  } catch {
    assert.fail('Expected eInfochips catalog module at ../../scraper/einfochips.workday/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/einfochips.workday/script.js')
  } catch {
    assert.fail('Expected eInfochips scraper module at ../../scraper/einfochips.workday/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('eInfochips local catalog captures the verified first-party careers handoff and Arrow Workday India facet surface', async () => {
  const { EINFOCHIPS_CATALOG } = await loadCatalogModule()
  const einfochips = await loadScraperModule()
  const provider = buildCatalogReadyProvider(EINFOCHIPS_CATALOG)

  assert.equal(provider.source, 'einfochips')
  assert.equal(provider.companyName, 'eInfochips')
  assert.equal(provider.officialBrandName, 'eInfochips')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.einfochips.com/')
  assert.equal(provider.companyCareerPage, 'https://www.einfochips.com/careers/')
  assert.equal(
    provider.officialArrowSearchUrl,
    'https://careers.arrow.com/us/en/search-results?keywords=einfochips',
  )
  assert.equal(provider.officialWorkdayBoardUrl, 'https://arrow.wd1.myworkdayjobs.com/AC')
  assert.equal(
    provider.jobsApiUrl,
    'https://arrow.wd1.myworkdayjobs.com/wday/cxs/arrow/AC/jobs',
  )
  assert.equal(provider.verifiedKeyword, 'einfochips')
  assert.equal(provider.verifiedIndiaCountryFacetDescriptor, 'India')
  assert.equal(
    provider.verifiedIndiaCountryFacetId,
    'c4f78be1a8f14da0ab49ce1162348a5e',
  )
  assert.equal(
    provider.verifiedIndiaJobUrl,
    'https://arrow.wd1.myworkdayjobs.com/AC/job/Ahmedabad-India/Senior-Engineer--Level-1---Data-Engineer_R232449',
  )
  assert.equal(
    provider.verifiedIndiaApplyUrl,
    'https://arrow.wd1.myworkdayjobs.com/AC/job/Ahmedabad-India/Senior-Engineer--Level-1---Data-Engineer_R232449/apply',
  )
  assert.equal(provider.companyDomain, 'einfochips.com')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-careers-handoff-plus-keyworded-workday-country-facet',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-einfochips-careers-page+verified-arrow-search-page+verified-arrow-workday-board+keyworded-workday-jobs-api+india-country-facet',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.einfochips\.com\/careers\//i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/careers\.arrow\.com\/us\/en\/search-results\?keywords=einfochips/i,
  )
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/arrow\.wd1\.myworkdayjobs\.com\/AC/i,
  )
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/arrow\.wd1\.myworkdayjobs\.com\/wday\/cxs\/arrow\/AC\/jobs/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /\b33 India roles\b/i)
  assert.match(provider.verifiedSurfaceSummary, /c4f78be1a8f14da0ab49ce1162348a5e/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior-Engineer--Level-1---Data-Engineer_R232449/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /einfochips.workday[\\/]jobs\.json$/i)

  assert.equal(einfochips.PROVIDER_METADATA.source, provider.source)
  assert.equal(einfochips.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(einfochips.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.equal(einfochips.PROVIDER_METADATA.jobsApiUrl, provider.jobsApiUrl)
})

test('eInfochips exact backlog name matches from the local provider contract without aliases', async () => {
  const { EINFOCHIPS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'eInfochips\n',
    catalog: [buildCatalogReadyProvider(EINFOCHIPS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['eInfochips', 'einfochips', 'eInfochips']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'eInfochips'), false)
})
