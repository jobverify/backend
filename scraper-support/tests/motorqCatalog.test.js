import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Motorq Dover apiPortal provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'motorq')

  assert.ok(provider)
  assert.equal(provider.adapter, 'apiPortal')
  assert.equal(provider.atsPlatform, 'dover')
  assert.equal(provider.companyName, 'Motorq')
  assert.equal(provider.companyCareerPage, 'https://motorq.com/careers')
  assert.equal(provider.companyDomain, 'motorq.com')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-page')
  assert.equal(provider.extractionStrategy, 'api+detail')
  assert.equal(provider.parser, 'api-portal')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(
    provider.config.discovery.listingApiUrl,
    'https://app.dover.com/api/v1/careers-page/9e8e642f-e978-454c-b55c-910215742ec7/jobs',
  )
  assert.equal(provider.config.request.method, 'GET')
  assert.equal(provider.config.pagination.strategy, 'single-page')
  assert.equal(provider.config.pagination.resultsPath, 'results')
  assert.deepEqual(provider.config.mapping.title, ['title', 'name'])
  assert.deepEqual(provider.config.mapping.location, [
    {
      path: 'locations',
      valuePath: '0.name',
    },
    'location',
  ])
  assert.deepEqual(provider.config.mapping.postingDate, [
    'created',
    'createdAt',
    'updatedAt',
    'openedAt',
  ])
  assert.deepEqual(provider.config.mapping.remoteStatus, {
    path: 'workplace_type',
    valueMap: {
      REMOTE: 'Remote',
      HYBRID: 'Hybrid',
      ONSITE: 'On-site',
      ON_SITE: 'On-site',
    },
  })
  assert.deepEqual(provider.config.mapping.employmentType, {
    path: 'compensation',
    valuePath: 'employment_type',
    valueMap: {
      FULL_TIME: 'Full-time',
      PART_TIME: 'Part-time',
      CONTRACT: 'Contract',
      CONTRACTOR: 'Contract',
      INTERN: 'Internship',
    },
  })
  assert.deepEqual(provider.config.mapping.sourceUrl, {
    strategy: 'template',
    template: 'https://app.dover.com/apply/motorq/{{jobId}}',
    values: {
      jobId: ['id', 'jobId', 'uuid'],
    },
  })
  assert.deepEqual(provider.config.detail.mapping.jobDescription, [
    'user_provided_description',
    'description',
    'jobDescription',
    'descriptionHtml',
  ])
  assert.equal(
    provider.config.detail.urlTemplate,
    'https://app.dover.com/api/v1/inbound/application-portal-job/{{jobId}}',
  )
  assert.equal(provider.config.resultFilter.include[0].pattern, 'india|chennai|bangalore|bengaluru')
})

test('buildScrapers and company coverage resolve Motorq to a runnable apiPortal source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'motorq')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /motorq[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'motorq')

  const report = generateCompanyCoverageReport({
    csvText: 'Motorq,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Motorq', 'motorq', 'Motorq']],
  )
})
