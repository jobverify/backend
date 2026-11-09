import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Tektronix as an Eightfold apiPortal provider linked from the official careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'tektronix')

  assert.ok(provider)
  assert.equal(provider.adapter, 'apiPortal')
  assert.equal(provider.atsPlatform, 'eightfold')
  assert.equal(provider.companyName, 'Tektronix')
  assert.equal(provider.companyCareerPage, 'https://www.tek.com/en/careers')
  assert.equal(provider.companyDomain, 'tek.com')
  assert.equal(provider.config.discovery.careerPageUrl, 'https://careers.ralliant.com/tektronix/')
  assert.match(provider.config.discovery.listingApiUrl, /ralliant\.eightfold\.ai\/api\/pcsx\/search/i)
  assert.equal(provider.config.request.query.domain, 'ralliant.com')
  assert.equal(provider.config.request.query.sort_by, 'relevance')
  assert.equal(provider.config.request.query.filter_efcustom_text_operatingcompany, 'tektronix')
  assert.equal(provider.config.request.query.filter_operating_company, undefined)
  assert.equal(provider.config.request.query.location, undefined)
  assert.equal(provider.config.request.headers.Accept, 'application/json, text/plain, */*')
  assert.match(provider.config.request.headers['User-Agent'], /Mozilla\/5\.0/)
  assert.equal(provider.config.request.headers.Referer, 'https://careers.ralliant.com/tektronix/')
  assert.equal(provider.config.request.headers.Origin, 'https://careers.ralliant.com')
  assert.equal(
    provider.config.detail.urlTemplate,
    'https://ralliant.eightfold.ai/api/pcsx/position_details?position_id={{jobId}}&domain=ralliant.com&hl=en',
  )
  assert.deepEqual(provider.config.detail.headers, provider.config.request.headers)
})

test('buildScrapers exposes a runnable Tektronix apiPortal scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'tektronix')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /tektronix[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'tektronix')
  assert.equal(scraper.provider.atsPlatform, 'eightfold')
})
