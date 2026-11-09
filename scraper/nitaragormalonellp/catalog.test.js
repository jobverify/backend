import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('NITARA Gormalone LLP is registered against the verified first-party careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'nitaragormalonellp')

  assert.ok(provider)
  assert.equal(provider.companyName, 'NITARA Gormalone LLP')
  assert.equal(provider.companyCareerPage, 'https://gormalone.com/careers.html')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(
    provider.paginationStrategy,
    'homepage-handoff-plus-single-first-party-careers-page-with-pdf-jds',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-first-party-careers-page+inline-pdf-job-links+resume-email',
  )
  assert.equal(provider.companyDomain, 'gormalone.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /nitaragormalonellp[\\/]script\.js$/i)
})

test('NITARA Gormalone LLP is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'nitaragormalonellp')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /nitaragormalonellp[\\/]jobs\.json$/i)
})
