import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Virtusa as an official apiPortal provider', () => {
  const virtusa = getScraperCatalog().find((provider) => provider.source === 'virtusa')

  assert.ok(virtusa)
  assert.equal(virtusa.adapter, 'apiPortal')
  assert.equal(virtusa.atsPlatform, 'agenticweb-graphql')
  assert.equal(virtusa.companyCareerPage, 'https://www.virtusa.com/careers/job-search/in')
  assert.equal(virtusa.companyDomain, 'virtusa.com')
  assert.equal(
    virtusa.config.discovery.listingApiUrl,
    'https://prod.agenticweb-marketing.com/careers/graphql',
  )
  assert.match(virtusa.config.request.body.query, /jobListResults\(isList: "true"\)/)
  assert.equal(virtusa.config.pagination.resultsPath, 'data.jobListResults.results')
  assert.deepEqual(virtusa.config.resultFilter.include, [{ field: 'location', pattern: 'india' }])
})

test('buildScrapers exposes a runnable Virtusa apiPortal scraper', () => {
  const scraper = buildScrapers().find((item) => item.name === 'virtusa')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /virtusa[\\/]jobs\.json$/)
})
