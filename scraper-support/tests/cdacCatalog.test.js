import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes C-DAC with its official organization-wide careers source', () => {
  const cdac = getScraperCatalog().find((provider) => provider.source === 'cdac')

  assert.ok(cdac)
  assert.equal(cdac.companyName, 'C-DAC')
  assert.equal(cdac.adapter, 'script')
  assert.equal(cdac.atsPlatform, 'official-company-careers')
  assert.equal(cdac.companyCareerPage, 'https://cdac.in/index.aspx?id=current_jobs')
  assert.equal(cdac.companyDomain, 'cdac.in')
})

test('buildScrapers exposes the C-DAC scraper through the existing runner contract', () => {
  const cdac = buildScrapers().find((scraper) => scraper.name === 'cdac')

  assert.ok(cdac)
  assert.equal(typeof cdac.run, 'function')
  assert.match(cdac.dryRunFile, /cdac[\\/]jobs\.json$/)
})
