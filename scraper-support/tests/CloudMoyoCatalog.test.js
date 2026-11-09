import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/cloudmoyo/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/cloudmoyo/catalog.js')
  } catch {
    assert.fail('Expected CloudMoyo catalog module at ../../scraper/cloudmoyo/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/cloudmoyo/script.js')
  } catch {
    assert.fail('Expected CloudMoyo scraper module at ../../scraper/cloudmoyo/script.js')
  }
}

test('CloudMoyo local catalog captures the verified first-party SmartRecruiters India empty-board handoff', async () => {
  const { CLOUDMOYO_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const cloudmoyo = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(CLOUDMOYO_CATALOG)

  assert.equal(defaultCatalog, CLOUDMOYO_CATALOG)
  assert.equal(provider.source, 'cloudmoyo')
  assert.equal(provider.companyName, 'CloudMoyo')
  assert.equal(provider.officialBrandName, 'CloudMoyo')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.cloudmoyo.com/')
  assert.equal(provider.companyCareerPage, 'https://www.cloudmoyo.com/contact-us/')
  assert.equal(provider.boardUrl, 'https://careers.smartrecruiters.com/CloudMoyo/cloudmoyo-india-careers?remoteLocation=true')
  assert.equal(provider.companyDomain, 'cloudmoyo.com')
  assert.equal(provider.atsPlatform, 'smartrecruiters-empty-board')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-contact-page-plus-smartrecruiters-india-empty-board')
  assert.equal(
    provider.extractionStrategy,
    'verified-contact-page+verified-smartrecruiters-india-empty-board-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.cloudmoyo\.com\/contact-us\//i)
  assert.match(provider.verifiedSurfaceSummary, /careers\.smartrecruiters\.com\/CloudMoyo\/cloudmoyo-india-careers/i)
  assert.match(provider.verifiedSurfaceSummary, /No job postings are currently available/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /cloudmoyo[\\/]jobs\.json$/i)

  assert.equal(cloudmoyo.PROVIDER_METADATA.source, provider.source)
  assert.equal(cloudmoyo.PROVIDER_METADATA.boardUrl, provider.boardUrl)
})

test('CloudMoyo exact backlog row resolves from the local provider contract', async () => {
  const { CLOUDMOYO_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'CloudMoyo\n',
    catalog: [hydrateProviderCatalogEntry(CLOUDMOYO_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['CloudMoyo', 'cloudmoyo', 'CloudMoyo']],
  )
})
