import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/scoreme/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/scoreme/catalog.js')
  } catch {
    assert.fail('Expected ScoreMe Solutions catalog module at ../../scraper/scoreme/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/scoreme/script.js')
  } catch {
    assert.fail('Expected ScoreMe Solutions scraper module at ../../scraper/scoreme/script.js')
  }
}

test('ScoreMe Solutions local catalog captures the verified first-party jobs page', async () => {
  const { SCOREME_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const scoreme = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(SCOREME_CATALOG)

  assert.equal(defaultCatalog, SCOREME_CATALOG)
  assert.equal(provider.source, 'scoreme')
  assert.equal(provider.companyName, 'ScoreMe Solutions')
  assert.equal(provider.officialBrandName, 'ScoreMe Solutions')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://scoreme.in/')
  assert.equal(provider.companyCareerPage, 'https://scoreme.in/jobs/')
  assert.equal(provider.companyDomain, 'scoreme.in')
  assert.equal(provider.atsPlatform, 'official-first-party-jobs-page')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-page')
  assert.equal(provider.extractionStrategy, 'same-domain-job-links')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /scoreme[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Job Openings/i)
  assert.match(provider.verifiedSurfaceSummary, /Data Pipeline Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /Digital Marketing Associate/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'ScoreMe Solutions'), false)

  assert.equal(scoreme.PROVIDER_METADATA.source, SCOREME_CATALOG.source)
  assert.equal(scoreme.PROVIDER_METADATA.companyCareerPage, SCOREME_CATALOG.companyCareerPage)
})

test('ScoreMe Solutions exact backlog row resolves from the local provider contract', async () => {
  const { SCOREME_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'ScoreMe Solutions\n',
    catalog: [hydrateProviderCatalogEntry(SCOREME_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['ScoreMe Solutions', 'scoreme', 'ScoreMe Solutions']],
  )
})
