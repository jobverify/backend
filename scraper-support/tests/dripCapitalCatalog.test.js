import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Drip Capital with the Thursday, August 13, 2026 payload-hash metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'dripcapital')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Drip Capital')
  assert.equal(provider.companyCareerPage, 'https://www.dripcapital.com/en-in/careers/')
  assert.equal(provider.verifiedOn, '2026-08-13')
  assert.equal(provider.legacyCareersPayloadUrl, 'https://assets.dripcapital.com/_nuxt/static/1786337464/careers/payload.js')
  assert.equal(provider.indiaCareersPayloadUrl, 'https://assets.dripcapital.com/_nuxt/static/1786337464/en-in/careers/payload.js')
  assert.equal(provider.usCareersPayloadUrl, 'https://assets.dripcapital.com/_nuxt/static/1786337464/en-us/careers/payload.js')
})

test('buildScrapers exposes a runnable Drip Capital sentinel scraper', () => {
  const scraper = buildScrapers().find((item) => item.name === 'dripcapital')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.dripcapital.com/en-in/careers/')
})
