import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const loadMetricStreamCatalog = async () => {
  try {
    return await import('../../scraper/metricstream/catalog.js')
  } catch {
    assert.fail('Expected MetricStream catalog module at ../../scraper/metricstream/catalog.js')
  }
}

test('MetricStream catalog records the independently verified India subset and unresolved primary conflict', async () => {
  const {
    METRICSTREAM_CATALOG,
    default: defaultCatalog,
  } = await loadMetricStreamCatalog()

  assert.equal(defaultCatalog, METRICSTREAM_CATALOG)
  assert.equal(METRICSTREAM_CATALOG.source, 'metricstream')
  assert.equal(METRICSTREAM_CATALOG.companyName, 'MetricStream')
  assert.equal(METRICSTREAM_CATALOG.officialBrandName, 'MetricStream')
  assert.equal(METRICSTREAM_CATALOG.adapter, 'script')
  assert.equal(METRICSTREAM_CATALOG.homepageUrl, 'https://www.metricstream.com/')
  assert.equal(
    METRICSTREAM_CATALOG.companyCareerPage,
    'https://www.metricstream.com/about-us/careers.htm',
  )
  assert.equal(METRICSTREAM_CATALOG.companyDomain, 'metricstream.com')
  assert.equal(METRICSTREAM_CATALOG.successFactorsCompanyToken, 'metricstre')
  assert.equal(
    METRICSTREAM_CATALOG.successFactorsBoardUrl,
    'https://career5.successfactors.eu/career?company=metricstre',
  )
  assert.equal(
    METRICSTREAM_CATALOG.successFactorsSearchUrl,
    'https://career5.successfactors.eu/career?company=metricstre&career_ns=job_listing_summary&navBarLevel=JOB_SEARCH&',
  )
  assert.equal(
    METRICSTREAM_CATALOG.verifiedSampleJobUrl,
    'https://in.linkedin.com/jobs/view/delivery-manager-at-metricstream-4468518584',
  )
  assert.equal(METRICSTREAM_CATALOG.atsPlatform, 'official-first-party-job-cards+employer-linkedin-partial+legacy-successfactors')
  assert.equal(METRICSTREAM_CATALOG.countryFilter, 'India')
  assert.equal(METRICSTREAM_CATALOG.paginationStrategy, 'first-party-role-cards+partial-employer-linkedin-snapshot+legacy-successfactors-dwr')
  assert.equal(
    METRICSTREAM_CATALOG.extractionStrategy,
    'verified-first-party-homepage+country-conflict-preserved+employer-linkedin-identity-country-jd-expiry+partial-india-subset+legacy-successfactors',
  )
  assert.equal(METRICSTREAM_CATALOG.parser, 'custom-script')
  assert.equal(METRICSTREAM_CATALOG.normalizationProfile, 'engineering-default')
  assert.match(METRICSTREAM_CATALOG.verifiedOn, /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(METRICSTREAM_CATALOG.sourceListingComplete, false)
  assert.equal(METRICSTREAM_CATALOG.verifiedPublicJobCount, null)
  assert.equal(METRICSTREAM_CATALOG.verifiedIndiaJobCount, null)
  assert.equal(METRICSTREAM_CATALOG.verifiedObservedIndiaSubsetCount, 1)
  assert.equal(METRICSTREAM_CATALOG.linkedinEmployerUrl, 'https://www.linkedin.com/company/metricstream')
  assert.equal(METRICSTREAM_CATALOG.linkedinJobsUrl, 'https://www.linkedin.com/company/metricstream/jobs')
  assert.equal(METRICSTREAM_CATALOG.dryRunFile, 'metricstream/jobs.json')
  assert.ok(METRICSTREAM_CATALOG.verifiedSurfaceSummary.includes(METRICSTREAM_CATALOG.verifiedOn))
  assert.match(METRICSTREAM_CATALOG.verifiedSurfaceSummary, /partial.*India subset/i)
  assert.match(METRICSTREAM_CATALOG.verifiedSurfaceSummary, /LinkedIn/i)
  assert.match(METRICSTREAM_CATALOG.verifiedSurfaceSummary, /global.*unknown/i)
  assert.match(METRICSTREAM_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.metricstream\.com\//)
  assert.match(METRICSTREAM_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.metricstream\.com\/about-us\/careers\.htm/)
  assert.match(METRICSTREAM_CATALOG.verifiedSurfaceSummary, /https:\/\/career5\.successfactors\.eu\/career\?company=metricstre/)
  assert.match(METRICSTREAM_CATALOG.verifiedSurfaceSummary, /four first-party role cards/i)
  assert.match(METRICSTREAM_CATALOG.verifiedSurfaceSummary, /conflicting country scope/i)
  assert.match(METRICSTREAM_CATALOG.verifiedSurfaceSummary, /head-of-services/i)
  assert.match(METRICSTREAM_CATALOG.modulePath, /metricstream[\\/]script\.js$/i)
})

test('MetricStream backlog matching works directly from the local catalog metadata', async () => {
  const { METRICSTREAM_CATALOG } = await loadMetricStreamCatalog()

  const report = generateCompanyCoverageReport({
    csvText: 'MetricStream,\n',
    catalog: [METRICSTREAM_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['MetricStream', 'metricstream', 'MetricStream']],
  )
})
