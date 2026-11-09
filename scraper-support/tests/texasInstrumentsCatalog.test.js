import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Texas Instruments as an Oracle Cloud-backed script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'texasinstruments')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'oracle-cloud')
  assert.equal(provider.companyName, 'Texas Instruments')
  assert.match(provider.companyCareerPage, /edbz\.fa\.us2\.oraclecloud\.com\/hcmUI\/CandidateExperience\/en\/sites\/CX\/jobs/i)
  assert.equal(provider.companyDomain, 'edbz.fa.us2.oraclecloud.com')
  assert.match(provider.modulePath, /texasinstruments[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Texas Instruments scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'texasinstruments')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /texasinstruments[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'texasinstruments')
  assert.equal(scraper.provider.atsPlatform, 'oracle-cloud')
})
