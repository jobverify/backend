import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../../scraper-support/providers/index.js'

test('getScraperCatalog includes Lionsbot as an official Kula-backed script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'lionsbot')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Lionsbot')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'kula-public-api')
  assert.equal(provider.companyCareerPage, 'https://www.lionsbot.com/careers')
  assert.equal(provider.companyDomain, 'lionsbot.com')
  assert.equal(provider.verifiedOn, null)
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.parser, 'validated-kula-public-api')
  assert.equal(provider.paginationStrategy, 'native-public-api-stable-total-all-pages-and-unique-identities')
  assert.equal(provider.bindingEvidence.verified, true)
  assert.equal(provider.bindingEvidence.officialURL, provider.companyCareerPage)
  assert.ok(provider.bindingEvidence.matchedLinks.includes('https://careers.kula.ai/lionsbot?jobs=true'))
  assert.equal(provider.extractionStrategy, 'official-careers-handoff+complete-kula-react-flight-jobs+india-office-filter')
  assert.match(provider.modulePath, /lionsbot[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Lionsbot scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'lionsbot')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'lionsbot')
  assert.equal(scraper.provider.companyName, 'Lionsbot')
  assert.match(scraper.dryRunFile, /lionsbot[\\/]jobs\.json$/i)
})
