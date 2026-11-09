import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes STMicroelectronics as an Eightfold apiPortal provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'stmicroelectronics')

  assert.ok(provider)
  assert.equal(provider.adapter, 'apiPortal')
  assert.equal(provider.atsPlatform, 'eightfold')
  assert.equal(provider.companyCareerPage, 'https://www.st.com/content/st_com/en/about/careers.html')
  assert.equal(provider.companyDomain, 'stmicroelectronics.com')
  assert.match(provider.config.discovery.listingApiUrl, /stmicroelectronics\.eightfold\.ai\/api\/pcsx\/search/i)
  assert.equal(provider.config.request.query.domain, 'stmicroelectronics.com')
})

test('buildScrapers exposes a runnable STMicroelectronics apiPortal scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'stmicroelectronics')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /stmicroelectronics[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'stmicroelectronics')
  assert.equal(scraper.provider.atsPlatform, 'eightfold')
})
