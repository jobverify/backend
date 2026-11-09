import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/dialpad/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/dialpad/catalog.js')
  } catch {
    assert.fail('Expected Dialpad catalog module at ../../scraper/dialpad/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/dialpad/script.js')
  } catch {
    assert.fail('Expected Dialpad scraper module at ../../scraper/dialpad/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Dialpad local catalog captures the verified first-party careers listing and India detail-page contract', async () => {
  const { DIALPAD_CATALOG } = await loadCatalogModule()
  const dialpad = await loadScraperModule()
  const provider = buildCatalogReadyProvider(DIALPAD_CATALOG)

  assert.equal(provider.source, 'dialpad')
  assert.equal(provider.companyName, 'Dialpad')
  assert.equal(provider.officialBrandName, 'Dialpad')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.dialpad.com/')
  assert.equal(provider.companyCareerPage, 'https://www.dialpad.com/careers/')
  assert.equal(provider.openOpportunitiesUrl, 'https://www.dialpad.com/careers/open-opportunities/')
  assert.equal(
    provider.sampleJobUrl,
    'https://www.dialpad.com/careers/open-opportunities/apply/?id=8407056002&location=Bengaluru-India&officeId=4017032002&title=QA-Automation-Engineer',
  )
  assert.equal(provider.sampleApplyUrl, 'https://boards.greenhouse.io/dialpad/jobs/8407056002')
  assert.equal(provider.companyDomain, 'dialpad.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-plus-greenhouse-apply-link')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'first-party-open-opportunities-list')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-open-opportunities-listing+india-location-filter+first-party-detail-pages+greenhouse-apply-links',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /dialpad[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.dialpad\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.dialpad\.com\/careers\/open-opportunities\//i)
  assert.match(provider.verifiedSurfaceSummary, /Bengaluru, India/i)
  assert.match(provider.verifiedSurfaceSummary, /6 Bengaluru, India roles/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/boards\.greenhouse\.io\/dialpad\/jobs\/8407056002/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Dialpad'), false)

  assert.equal(dialpad.PROVIDER_METADATA.source, provider.source)
  assert.equal(dialpad.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(dialpad.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('Dialpad backlog row matches directly from local provider metadata without alias churn', async () => {
  const { DIALPAD_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Dialpad\n',
    catalog: [buildCatalogReadyProvider(DIALPAD_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Dialpad', 'dialpad', 'Dialpad']],
  )
})

test('buildScrapers and company coverage resolve Dialpad from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'dialpad')
  const scraper = buildScrapers().find((item) => item.name === 'dialpad')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Dialpad')
  assert.equal(provider.companyCareerPage, 'https://www.dialpad.com/careers/')
  assert.match(scraper.dryRunFile, /dialpad[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Dialpad\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Dialpad', 'dialpad', 'Dialpad']],
  )
})
