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

test('getScraperCatalog includes Broadridge Financial Solutions on the official Workday tenant linked from its website', () => {
  const catalog = getScraperCatalog()
  const broadridge = catalog.find((provider) => provider.source === 'broadridge')

  assert.ok(broadridge)
  assert.equal(broadridge.adapter, 'workday')
  assert.equal(broadridge.atsPlatform, 'workday')
  assert.equal(broadridge.companyName, 'Broadridge Financial Solutions')
  assert.equal(broadridge.companyCareerPage, 'https://www.broadridge.com/careers')
  assert.equal(broadridge.bindingEvidence.verified, true)
  assert.equal(broadridge.bindingEvidence.officialURL, broadridge.companyCareerPage)
  assert.ok(broadridge.bindingEvidence.matchedLinks.includes(broadridge.baseUrl))
  assert.equal(broadridge.companyDomain, 'broadridge.com')
  assert.match(broadridge.baseUrl, /broadridge\.wd5\.myworkdayjobs\.com\/Careers/i)
})

test('buildScrapers exposes a runnable Broadridge Workday scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const broadridge = scrapers.find((scraper) => scraper.name === 'broadridge')

  assert.ok(broadridge)
  assert.equal(typeof broadridge.run, 'function')
  assert.match(broadridge.dryRunFile, /broadridge.workday[\\/]jobs\.json$/)
  assert.equal(broadridge.provider.source, 'broadridge')
  assert.equal(broadridge.provider.atsPlatform, 'workday')
})

test('Broadridge Workday tenant is configured to use the jobs API listing strategy', () => {
  const config = loadConfig(path.resolve(currentDir, '../../scraper/broadridge.workday'))

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://broadridge.wd5.myworkdayjobs.com/wday/cxs/broadridge/Careers/jobs',
  )
  assert.equal(
    config.detailUrlBase,
    'https://broadridge.wd5.myworkdayjobs.com/en-US/Careers',
  )
})
