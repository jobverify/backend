import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createSafranEngineeringServicesIndiaScraper } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const packets = JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261110/public-responses.json.gz', import.meta.url))))
const run = change => createSafranEngineeringServicesIndiaScraper({ maxJobs: 1 }).run({
  fetchText: async url => {
    const packet = packets.find(packet => packet.requestUrl === url)
    assert.ok(packet, 'Unexpected native request: ' + url)
    return change ? change(packet.body, url) : packet.body
  },
})

test('current Safran div description sections retain responsibilities and mandatory qualifications', async () => {
  const jobs = await run()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '160766')
  assert.equal(jobs[0].country, 'India')
  assert.match(jobs[0].jobDescription, /RESPONSIBILITIES/)
  assert.match(jobs[0].jobDescription, /SKILLS AND EXPERIENCE REQUIRED/)
  assert.match(jobs[0].jobDescription, /8 years experience minimum/)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('a hidden description cannot be treated as complete Safran criteria', async () => {
  await assert.rejects(run((html, url) => url.endsWith('_160766.aspx')
    ? html.replace('id="fldjobdescription_description1"', 'hidden id="fldjobdescription_description1"')
      .replace('id="fldjobdescription_longtext2"', 'hidden id="fldjobdescription_longtext2"')
      .replace('id="fldjobdescription_description2"', 'hidden id="fldjobdescription_description2"') : html), /criteria|employer/)
})

test('hiding only mandatory qualifications cannot leave Safran marked as a complete role', async () => {
  await assert.rejects(run((html, url) => url.endsWith('_160766.aspx')
    ? html.replace('id="fldjobdescription_description2"', 'hidden id="fldjobdescription_description2"') : html), /hidden native|criteria/)
})
