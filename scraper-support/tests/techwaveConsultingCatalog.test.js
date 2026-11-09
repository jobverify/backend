import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/techwaveconsulting/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/techwaveconsulting/catalog.js')
  } catch {
    assert.fail('Expected Techwave Consulting catalog module at ../../scraper/techwaveconsulting/catalog.js')
  }
}

test('Techwave Consulting local catalog captures the verified careers shell, join-us embed, and Workday jobs API contract', async () => {
  const { TECHWAVE_CONSULTING_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(TECHWAVE_CONSULTING_CATALOG)

  assert.equal(defaultCatalog, TECHWAVE_CONSULTING_CATALOG)
  assert.equal(provider.source, 'techwaveconsulting')
  assert.equal(provider.companyName, 'Techwave Consulting')
  assert.equal(provider.officialBrandName, 'Techwave')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.techwave.com/career/')
  assert.equal(provider.joinUsPageUrl, 'https://www.techwave.com/join-us/')
  assert.equal(provider.officialWorkdayBoardUrl, 'https://techwave.wd108.myworkdayjobs.com/TechWave_Careers')
  assert.equal(
    provider.jobsApiUrl,
    'https://techwave.wd108.myworkdayjobs.com/wday/cxs/techwave/TechWave_Careers/jobs',
  )
  assert.deepEqual(provider.verifiedIndiaLocationDescriptors, [
    'Bangalore',
    'GDC Financial District',
    'GDC HiTech',
    'Khammam',
  ])
  assert.equal(provider.companyDomain, 'techwave.com')
  assert.equal(provider.atsPlatform, 'workday-jobs-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'first-party-workday-jobs-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-shell+verified-join-us-workday-embed+public-workday-board+india-location-facets+jobs-api',
  )
  assert.equal(provider.verifiedOn, '2026-08-14')
  assert.equal(provider.verifiedPublicJobCount, 63)
  assert.equal(provider.verifiedIndiaJobCount, 37)
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 14, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.techwave\.com\/career\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.techwave\.com\/join-us\//i)
  assert.match(provider.verifiedSurfaceSummary, /Join Us - TechWave/i)
  assert.match(provider.verifiedSurfaceSummary, /TechWave_Careers/i)
  assert.match(provider.verifiedSurfaceSummary, /AI Architect/i)
  assert.match(provider.verifiedSurfaceSummary, /Product Designer/i)
  assert.match(provider.verifiedSurfaceSummary, /37 India jobs/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /techwaveconsulting[\\/]jobs\.json$/i)
})

test('Techwave Consulting exact backlog row resolves from the local provider metadata', async () => {
  const { TECHWAVE_CONSULTING_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Techwave Consulting\n',
    catalog: [hydrateProviderCatalogEntry(TECHWAVE_CONSULTING_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Techwave Consulting', 'techwaveconsulting', 'Techwave Consulting']],
  )
})

test('Techwave Consulting hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { TECHWAVE_CONSULTING_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(TECHWAVE_CONSULTING_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.techwave.com/career/')
  assert.equal(provider.joinUsPageUrl, 'https://www.techwave.com/join-us/')
  assert.match(provider.modulePath, /techwaveconsulting[\\/]script\.js$/i)
  assert.equal(typeof module.run, 'function')
})
