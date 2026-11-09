import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the AVASOFT careers page script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'avasoft')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.match(provider.companyCareerPage, /avasoft\.com\/career/i)
  assert.equal(provider.verifiedOn, null)
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.zeroResultPolicy, 'evidence-required')
  assert.equal(provider.verifiedPublicPostingCount, null)
  assert.equal(provider.verifiedIndiaRoleCount, null)
})

test('buildScrapers exposes a runnable AVASOFT scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const scraper = scrapers.find((item) => item.name === 'avasoft')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /avasoft[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'avasoft')
})

test('Avasoft local metadata records current native visibility, content and career-enquiry rules', async () => {
  const { AVASOFT_CATALOG } = await import('../../scraper/avasoft/catalog.js')
  const { PROVIDER_METADATA } = await import('../../scraper/avasoft/script.js')
  assert.equal(PROVIDER_METADATA, AVASOFT_CATALOG)
  assert.equal(AVASOFT_CATALOG.applicationStrategy, 'role-declared-contact-page+verified-career-enquiry')
  assert.equal(AVASOFT_CATALOG.verifiedIndiaRoleCount, null)
  assert.match(AVASOFT_CATALOG.verifiedSurfaceSummary, /hidden.*breakpoints/i)
  assert.match(AVASOFT_CATALOG.verifiedSurfaceSummary, /unknown.*publication/i)
})
