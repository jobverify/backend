import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('NimbleWork is registered against its verified first-party current openings page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'nimblework')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Nimble Work, Inc')
  assert.equal(provider.companyCareerPage, 'https://www.nimblework.com/careers/current-openings/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyDomain, 'nimblework.com')
  assert.equal(
    provider.paginationStrategy,
    'homepage-plus-careers-page-plus-first-party-current-openings-page',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-first-party-careers-page+verified-current-openings-accordion-listings',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /nimblework[\\/]script\.js$/i)

  assert.equal(companyAliases['Nimble Work, Inc'], 'nimblework')
  assert.equal(companyAliases['NimbleWork, Inc.'], 'nimblework')
  assert.equal(companyAliases.NimbleWork, 'nimblework')
})

test('NimbleWork is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'nimblework')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'nimblework')
  assert.match(scraper.dryRunFile, /nimblework[\\/]jobs\.json$/i)
})
