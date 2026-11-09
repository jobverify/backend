import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes FACE Prep as an official no-public-careers sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'faceprep')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.companyName, 'FACE Prep')
  assert.equal(provider.companyCareerPage, 'https://faceprep.in/careers/')
  assert.equal(provider.companyDomain, 'faceprep.in')
  assert.match(provider.modulePath, /faceprep[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable FACE Prep scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'faceprep')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'faceprep')
  assert.equal(scraper.provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(scraper.dryRunFile, /faceprep[\\/]jobs\.json$/)
})
