import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Actualize Consulting Engineers India is registered against its Zoho public careers feed', () => {
  const provider = getScraperCatalog().find(
    (item) => item.source === 'actualizeconsultingengineersindia',
  )

  assert.ok(provider)
  assert.equal(provider.companyName, 'Actualize Consulting Engineers India Pvt Ltd')
  assert.equal(provider.companyCareerPage, 'https://actualize.zohorecruit.in/jobs/Careers')
  assert.equal(provider.atsPlatform, 'zoho-recruit')
  assert.equal(provider.paginationStrategy, 'single-public-feed')
  assert.equal(provider.extractionStrategy, 'public-recruit-json')
  assert.equal(provider.companyDomain, 'actualize.zohorecruit.in')
  assert.match(provider.modulePath, /actualizeconsultingengineersindia[\\/]script\.js$/i)
})

test('Actualize Consulting Engineers India is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find(
    (item) => item.name === 'actualizeconsultingengineersindia',
  )

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /actualizeconsultingengineersindia[\\/]jobs\.json$/)
})
