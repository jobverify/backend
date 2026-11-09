import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Intellect Design Arena is registered against its official careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'intellectdesignarena')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Intellect Design Arena')
  assert.equal(provider.companyCareerPage, 'https://www.intellectdesign.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers-candidatemax')
  assert.equal(provider.companyDomain, 'intellectdesign.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /intellectdesignarena[\\/]script\.js$/i)
})

test('Intellect Design Arena is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'intellectdesignarena')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /intellectdesignarena[\\/]jobs\.json$/)
})
