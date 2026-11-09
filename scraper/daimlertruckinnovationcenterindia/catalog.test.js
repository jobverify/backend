import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'
import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }

test('DTICI is registered against its official careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'daimlertruckinnovationcenterindia')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Daimler Truck Innovation Center India (DTICI)')
  assert.equal(provider.companyCareerPage, 'https://dtici.daimlertruck.com/career/')
  assert.equal(provider.atsPlatform, 'official-company-careers-api')
  assert.equal(provider.companyDomain, 'dtici.daimlertruck.com')
  assert.equal(companyAliases['Daimler Truck Innovation Center India (DTICI)'], 'daimlertruckinnovationcenterindia')
})

test('DTICI is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'daimlertruckinnovationcenterindia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /daimlertruckinnovationcenterindia[\\/]jobs\.json$/)
})
