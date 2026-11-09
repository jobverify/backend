import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { TURTLEMINT_CATALOG } from '../../scraper/turtlemint/catalog.js'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Turtlemint has an exact-match first-party provider and rejects substitutions', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'turtlemint')

  assert.ok(provider, 'Expected Turtlemint provider in scraper catalog')
  assert.equal(provider.companyName, 'Turtlemint')
  assert.equal(provider.exactCompanyMatchOnly, true)
  assert.equal(provider.companyDomain, 'turtlemint.com')

  const report = generateCompanyCoverageReport({
    csvText: 'Turtlemint\nTurtlemint Fintech Solutions Limited\n',
    catalog,
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.matched[0].source, 'turtlemint')
  assert.deepEqual(report.unmatched.map((item) => item.companyName), [
    'Turtlemint Fintech Solutions Limited',
  ])
})

test('Turtlemint scraper stays fail-closed when the official careers page has no active openings', async () => {
  const scraper = buildScrapers().find((item) => item.name === 'turtlemint')

  assert.ok(scraper, 'Expected Turtlemint scraper')
  const capture = JSON.parse(readFileSync(new URL('../../scraper/turtlemint/fixtures/careers-response.json', import.meta.url)))
  const jobs = await scraper.run({ fetchPage: async () => ({ status: capture.status, url: capture.finalUrl, html: capture.body }) })
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
  assert.equal(TURTLEMINT_CATALOG.inventoryVerificationPolicy, 'live-parser-evidence-required')
  assert.equal(TURTLEMINT_CATALOG.verifiedOn, '2026-10-23')
})
