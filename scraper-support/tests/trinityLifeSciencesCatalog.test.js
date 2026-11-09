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

test('registers Trinity Life Sciences against the official Workday tenant linked from its careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'trinitylifesciences')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Trinity Life Sciences')
  assert.equal(provider.adapter, 'workday')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyCareerPage, 'https://trinitylifesciences.com/company/careers/')
  assert.equal(provider.companyDomain, 'trinitylifesciences.com')
  assert.equal(provider.locationCountry, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.equal(provider.baseUrl, 'https://trinitylifesciences.wd108.myworkdayjobs.com/Trinity')
})

test('buildScrapers exposes a runnable Trinity Life Sciences Workday scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'trinitylifesciences')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /trinitylifesciences.workday[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'trinitylifesciences')
  assert.equal(scraper.provider.atsPlatform, 'workday')
})

test('Trinity Life Sciences Workday local config uses the jobs API plus India search text on the official tenant', () => {
  const config = loadConfig(path.join(testsDir, '../../scraper/trinitylifesciences.workday'))

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://trinitylifesciences.wd108.myworkdayjobs.com/wday/cxs/trinitylifesciences/Trinity/jobs',
  )
  assert.equal(
    config.detailUrlBase,
    'https://trinitylifesciences.wd108.myworkdayjobs.com/Trinity',
  )
  assert.equal(config.searchText, 'India')
})
