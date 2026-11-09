import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import { loadConfig } from '../utils/loadConfig.js'

const testsDir = path.dirname(fileURLToPath(import.meta.url))

test('getScraperCatalog includes Synechron on the official careers page backed by Workday', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'synechron')

  assert.ok(provider)
  assert.equal(provider.adapter, 'workday')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyName, 'Synechron')
  assert.equal(provider.companyCareerPage, 'https://www.synechron.com/careers/jobs/all/India/all')
  assert.equal(provider.companyDomain, 'synechron.com')
  assert.equal(provider.locationCountry, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.match(provider.baseUrl, /synechron\.wd1\.myworkdayjobs\.com\/SynechronCareers/i)
})

test('buildScrapers exposes a runnable Synechron Workday scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'synechron')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /synechron.workday[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'synechron')
  assert.equal(scraper.provider.atsPlatform, 'workday')
})

test('Synechron Workday local config switches the scraper onto the jobs API with the country facet', () => {
  const config = loadConfig(path.join(testsDir, '../../scraper/synechron.workday'))

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://synechron.wd1.myworkdayjobs.com/wday/cxs/synechron/SynechronCareers/jobs',
  )
  assert.equal(
    config.detailUrlBase,
    'https://synechron.wd1.myworkdayjobs.com/en-US/SynechronCareers',
  )
  assert.equal(config.countryFacetParameter, 'locationCountry')
  assert.equal(config.maxPages, 10)
})
