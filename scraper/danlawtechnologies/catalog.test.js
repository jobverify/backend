import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'
import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }

test('Danlaw Technologies is registered against its official careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'danlawtechnologies')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Danlaw Technologies')
  assert.equal(provider.companyCareerPage, 'https://danlawtechnologies.com/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyDomain, 'danlawtechnologies.com')
  assert.equal(companyAliases['Danlaw Technologies'], 'danlawtechnologies')
})

test('Danlaw Technologies is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'danlawtechnologies')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /danlawtechnologies[\\/]jobs\.json$/)
})
