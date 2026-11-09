import assert from 'node:assert/strict'
import test from 'node:test'

import { CANDERE_CATALOG } from './catalog.js'
import { run } from './script.js'
import { readFileSync } from 'node:fs'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

test('Candere catalog identifies the verified Jobsoid careers surface', () => {
  assert.equal(CANDERE_CATALOG.source, 'candere')
  assert.equal(CANDERE_CATALOG.companyName, 'Candere')
  assert.equal(CANDERE_CATALOG.companyCareerPage, 'https://candere.jobsoid.com/')
  assert.equal(CANDERE_CATALOG.verifiedIndiaJobCount, 0)
})

test('Candere reports verified zero only after reading the official native empty board', async () => {
  const capture = JSON.parse(readFileSync(new URL('./evidence/careers-response.json', import.meta.url), 'utf8'))
  const jobs = await run({ fetchPage: async () => ({ status: capture.status, url: capture.finalUrl, html: capture.body }) })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
})
