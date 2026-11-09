import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Volopay native Dover script with official publisher binding', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'volopay')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'dover')
  assert.equal(provider.companyName, 'Volopay')
  assert.equal(
    provider.companyCareerPage,
    'https://jobs.dover.com/dover/careers/ebed3959-fa8a-4719-b143-0730e1223ec8?src=app',
  )
  assert.equal(provider.companyDomain, 'volopay.com')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'exact-published-board-redirect+unfiltered-native-listing+two-full-India-role-passes+closing-listing')
  assert.equal(provider.extractionStrategy, 'active-official-handoff+exact-native-client-role-country+full-employer-description;new-renderer-publication-date-unknown')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.match(provider.modulePath,/volopay[\\/]script\.js$/)
  assert.equal(provider.officialHomepageUrl,'https://www.volopay.com/')
  assert.equal(
    provider.config.discovery.listingApiUrl,
    'https://app.dover.com/api/v1/careers-page/ebed3959-fa8a-4719-b143-0730e1223ec8/jobs',
  )
  assert.equal(provider.config.request.method, 'GET')
  assert.equal(provider.config.pagination.strategy, 'single-page')
  assert.deepEqual(provider.config.mapping.title, ['title', 'name'])
  assert.deepEqual(provider.config.mapping.location, [
    {
      path: 'locations',
      valuePath: '0.name',
    },
    'location',
  ])
  assert.deepEqual(provider.config.mapping.sourceUrl, {
    strategy: 'template',
    template: 'https://app.dover.com/apply/volopay/{{jobId}}',
    values: {
      jobId: ['id', 'jobId', 'uuid'],
    },
  })
  assert.equal(
    provider.config.detail.urlTemplate,
    'https://app.dover.com/api/v1/inbound/application-portal-job/{{jobId}}',
  )
  assert.equal(provider.config.resultFilter.include[0].pattern, 'india|mumbai|bangalore|bengaluru')
})

test('buildScrapers and company coverage resolve Volopay to one runnable native source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'volopay')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /volopay[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'volopay')
  assert.equal(scraper.provider.adapter,'script')
  assert.equal(buildScrapers().filter(item=>item.name==='volopay').length,1)

  const report = generateCompanyCoverageReport({
    csvText: 'Volopay,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Volopay', 'volopay', 'Volopay']],
  )
})
