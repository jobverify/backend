import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadChaseIndiaModule = async () => {
  try {
    return await import('../../scraper/chaseindia/script.js')
  } catch {
    assert.fail('Expected Chase India scraper module at ../../scraper/chaseindia/script.js')
  }
}

test('getScraperCatalog includes Chase India as a verified Oracle Cloud script provider', async () => {
  const chaseIndia = await loadChaseIndiaModule()
  const provider = getScraperCatalog().find((item) => item.source === chaseIndia.SOURCE)

  assert.ok(provider)
  assert.equal(provider.source, 'chaseindia')
  assert.equal(provider.companyName, 'Chase India')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.jpmorganchase.com/careers')
  assert.equal(provider.companyDomain, 'jpmorganchase.com')
  assert.equal(provider.atsPlatform, 'oracle-cloud')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'offset-query')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-careers-pages+oracle-cloud-finder-api+oracle-cloud-detail-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.workspaceDomain, 'jpmc.fa.oraclecloud.com')
  assert.match(provider.modulePath, /chaseindia[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /chaseindia[\\/]jobs\.json$/i)

  assert.equal(chaseIndia.SOURCE, provider.source)
  assert.equal(chaseIndia.COMPANY_NAME, provider.companyName)
  assert.equal(chaseIndia.COMPANY_DOMAIN, provider.companyDomain)
  assert.equal(chaseIndia.ATS_PLATFORM, provider.atsPlatform)
  assert.equal(chaseIndia.COUNTRY_FILTER, provider.countryFilter)
  assert.equal(chaseIndia.PAGINATION_STRATEGY, provider.paginationStrategy)
  assert.equal(chaseIndia.PARSER, provider.parser)
  assert.equal(chaseIndia.NORMALIZATION_PROFILE, provider.normalizationProfile)
  assert.equal(chaseIndia.CORPORATE_CAREERS_URL, provider.companyCareerPage)
  assert.equal(chaseIndia.CORPORATE_CAREERS_URL, 'https://www.jpmorganchase.com/careers')
  assert.equal(
    chaseIndia.CANDIDATE_EXPERIENCE_URL,
    'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/requisitions',
  )
  assert.equal(
    chaseIndia.LISTING_API_BASE_URL,
    'https://jpmc.fa.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions',
  )
  assert.equal(
    chaseIndia.DETAIL_API_BASE_URL,
    'https://jpmc.fa.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails',
  )
  assert.equal(
    chaseIndia.PUBLIC_JOBS_BASE_URL,
    'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/',
  )
  assert.equal(chaseIndia.SITE_NUMBER, 'CX_1001')
  assert.equal(typeof chaseIndia.createChaseIndiaScraper, 'function')
})

test('buildScrapers and company coverage resolve Chase India from the shared catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'chaseindia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'chaseindia')
  assert.match(scraper.dryRunFile, /chaseindia[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Chase India,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Chase India', 'chaseindia', 'Chase India']],
  )
})
