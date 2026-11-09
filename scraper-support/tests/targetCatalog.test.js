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

test('getScraperCatalog includes Target on the official India careers page backed by Workday', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'target')

  assert.ok(provider)
  assert.equal(provider.adapter, 'workday')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyName, 'Target')
  assert.equal(provider.companyCareerPage, 'https://indiajobs.target.com/')
  assert.equal(provider.companyDomain, 'indiajobs.target.com')
  assert.equal(provider.locationCountry, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.match(provider.baseUrl, /target\.wd5\.myworkdayjobs\.com\/en-US\/targetcareers/i)
})

test('buildScrapers exposes a runnable Target Workday scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'target')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /target.workday[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'target')
  assert.equal(scraper.provider.atsPlatform, 'workday')
})

test('Target Workday local config switches the scraper onto the jobs API via India search text without the unsupported default country facet', () => {
  const config = loadConfig(path.join(testsDir, '../../scraper/target.workday'))

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://target.wd5.myworkdayjobs.com/wday/cxs/target/targetcareers/jobs',
  )
  assert.equal(
    config.detailUrlBase,
    'https://target.wd5.myworkdayjobs.com/en-US/targetcareers',
  )
  assert.equal(config.locationCountry, null)
  assert.equal(config.searchText, 'India')
  assert.match(config.locationPattern, /india|bangalore|bengaluru|pune|hyderabad|mumbai|gurgaon|gurugram/i)
  assert.equal(config.maxPages, 10)
})
