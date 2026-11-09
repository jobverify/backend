import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'
import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }

test('CynLr is registered as an official careers scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'cynlr')

  assert.ok(provider)
  assert.equal(provider.companyName, 'CynLr')
  assert.equal(provider.companyCareerPage, 'https://www.cynlr.com/careers')
  assert.equal(provider.atsPlatform, 'ashby')
  assert.equal(provider.boardToken, 'cynlr')
  assert.equal(provider.bindingEvidence.verified, true)
  assert.equal(provider.bindingEvidence.officialURL, provider.companyCareerPage)
  assert.match(provider.modulePath, /cynlr[\\/]publishing-gap-script\.js$/)
  assert.equal(provider.companyDomain, 'cynlr.com')
  assert.equal(companyAliases.CynLr, 'cynlr')
})

test('CynLr is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'cynlr')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /cynlr[\\/]jobs\.json$/)
})
