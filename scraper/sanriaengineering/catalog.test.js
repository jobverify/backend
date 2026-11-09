import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('SANRIA Engineering is registered against its verified first-party careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'sanriaengineering')

  assert.ok(provider)
  assert.equal(provider.companyName, 'SANRIA Engineering')
  assert.equal(provider.companyCareerPage, 'https://www.sanriaengineering.com/careers.html')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(
    provider.paginationStrategy,
    'homepage-plus-contact-page-plus-first-party-careers-popup-form',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-contact-page+public-inline-job-card+first-party-career-form',
  )
  assert.equal(provider.companyDomain, 'sanriaengineering.com')
  assert.equal(companyAliases['SANRIA Engineering'], 'sanriaengineering')
  assert.match(provider.modulePath, /sanriaengineering[\\/]script\.js$/i)
})

test('SANRIA Engineering is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'sanriaengineering')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /sanriaengineering[\\/]jobs\.json$/)
})
