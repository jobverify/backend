import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const expectedModulePath = path.resolve(currentDir, '../../scraper/sams/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/sams/catalog.js')
  } catch {
    assert.fail('Expected SAMS catalog module at ../../scraper/sams/catalog.js')
  }
}

test('SAMS local catalog captures the verified first-party jobs shell and HTML fragment endpoint without alias churn', async () => {
  const { SAMS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SAMS_CATALOG)

  assert.equal(defaultCatalog, SAMS_CATALOG)
  assert.equal(provider.source, 'sams')
  assert.equal(provider.companyName, 'SAMS')
  assert.equal(provider.officialBrandName, 'SAMS')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.officialHomepageUrl, 'https://www.sams.co.in/')
  assert.equal(provider.companyCareerPage, 'https://www.sams.co.in/Jobs/job-list')
  assert.equal(provider.jobsListScriptUrl, 'https://www.sams.co.in/Scripts/filter.js')
  assert.equal(provider.jobsFragmentUrl, 'https://www.sams.co.in/Jobs/JobsList')
  assert.equal(provider.detailUrlPrefix, 'https://www.sams.co.in/jobs/job-description/')
  assert.equal(provider.companyDomain, 'sams.co.in')
  assert.equal(provider.atsPlatform, 'first-party-jobs-html-fragment')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-job-list-shell-plus-first-public-jobslist-fragment',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-job-list-shell+verified-filter-script+jobslist-html-fragment+same-domain-detail-pages+external-samsstc-apply-handoff+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /sams[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, expectedModulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.sams\.co\.in\/Jobs\/job-list/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.sams\.co\.in\/Scripts\/filter\.js/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.sams\.co\.in\/Jobs\/JobsList/i)
  assert.match(provider.verifiedSurfaceSummary, /\b34\b current job cards/i)
  assert.match(provider.verifiedSurfaceSummary, /Program Manager/i)
  assert.match(provider.verifiedSurfaceSummary, /State Project Manager/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'SAMS'), false)
})

test('SAMS exact backlog row matches directly from the local provider metadata', async () => {
  const { SAMS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'SAMS\n',
    catalog: [hydrateProviderCatalogEntry(SAMS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['SAMS', 'sams', 'SAMS']],
  )
})

test('SAMS hydrated local catalog stays script-runner compatible for later shared-registry integration', async () => {
  const { SAMS_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SAMS_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'SAMS')
  assert.equal(provider.companyCareerPage, 'https://www.sams.co.in/Jobs/job-list')
  assert.equal(provider.companyDomain, 'sams.co.in')
  assert.equal(provider.atsPlatform, 'first-party-jobs-html-fragment')
  assert.match(provider.modulePath, /sams[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /sams[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
