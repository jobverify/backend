import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/sarvagram/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/sarvagram/catalog.js')
  } catch {
    assert.fail('Expected SarvaGram catalog module at ../../scraper/sarvagram/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/sarvagram/script.js')
  } catch {
    assert.fail('Expected SarvaGram scraper module at ../../scraper/sarvagram/script.js')
  }
}

test('SarvaGram local catalog captures the verified public Zoho board metadata without alias churn', async () => {
  const { SARVAGRAM_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const sarvagram = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(SARVAGRAM_CATALOG)

  assert.equal(defaultCatalog, SARVAGRAM_CATALOG)
  assert.equal(provider.source, 'sarvagram')
  assert.equal(provider.companyName, 'SarvaGram')
  assert.equal(provider.officialBrandName, 'SarvaGram')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.sarvagram.com/')
  assert.equal(provider.aboutPageUrl, 'https://www.sarvagram.com/about-us/')
  assert.equal(provider.companyCareerPage, 'https://sarvagram.zohorecruit.in/jobs/Careers')
  assert.equal(provider.careersPortalUrl, 'https://sarvagram.zohorecruit.in/jobs/Careers')
  assert.equal(
    provider.careersApiUrl,
    'https://sarvagram.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(provider.careersDetailHost, 'sarvagram.zohorecruit.in')
  assert.equal(provider.companyDomain, 'sarvagram.com')
  assert.equal(provider.atsPlatform, 'zohorecruit')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'public-zohorecruit-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-zohorecruit-careers-portal+public-zohorecruit-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-04')
  assert.match(provider.dryRunFile, /sarvagram[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Tuesday, August 4, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.sarvagram\.com\/about-us\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/sarvagram\.zohorecruit\.in\/jobs\/Careers/i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/sarvagram\.zohorecruit\.in\/recruit\/v2\/public\/Job_Openings/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /Senior System Admin/i)
  assert.match(provider.verifiedSurfaceSummary, /Associate Product Manager/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'SarvaGram'), false)

  assert.equal(sarvagram.PROVIDER_METADATA.source, SARVAGRAM_CATALOG.source)
  assert.equal(sarvagram.PROVIDER_METADATA.companyName, SARVAGRAM_CATALOG.companyName)
  assert.equal(sarvagram.PROVIDER_METADATA.careersPortalUrl, SARVAGRAM_CATALOG.careersPortalUrl)
})

test('SarvaGram backlog row matches directly from the local catalog without alias churn', async () => {
  const { SARVAGRAM_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'SarvaGram\n',
    catalog: [hydrateProviderCatalogEntry(SARVAGRAM_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['SarvaGram', 'sarvagram', 'SarvaGram']],
  )
})

test('SarvaGram hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { SARVAGRAM_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SARVAGRAM_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'SarvaGram')
  assert.equal(provider.companyCareerPage, 'https://sarvagram.zohorecruit.in/jobs/Careers')
  assert.equal(provider.companyDomain, 'sarvagram.com')
  assert.equal(provider.atsPlatform, 'zohorecruit')
  assert.match(provider.modulePath, /sarvagram[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /sarvagram[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
