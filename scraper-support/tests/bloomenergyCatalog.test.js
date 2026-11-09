import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Bloom Energy on the public Workday tenant linked from its careers page', () => {
  const catalog = getScraperCatalog()
  const bloomenergy = catalog.find((provider) => provider.source === 'bloomenergy')

  assert.ok(bloomenergy)
  assert.equal(bloomenergy.adapter, 'workday')
  assert.equal(bloomenergy.atsPlatform, 'workday')
  assert.match(bloomenergy.companyCareerPage, /bloomenergy\.com\/careers/i)
  assert.equal(bloomenergy.companyDomain, 'bloomenergy.com')
  assert.match(
    bloomenergy.baseUrl,
    /bloomenergy\.wd1\.myworkdayjobs\.com\/BloomEnergyCareers/i,
  )
})

test('buildScrapers exposes a runnable Bloom Energy Workday scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const bloomenergy = scrapers.find((scraper) => scraper.name === 'bloomenergy')

  assert.ok(bloomenergy)
  assert.equal(typeof bloomenergy.run, 'function')
  assert.match(bloomenergy.dryRunFile, /bloomenergy.workday[\\/]jobs\.json$/)
  assert.equal(bloomenergy.provider.source, 'bloomenergy')
  assert.equal(bloomenergy.provider.atsPlatform, 'workday')
})
