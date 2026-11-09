import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Ford Motor Pvt Ltd India scraper with TalentBrew metadata', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'fordmotorpvtltd')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'talentbrew-radancy')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyDomain, 'careers.ford.com')
  assert.match(
    provider.companyCareerPage,
    /careers\.ford\.com\/search-jobs\?acm=ALL&alrpm=1269750/i,
  )
})

test('buildScrapers exposes a runnable Ford Motor Pvt Ltd scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const scraper = scrapers.find((item) => item.name === 'fordmotorpvtltd')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /fordmotorpvtltd[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'fordmotorpvtltd')
  assert.equal(scraper.provider.atsPlatform, 'talentbrew-radancy')
})
