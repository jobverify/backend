import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const getMyUniModulePath = path.resolve(currentDir, '../../scraper/getmyuni/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/getmyuni/catalog.js')
  } catch {
    assert.fail('Expected GetMyUni catalog module at ../../scraper/getmyuni/catalog.js')
  }
}

const loadGetMyUniModule = async () => {
  try {
    return await import('../../scraper/getmyuni/script.js')
  } catch {
    assert.fail('Expected GetMyUni scraper module at ../../scraper/getmyuni/script.js')
  }
}

test('GetMyUni local catalog captures the verified contact-us empty-state sentinel without aliases on July 25, 2026', async () => {
  const { GET_MY_UNI_CATALOG } = await loadCatalogModule()
  const getMyUni = await loadGetMyUniModule()
  const provider = hydrateProviderCatalogEntry(GET_MY_UNI_CATALOG)

  assert.equal(provider.source, 'getmyuni')
  assert.equal(provider.companyName, 'GetMyUni')
  assert.equal(provider.officialBrandName, 'GetMyUni')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.getmyuni.com/contact-us')
  assert.equal(provider.officialHomepageUrl, 'https://www.getmyuni.com/')
  assert.equal(provider.contactUsUrl, 'https://www.getmyuni.com/contact-us')
  assert.equal(provider.informationalCareersUrl, 'https://www.getmyuni.com/careers')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-homepage-plus-contact-us-plus-informational-careers-return-empty',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-brand-homepage+verified-work-with-us-contact-page+verified-informational-careers-page-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'getmyuni.com')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.match(provider.dryRunFile, /getmyuni[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.getmyuni\.com\/contact-us/i)
  assert.match(provider.verifiedSurfaceSummary, /contact@getmyuni\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.getmyuni\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs/i)
  assert.equal(provider.modulePath, getMyUniModulePath)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'GetMyUni'), false)

  assert.equal(getMyUni.PROVIDER_METADATA.source, GET_MY_UNI_CATALOG.source)
  assert.equal(getMyUni.PROVIDER_METADATA.companyName, GET_MY_UNI_CATALOG.companyName)
  assert.equal(getMyUni.PROVIDER_METADATA.contactUsUrl, GET_MY_UNI_CATALOG.contactUsUrl)
})

test('GetMyUni backlog row matches directly from the local catalog without alias churn', async () => {
  const { GET_MY_UNI_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'GetMyUni\n',
    catalog: [hydrateProviderCatalogEntry(GET_MY_UNI_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['GetMyUni', 'getmyuni', 'GetMyUni']],
  )
})

test('getScraperCatalog includes GetMyUni as a verified no-public-jobs provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'getmyuni')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'GetMyUni')
  assert.equal(provider.companyCareerPage, 'https://www.getmyuni.com/contact-us')
  assert.equal(provider.companyDomain, 'getmyuni.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /getmyuni[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable GetMyUni scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'getmyuni')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'getmyuni')
  assert.equal(scraper.provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(scraper.dryRunFile, /getmyuni[\\/]jobs\.json$/i)
})
