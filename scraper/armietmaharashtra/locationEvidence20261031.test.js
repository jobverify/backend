import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import * as source from './script.js'
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./nativeEvidence/location-cohort-20261031.json.gz', import.meta.url))))
const [packet] = fixture.packets
assert.equal(crypto.createHash('sha256').update(packet.body).digest('hex'), packet.sha256)
const replay = async ({ mutate, registered = false, signal } = {}) => {
  const operation = registered ? createCatalogScraper(getScraperCatalog().find(row => row.source === 'armietmaharashtra')).run : source.run
  return operation({ signal, fetchText: async url => { assert.equal(url, source.CAREERS_URL); return mutate ? mutate(packet.body) : packet.body } })
}

test('registered ARMIET keeps four native role-column adverts and excludes three unrelated footer/contact H4s', async () => {
  const jobs = await replay({ registered: true })
  assert.deepEqual(jobs.map(job => job.title), ['Assistant Professor (Engineering)', 'Training and Placement Officers (TPO)',
    'Assistant Professor (MBA/MMS)', 'Accountant'])
  assert.deepEqual(jobs.map(job => job.location), ['Asangoan ARMIET, A.S. Rao Nagar, Vill-Sapgaon',
    'Asangaon ARMIET, A.S. Rao Nagar, Vill-Sapgaon, Tal-Shahpur, Dist-Thane', 'Thane & Asangoan', 'Thane'])
  for (const job of jobs) {
    assert.equal(job.country, null)
    assert.equal(job.city, null)
    assert.equal(job.requisitionId, null)
    assert.equal(job.jobId, null)
    assert.equal(job.sourceUrl, source.CAREERS_URL)
    assert.equal(job.applyUrl, source.APPLY_URL)
    assert.equal(job.sourceDetailComplete, false, 'The advert has no independently supplied full JD')
  }
  assert.match(jobs[0].jobDescription, /Salary Package/)
  assert.match(jobs[0].jobDescription, /Teaching Location/)
  assert.doesNotMatch(jobs[3].jobDescription, /IMPORTANT LINKS|Training & Placement Cell|send your resume/)
  assert.equal(readSourceObservationEvidence(jobs, 'armietmaharashtra')?.observedVacancyCount, 4)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.equal(readInventoryEvidence(jobs)?.verifiedAt, null)
})

test('an extra outside-column role-area heading cannot become an ARMIET vacancy', async () => {
  const jobs = await replay({ mutate: html => html.replace(/<\/body>/i, '<h4>Engineering opportunities</h4><p>Join our team in India</p></body>') })
  assert.equal(jobs.length, 4)
  assert.ok(jobs.every(job => !/opportunities/i.test(job.title)))
})

test('ARMIET keeps an otherwise genuine role with missing work-location text and never fills from interview/head-office address', async () => {
  const jobs = await replay({ mutate: html => html.replace('Teaching Location:', 'Other native field:') })
  assert.equal(jobs.length, 4)
  assert.equal(jobs[0].location, null)
  assert.equal(jobs[0].country, null)
  assert.match(jobs[0].jobDescription, /Walk-in Interview/)
})

for (const css of ['.wp-block-columns{display:none}', 'body{opacity:0}']) test('ARMIET cannot certify roles hidden by ' + css, async () => {
  await assert.rejects(replay({ mutate: html => html.replace(/<head\b[^>]*>/i, '$&<style>' + css + '</style>') }), /ARMIET.*(?:visible|active|role|careers)/i)
})

test('an inert remembered ARMIET application URL cannot replace a changed visible application anchor', async () => {
  await assert.rejects(replay({ mutate: html => html.replaceAll(source.APPLY_URL, 'https://forms.gle/other-employer-form')
    .replace(/<\/body>/i, '<!-- ' + source.APPLY_URL + ' --></body>') }), /ARMIET.*(?:apply|application|surface|careers)/i)
})

test('ARMIET caller cancellation is prompt and preserves an immutable reason', async () => {
  const controller = new AbortController(), reason = Object.freeze(new Error('ARMIET caller stopped'))
  controller.abort(reason)
  await assert.rejects(replay({ signal: controller.signal }), error => error === reason)
})
