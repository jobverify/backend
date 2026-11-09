import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createAkhilSystemsScraper } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const captures = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-inputs/surface-20261102.json.gz', import.meta.url))))
const fetchPage = async url => {
  const row = captures.find(row => row.requestedUrl === url)
  assert.ok(row, 'unrecorded request ' + url)
  return { status: row.status, url: row.finalUrl, html: row.html }
}

test('reads all five current Akhil jobs and complete descriptions from the public lazy client data', async () => {
  const jobs = await createAkhilSystemsScraper().run({ fetchPage })
  assert.equal(jobs.length, 5)
  assert.equal(jobs[0].title, 'Lead- Scrum Master')
  assert.ok(jobs.every(job => job.jobDescription.length > 300 && job.city === 'Gurgaon' && job.location === 'Gurugram, India'))
  assert.match(jobs[0].jobDescription, /MERN Stack/)
  assert.match(jobs[0].jobDescription, /changing priorities/)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, true)
})

test('rejects executable expressions in the Akhil client model instead of evaluating downloaded code', async () => {
  await assert.rejects(createAkhilSystemsScraper().run({ fetchPage: async url => {
    const page = await fetchPage(url)
    if (/08iff5s54kofl/.test(url)) page.html = page.html.replaceAll('(0,i.jsx)(', 'globalThis.attack(')
    return page
  } }), /static|model|unsupported|data/i)
})
