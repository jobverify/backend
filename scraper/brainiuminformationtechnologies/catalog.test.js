import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'
import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }

test('Brainium Information Technologies provider metadata captures the verified blocked first-party state', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'brainiuminformationtechnologies')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Brainium Information Technologies')
  assert.equal(provider.homepageUrl, 'https://www.brainiuminfotech.com/')
  assert.equal(provider.companyCareerPage, 'https://www.brainiuminfotech.com/careers')
  assert.equal(provider.officialCareersPageUrl, 'https://www.brainiuminfotech.com/careers')
  assert.equal(provider.atsPlatform, 'first-party-html-open-roles')
  assert.equal(provider.companyDomain, 'brainiuminfotech.com')
  assert.equal(provider.verifiedOn, '2026-10-27')
  assert.match(provider.extractionStrategy, /access-denial-is-not-empty/i)
  assert.match(provider.verifiedSurfaceSummary, /HTTP 403/i)
  assert.equal(companyAliases.Brainium, 'brainiuminformationtechnologies')
})

test('Brainium Information Technologies is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'brainiuminformationtechnologies')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /brainiuminformationtechnologies[\\/]jobs\.json$/)
})
