import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Arista apiPortal provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const arista = catalog.find((provider) => provider.source === 'arista')

  assert.ok(arista)
  assert.equal(arista.adapter, 'apiPortal')
  assert.equal(arista.atsPlatform, 'smartrecruiters')
  assert.match(arista.companyCareerPage, /arista\.com\/en\/careers/i)
  assert.equal(arista.companyDomain, 'arista.com')
  assert.match(
    arista.config.discovery.listingApiUrl,
    /api\.smartrecruiters\.com\/v1\/companies\/AristaNetworks\/postings/i,
  )
})

test('buildScrapers exposes a runnable Arista apiPortal scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const arista = scrapers.find((scraper) => scraper.name === 'arista')

  assert.ok(arista)
  assert.equal(typeof arista.run, 'function')
  assert.match(arista.dryRunFile, /arista[\\/]jobs\.json$/)
  assert.equal(arista.provider.source, 'arista')
  assert.equal(arista.provider.atsPlatform, 'smartrecruiters')
})
