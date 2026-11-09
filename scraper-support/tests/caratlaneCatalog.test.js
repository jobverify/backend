import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('CaratLane catalog retains its official careers page without promoting an unverified ATS handoff', () => {
  const catalog = getScraperCatalog()
  const caratlane = catalog.find((provider) => provider.source === 'caratlane')

  assert.ok(caratlane)
  assert.equal(caratlane.adapter, 'script')
  assert.equal(caratlane.atsPlatform, 'darwinbox')
  assert.equal(caratlane.companyCareerPage, 'https://careers.caratlane.com/')
  assert.equal(caratlane.bindingEvidence.officialURL, caratlane.companyCareerPage)
  assert.equal(caratlane.bindingEvidence.verified, false)
  assert.equal(caratlane.bindingEvidence.httpStatus, 403)
  assert.deepEqual(caratlane.bindingEvidence.matchedLinks, [])
})

test('buildScrapers exposes a runnable CaratLane scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const caratlane = scrapers.find((scraper) => scraper.name === 'caratlane')

  assert.ok(caratlane)
  assert.equal(typeof caratlane.run, 'function')
  assert.match(caratlane.dryRunFile, /caratlane[\\/]jobs\.json$/)
  assert.equal(caratlane.provider.source, 'caratlane')
})
