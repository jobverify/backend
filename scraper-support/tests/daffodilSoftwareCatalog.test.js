import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/daffodilsoftware/provider.js')
  } catch {
    assert.fail('Expected Daffodil Software provider module at ../../scraper/daffodilsoftware/provider.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/daffodilsoftware/script.js')
  } catch {
    assert.fail('Expected Daffodil Software scraper module at ../../scraper/daffodilsoftware/script.js')
  }
}

test('getScraperCatalog includes Daffodil Software as a verified first-party no-public-jobs sentinel', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()
  const provider = getScraperCatalog().find((item) => item.source === 'daffodilsoftware')

  assert.ok(provider)
  assert.equal(provider.source, 'daffodilsoftware')
  assert.equal(provider.companyName, 'Daffodil Software')
  assert.equal(provider.adapter, 'script')
  assert.match(provider.modulePath, /daffodilsoftware[\\/]script\.js$/i)
  assert.equal(provider.companyCareerPage, 'https://www.daffodilsw.com/career/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-career-page-plus-common-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-career-culture-page-with-placeholder-open-vacancies+careers-redirect+missing-common-job-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'daffodilsw.com')
  assert.equal(provider.verifiedOn, '2026-07-14')
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.match(provider.dryRunFile, /daffodilsoftware[\\/]jobs\.json$/i)

  assert.equal(providerModule.provider.source, provider.source)
  assert.equal(providerModule.provider.companyName, provider.companyName)
  assert.equal(providerModule.provider.companyCareerPage, provider.companyCareerPage)
  assert.equal(scriptModule.SOURCE, provider.source)
  assert.equal(scriptModule.COMPANY, provider.companyName)
  assert.equal(scriptModule.CAREER_URL, provider.companyCareerPage)
})

test('buildScrapers and company coverage resolve Daffodil Software from the shared catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'daffodilsoftware')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'daffodilsoftware')
  assert.match(scraper.dryRunFile, /daffodilsoftware[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Daffodil Software,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Daffodil Software', 'daffodilsoftware', 'Daffodil Software']],
  )
})
