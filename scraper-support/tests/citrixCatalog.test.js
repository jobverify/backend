import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadCitrixModule = async () => {
  try {
    return await import('../../scraper/citrix/script.js')
  } catch {
    assert.fail('Expected Citrix scraper module at ../../scraper/citrix/script.js')
  }
}

test('getScraperCatalog includes Citrix as a verified first-party search scraper', async () => {
  const citrix = await loadCitrixModule()
  const provider = getScraperCatalog().find((item) => item.source === 'citrix')

  assert.ok(provider)
  assert.equal(provider.source, 'citrix')
  assert.equal(provider.companyName, 'Citrix')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://careers.cloud.com/jobs/search')
  assert.equal(provider.companyDomain, 'cloud.com')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-first-party-get-filtered-search')
  assert.equal(
    provider.extractionStrategy,
    'official-search-page+detail-page+structured-job-data',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.match(provider.modulePath, /citrix[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /citrix[\\/]jobs\.json$/i)

  assert.equal(citrix.SOURCE, provider.source)
  assert.equal(citrix.COMPANY, provider.companyName)
  assert.equal(citrix.COMPANY_DOMAIN, provider.companyDomain)
  assert.equal(citrix.CAREERS_URL, provider.companyCareerPage)
})

test('buildScrapers and company coverage resolve Citrix from the shared catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'citrix')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'citrix')
  assert.match(scraper.dryRunFile, /citrix[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Citrix,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Citrix', 'citrix', 'Citrix']],
  )
})
