import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Flowserve as a public Jobsyn-backed script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'flowserve')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'jobsyn-solr')
  assert.equal(provider.companyName, 'Flowserve')
  assert.equal(provider.companyCareerPage, 'https://careers.flowserve.com/locations/ind/jobs/')
  assert.equal(provider.companyDomain, 'careers.flowserve.com')
  assert.match(provider.modulePath, /flowserve[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Flowserve scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'flowserve')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /flowserve[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'flowserve')
  assert.equal(scraper.provider.atsPlatform, 'jobsyn-solr')
})
