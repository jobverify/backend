import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog binds STMicroelectronics to its current corporate India map and native classic reader', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'stmicroelectronics')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'eightfold-classic')
  assert.equal(provider.companyCareerPage, 'https://www.st.com/content/st_com/en/about/careers/job-categories.html')
  assert.equal(provider.companyDomain, 'st.com')
  assert.match(provider.modulePath, /stmicroelectronics[\\/]script\.js$/)
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
})

test('buildScrapers exposes a runnable STMicroelectronics source without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'stmicroelectronics')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /stmicroelectronics[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'stmicroelectronics')
  assert.equal(scraper.provider.atsPlatform, 'eightfold-classic')
})
