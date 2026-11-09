import assert from 'node:assert/strict'
import path from 'path'
import test from 'node:test'
import { fileURLToPath } from 'url'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import { loadConfig } from '../utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

test('getScraperCatalog includes Guidewire on the official careers page backed by a public Workday jobs API', () => {
  const catalog = getScraperCatalog()
  const guidewire = catalog.find((provider) => provider.source === 'guidewire')

  assert.ok(guidewire)
  assert.equal(guidewire.adapter, 'workday')
  assert.equal(guidewire.atsPlatform, 'workday')
  assert.equal(guidewire.companyName, 'Guidewire')
  assert.equal(guidewire.companyDomain, 'guidewire.com')
  assert.match(guidewire.companyCareerPage, /guidewire\.com\/about\/careers\/jobs/i)
  assert.match(guidewire.baseUrl, /wd5\.myworkdaysite\.com\/recruiting\/guidewire\/external/i)
})

test('buildScrapers exposes a runnable Guidewire Workday scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const guidewire = scrapers.find((scraper) => scraper.name === 'guidewire')

  assert.ok(guidewire)
  assert.equal(typeof guidewire.run, 'function')
  assert.match(guidewire.dryRunFile, /guidewire.workday[\\/]jobs\.json$/)
  assert.equal(guidewire.provider.source, 'guidewire')
  assert.equal(guidewire.provider.atsPlatform, 'workday')
})

test('Guidewire Workday tenant is configured to use the public jobs API listing strategy', () => {
  const config = loadConfig(path.resolve(currentDir, '../../scraper/guidewire.workday'))

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://wd5.myworkdaysite.com/wday/cxs/guidewire/external/jobs',
  )
  assert.equal(
    config.detailUrlBase,
    'https://wd5.myworkdaysite.com/recruiting/guidewire/external',
  )
})
