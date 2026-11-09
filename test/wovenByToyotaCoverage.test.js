import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../scraper-support/providers/index.js'

const COMPANY_CSV_TEXT = "company_name\nWoven by Toyota\n"

test('Woven by Toyota is covered only by its exact-name first-party provider', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'wovenbytoyota')
  const report = generateCompanyCoverageReport({
    csvText: COMPANY_CSV_TEXT,
    catalog,
  })
  const nearNameReport = generateCompanyCoverageReport({
    csvText: 'company_name\nWoven Toyota\nToyota Woven\n',
    catalog,
  })

  assert.ok(provider, 'Expected Woven by Toyota provider extension in the scraper catalog')
  assert.equal(provider.companyName, 'Woven by Toyota')
  assert.equal(provider.companyDomain, 'woven.toyota')
  assert.equal(provider.exactCompanyMatchOnly, true)
  assert.deepEqual(
    report.matched.filter((item) => item.companyName === 'Woven by Toyota').map((item) => item.source),
    ['wovenbytoyota'],
  )
  assert.equal(nearNameReport.matchedCount, 0)
  assert.equal(nearNameReport.unmatchedCount, 2)
})

test('Woven by Toyota provider retains verified native inventory after live handoff validation', async () => {
  const scraper = buildScrapers().find((item) => item.name === 'wovenbytoyota')

  assert.ok(scraper, 'Expected Woven by Toyota scraper to be built from its provider extension')
  const root = new URL('../scraper/wovenbytoyota/fixtures/', import.meta.url)
  const official = JSON.parse(readFileSync(new URL('careers-response.json', root)))
  const clients = JSON.parse(readFileSync(new URL('client-api-responses.json', root)))
  const pages = JSON.parse(readFileSync(new URL('listing-responses.json', root)))
  const jobs = await scraper.run({ fetchPage: async url => {
    const page = [official, ...clients].find(page => page.url === url)
    if (!page) throw new Error('Unrecorded unrelated client chunk')
    return { status: page.status, url, html: page.body }
  }, fetchJson: async url => {
    const page = pages.find(page => page.url === url)
    assert.ok(page, 'Expected captured native page')
    return JSON.parse(page.body)
  } })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 148)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})
