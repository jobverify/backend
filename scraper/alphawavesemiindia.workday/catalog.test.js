import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'
import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }

test('Alphawave Semi India is registered against its official India careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'alphawavesemiindia')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Alphawave Semi India')
  assert.equal(provider.companyCareerPage, 'https://awavesemi.com/careers/india-job-openings/')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyDomain, 'awavesemi.com')
  assert.equal(companyAliases['Alphawave Semi India'], 'alphawavesemiindia')
})

test('Alphawave Semi India is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'alphawavesemiindia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /alphawavesemiindia\.workday[\\/]jobs\.json$/)
})
