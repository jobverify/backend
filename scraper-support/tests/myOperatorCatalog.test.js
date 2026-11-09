import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/myoperator/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/myoperator/catalog.js')
  } catch {
    assert.fail('Expected MyOperator catalog module at ../../scraper/myoperator/catalog.js')
  }
}

test('MyOperator local catalog captures the verified first-party shell and public Zoho Recruit API', async () => {
  const { MYOPERATOR_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(MYOPERATOR_CATALOG)

  assert.equal(defaultCatalog, MYOPERATOR_CATALOG)
  assert.equal(provider.source, 'myoperator')
  assert.equal(provider.companyName, 'MyOperator')
  assert.equal(provider.officialBrandName, 'MyOperator')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://myoperator.com/careers')
  assert.equal(provider.officialCareersPageUrl, 'https://myoperator.com/careers')
  assert.equal(provider.externalHandoffUrl, 'https://careers.myoperator.com/jobs/Careers')
  assert.equal(
    provider.jobsApiUrl,
    'https://careers.myoperator.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(provider.companyDomain, 'myoperator.com')
  assert.equal(provider.atsPlatform, 'zoho-recruit')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-careers-shell-plus-public-zoho-recruit-json')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-shell+public-zoho-recruit-jobs-api',
  )
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Vice President - Strategic Alliances & Partnerships/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Site Reliability Engineer/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /myoperator[\\/]jobs\.json$/i)
})

test('MyOperator exact backlog row resolves from the local provider metadata', async () => {
  const { MYOPERATOR_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'MyOperator\n',
    catalog: [hydrateProviderCatalogEntry(MYOPERATOR_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['MyOperator', 'myoperator', 'MyOperator']],
  )
})

test('MyOperator hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { MYOPERATOR_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(MYOPERATOR_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://myoperator.com/careers')
  assert.match(provider.modulePath, /myoperator[\\/]script\.js$/i)
  assert.equal(typeof module.run, 'function')
})
