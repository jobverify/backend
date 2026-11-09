import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/greyorange/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/greyorange/catalog.js')
  } catch {
    assert.fail('Expected GreyOrange catalog module at ../../scraper/greyorange/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/greyorange/script.js')
  } catch {
    assert.fail('Expected GreyOrange scraper module at ../../scraper/greyorange/script.js')
  }
}

test('GreyOrange local catalog captures the verified first-party careers site and public Zwayam jobs surface', async () => {
  const { GREYORANGE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const greyorange = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(GREYORANGE_CATALOG)

  assert.equal(defaultCatalog, GREYORANGE_CATALOG)
  assert.equal(provider.source, 'greyorange')
  assert.equal(provider.companyName, 'GreyOrange')
  assert.equal(provider.officialBrandName, 'GreyOrange')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://careers.greyorange.com/greyorange/')
  assert.equal(provider.officialCareersPageUrl, 'https://careers.greyorange.com/greyorange/')
  assert.equal(
    provider.zwayamCompanyConfigUrl,
    'https://public.zwayam.com/data-service/v2/company/16090/careersite-configurations',
  )
  assert.equal(provider.zwayamSearchUrl, 'https://public.zwayam.com/jobs/search')
  assert.equal(
    provider.zwayamJobDetailUrl,
    'https://public.zwayam.com/jobs-service/v1/jobs/careersite',
  )
  assert.equal(provider.publicJobBaseUrl, 'https://careers.greyorange.com/greyorange/jobview')
  assert.equal(provider.sampleJobUrl, 'https://careers.greyorange.com/greyorange/jobview/senior-engineer-solution-qa-gurugram-hq-2026052710320963')
  assert.equal(provider.companyDomain, 'greyorange.com')
  assert.equal(provider.atsPlatform, 'zwayam')
  assert.equal(provider.paginationStrategy, 'zwayam-search-api-with-detail-fetch')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-zwayam-company-config+zwayam-search-api+zwayam-detail-api+public-jobview-urls',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.equal(provider.verifiedJobCount, 84)
  assert.match(provider.dryRunFile, /greyorange[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.greyorange\.com\/greyorange\//i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/public\.zwayam\.com\/data-service\/v2\/company\/16090\/careersite-configurations/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/public\.zwayam\.com\/jobs\/search/i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/public\.zwayam\.com\/jobs-service\/v1\/jobs\/careersite/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /\b84 public jobs\b/i)
  assert.match(provider.verifiedSurfaceSummary, /Software Development Engineer in Test II/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'GreyOrange'), false)

  assert.equal(greyorange.PROVIDER_METADATA.source, GREYORANGE_CATALOG.source)
  assert.equal(greyorange.PROVIDER_METADATA.companyName, GREYORANGE_CATALOG.companyName)
  assert.equal(
    greyorange.PROVIDER_METADATA.zwayamSearchUrl,
    GREYORANGE_CATALOG.zwayamSearchUrl,
  )
})

test('GreyOrange exact backlog row matches directly from local provider metadata', async () => {
  const { GREYORANGE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'GreyOrange\n',
    catalog: [hydrateProviderCatalogEntry(GREYORANGE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['GreyOrange', 'greyorange', 'GreyOrange']],
  )
})

test('GreyOrange hydrated local catalog stays script-runner compatible for later shared-registry integration', async () => {
  const { GREYORANGE_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(GREYORANGE_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'GreyOrange')
  assert.equal(provider.companyCareerPage, 'https://careers.greyorange.com/greyorange/')
  assert.equal(provider.companyDomain, 'greyorange.com')
  assert.equal(provider.atsPlatform, 'zwayam')
  assert.match(provider.modulePath, /greyorange[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /greyorange[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
