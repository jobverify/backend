import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { loadConfig } from '../utils/loadConfig.js'

const testsDir = path.dirname(fileURLToPath(import.meta.url))

test('getScraperCatalog includes Gap Inc. on the public Workday tenant used for India roles', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'gapinc')

  assert.ok(provider)
  assert.equal(provider.adapter, 'workday')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyName, 'Gap Inc.')
  assert.equal(provider.companyCareerPage, 'https://gapinc.wd1.myworkdayjobs.com/GAPINC')
  assert.equal(provider.companyDomain, 'gapinc.wd1.myworkdayjobs.com')
  assert.equal(provider.locationCountry, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.match(provider.baseUrl, /gapinc\.wd1\.myworkdayjobs\.com\/GAPINC/i)
  assert.equal(companyAliases['GAP IT Services India Pvt Ltd'], 'gapinc')
})

test('buildScrapers exposes a runnable Gap Inc. Workday scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'gapinc')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /gapinc.workday[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'gapinc')
  assert.equal(scraper.provider.atsPlatform, 'workday')
})

test('Gap Inc. Workday local config switches the scraper onto the public jobs API with the India facet', () => {
  const config = loadConfig(path.join(testsDir, '../../scraper/gapinc.workday'))

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://gapinc.wd1.myworkdayjobs.com/wday/cxs/gapinc/GAPINC/jobs',
  )
  assert.equal(
    config.detailUrlBase,
    'https://gapinc.wd1.myworkdayjobs.com/en-US/GAPINC',
  )
  assert.equal(config.countryFacetParameter, 'locationCountry')
  assert.equal(config.maxPages, 10)
})
