import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('registers Da Vinci Trading against its official careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'davincitrading')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Da Vinci Trading')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://davincitrading.com/careers/')
  assert.equal(provider.atsPlatform, 'greenhouse-eu+first-party-careers')
  assert.equal(provider.greenhouseBoardToken, 'davinciderivatives')
  assert.equal(provider.nativeBoardUrl, 'https://job-boards.eu.greenhouse.io/davinciderivatives')
  assert.equal(provider.verifiedOn, '2026-10-26')
  assert.equal(provider.zeroResultPolicy, 'evidence-required')
  assert.equal(provider.verifiedIndiaRoleCount, null)
  assert.equal(provider.companyDomain, 'davincitrading.com')
  assert.equal(companyAliases['Da Vinci Trading'], 'davincitrading')
})

test('buildScrapers exposes a runnable Da Vinci Trading scraper', () => {
  const scraper = buildScrapers().find((item) => item.name === 'davincitrading')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /davincitrading[\\/]jobs\.json$/i)
})

test('Da Vinci local metadata describes the current employer-bound native inventory contract', async () => {
  const { DAVINCI_TRADING_CATALOG } = await import('../../scraper/davincitrading/catalog.js')
  const { PROVIDER_METADATA } = await import('../../scraper/davincitrading/script.js')
  assert.equal(PROVIDER_METADATA, DAVINCI_TRADING_CATALOG)
  assert.equal(DAVINCI_TRADING_CATALOG.nativeBoardId, 4000939101)
  assert.equal(DAVINCI_TRADING_CATALOG.verifiedPublicPostingCount, null)
  assert.match(DAVINCI_TRADING_CATALOG.paginationStrategy, /50-row.*closing/)
  assert.match(DAVINCI_TRADING_CATALOG.verifiedSurfaceSummary, /original.*publication/i)
})
