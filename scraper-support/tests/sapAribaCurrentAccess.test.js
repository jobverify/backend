import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import * as source from '../../scraper/sapariba/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
const directory = new URL('./fixtures/sapariba/', import.meta.url)
const challenge = readFileSync(new URL('current-official-careers403.html', directory), 'utf8')

test('SAP Ariba preserves the upstream403 status instead of reporting an unverified baseline migration', async () => {
  await assert.rejects(source.run({ fetchPage: async () => ({ status: 403, url: 'https://jobs.sap.com/?locale=en_US', html: challenge }) }), /HTTP 403.*jobs\.sap\.com/i)
})

test('SAP Ariba generic parent discovery is never complete zero-inventory evidence', async () => {
  const generic = '<title>Jobs at SAP | SAP Careers</title><label>Search by keyword</label><label>Search by location</label>'
  const jobs = await source.run({ fetchPage: async (url) => ({ status: 200, url, html: generic }) })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.equal(readInventoryEvidence(jobs)?.status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, null)
  assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount, null)
})

test('SAP Ariba observes cancellation before contacting the public careers page', async () => {
  const controller = new AbortController()
  controller.abort(new Error('cancel SAP Ariba request'))
  let fetched = false
  await assert.rejects(source.run({ signal: controller.signal, fetchPage: async () => { fetched = true } }), /cancel SAP Ariba request/)
  assert.equal(fetched, false)
})
