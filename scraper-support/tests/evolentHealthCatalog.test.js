import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/evolenthealth.workday/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/evolenthealth.workday/catalog.js')
  } catch {
    assert.fail('Expected Evolent Health catalog module at ../../scraper/evolenthealth.workday/catalog.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Evolent Health local catalog captures the verified first-party careers handoff and Workday Pune surface', async () => {
  const { EVOLENT_HEALTH_CATALOG } = await loadCatalogModule()
  const provider = buildCatalogReadyProvider(EVOLENT_HEALTH_CATALOG)

  assert.equal(provider.source, 'evolenthealth')
  assert.equal(provider.companyName, 'Evolent Health')
  assert.equal(provider.officialBrandName, 'Evolent')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.evolent.com/careers')
  assert.equal(provider.companyDomain, 'evolent.com')
  assert.equal(provider.officialHomepageUrl, 'https://www.evolent.com/')
  assert.equal(
    provider.officialWorkdayBoardUrl,
    'https://evolent.wd1.myworkdayjobs.com/External',
  )
  assert.equal(
    provider.jobsApiUrl,
    'https://evolent.wd1.myworkdayjobs.com/wday/cxs/evolent/External/jobs',
  )
  assert.deepEqual(provider.verifiedIndiaLocationDescriptors, ['Pune'])
  assert.equal(
    provider.verifiedIndiaJobUrl,
    'https://evolent.wd1.myworkdayjobs.com/External/job/Pune/Sr-SaaS-Administrator--Enterprise-Applications_JR-916402',
  )
  assert.equal(
    provider.verifiedIndiaApplyUrl,
    'https://evolent.wd1.myworkdayjobs.com/External/job/Pune/Sr-SaaS-Administrator--Enterprise-Applications_JR-916402/apply',
  )
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-first-party-careers-handoff-plus-workday-location-facet',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+verified-workday-board+unfiltered-workday-jobs-api+verified-pune-location-facet+filtered-workday-jobs-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /evolenthealth.workday[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.evolent\.com\/careers/i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/evolent\.wd1\.myworkdayjobs\.com\/External/i,
  )
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/evolent\.wd1\.myworkdayjobs\.com\/wday\/cxs\/evolent\/External\/jobs/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /India and the Philippines/i)
  assert.match(provider.verifiedSurfaceSummary, /\b10 Pune jobs\b/i)
  assert.match(provider.verifiedSurfaceSummary, /JR-916402/i)
})

test('Evolent Health exact backlog name matches directly from the local provider contract', async () => {
  const { EVOLENT_HEALTH_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Evolent Health\n',
    catalog: [buildCatalogReadyProvider(EVOLENT_HEALTH_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Evolent Health', 'evolenthealth', 'Evolent Health']],
  )
})
