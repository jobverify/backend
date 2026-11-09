import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import * as scraper from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = name => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')

test('OYO booking redesign preserves the exact LinkedIn careers handoff', async () => {
  const html = fixture('oyo-home.html')
  assert.equal(scraper.hasOfficialHomepageSignal(html), true)
  assert.deepEqual(await scraper.run({ fetchPage: async () => ({ status:200, url:scraper.HOMEPAGE_URL, html }) }), [])
  await assert.rejects(scraper.run({ fetchPage: async () => ({ status:200, url:scraper.HOMEPAGE_URL, html:html.replaceAll('https://www.linkedin.com/company/oyo-rooms/jobs/', 'https://www.linkedin.com/company/unrelated/jobs/') }) }), /handoff changed/)
})


test('OYO first-party handoff remains discovery-only until linked inventory is complete', async () => {
  const html = fixture('oyo-home.html')
  const jobs = await scraper.run({ fetchPage: async () => ({ status:200, url:scraper.HOMEPAGE_URL, html }) })
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'discovery-only')
  assert.equal(evidence?.listingComplete, false)
  assert.match(evidence?.reason || '', /LinkedIn.*inventory/i)
})
