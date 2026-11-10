import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { run, hasOfficialContactSignal } from './script.js'

const captures = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/current20261110.json.gz', import.meta.url))))
const fixtures = new Map([
  ['https://pantheondigitals.com/', 'home'],
  ['https://pantheondigitals.com/About', 'about'],
  ['https://pantheondigitals.com/Contact_Us', 'contact-old'],
  ['https://cutshort.io/company/pantheon-digital-96-46NMdJSa', 'cutshort'],
].map(([url, name]) => [url, captures[name]]))
const replay = async url => {
  if (/^https:\/\/pantheondigitals\.com\/(careers|jobs)$/.test(url)) throw new Error(`HTTP 404 for ${url}`)
  assert.ok(fixtures.has(url), `Unexpected URL ${url}`)
  return fixtures.get(url)
}

test('current canonical contact title permits exact Pantheon board extraction with full native criteria', async () => {
  const jobs = await run({ fetchText: replay, now: () => '2026-11-10T16:17:31.094Z' })
  assert.equal(jobs.length, 1)
  const [job] = jobs
  assert.equal(job.jobId, '68639d50a9c58fa0ff1a5f6d')
  assert.equal(job.company, 'Pantheon Digital Pvt Ltd')
  assert.equal(job.title, 'International Sales Executive')
  assert.equal(job.location, 'Delhi, India')
  assert.equal(job.country, 'India')
  assert.equal(job.sourceUrl, 'https://cutshort.io/job/International-Sales-Executive-Delhi-pantheon-digital-CJhfL7as')
  assert.equal(job.applyUrl, 'https://cutshort.io/profile/view/j/68639d50a9c58fa0ff1a5f6d')
  assert.match(job.jobDescription, /Company: Pantheon Digital Pvt\. Ltd/)
  assert.match(job.jobDescription, /Prior experience in the Australian energy process or international voice sales is a must/)
  assert.match(job.jobDescription, /Let’s power up your career with Pantheon Digital!$/)
  const native = captures.nativeRole
  assert.equal(native.identifier.value, job.jobId)
  assert.equal(native.jobLocation.address.addressCountry, 'IN')
  assert.equal(native.jobLocation.address.addressLocality, 'Delhi')
  assert.equal(native.validThrough, '2026-12-24T04:44:18.707Z')
  const nativeText = native.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  assert.equal(job.jobDescription, nativeText)
})

test('canonical contact metadata still refuses changed company, domain and location anchors', async () => {
  const contact = captures['contact-old']
  for (const changed of [
    contact.replace('<title>Contact Us | Pantheon Digital</title>', '<title>Contact Us | Another Company</title>'),
    contact.replace('content="https://pantheondigitals.com/contact-us"', 'content="https://example.com/contact-us"'),
    contact.replace('property="og:site_name" content="Pantheon Digital"', 'property="og:site_name" content="Another Company"'),
    contact.replaceAll('connect with our Saket, New Delhi team', 'connect with our unidentified team'),
  ]) assert.equal(hasOfficialContactSignal(changed), false)
})
