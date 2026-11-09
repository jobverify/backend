import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes NXP Semiconductors on the official NXP careers page backed by Workday', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'nxp')

  assert.ok(provider)
  assert.equal(provider.adapter, 'workday')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyName, 'NXP Semiconductors')
  assert.equal(provider.companyCareerPage, 'https://www.nxp.com/company/about-nxp/careers:CAREERS')
  assert.equal(provider.companyDomain, 'nxp.com')
  assert.match(provider.baseUrl, /nxp\.wd3\.myworkdayjobs\.com\/careers/i)
})

test('buildScrapers exposes a runnable NXP Semiconductors Workday scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'nxp')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /nxp.workday[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'nxp')
  assert.equal(scraper.provider.atsPlatform, 'workday')
})
