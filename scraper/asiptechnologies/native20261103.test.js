import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { CAREERS_PAGE_URL, createAsipTechnologiesScraper, extractListings } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'

const manifest = JSON.parse(fs.readFileSync(new URL('./test-data/manifest-20261103.json', import.meta.url)))
const pages = new Map(manifest.files.map(row => [row.url, gunzipSync(fs.readFileSync(new URL('./test-data/' + row.file, import.meta.url))).toString('utf8')]))
const career = pages.get(CAREERS_PAGE_URL)
const clock = () => '2026-11-03T01:00:00.000Z'

function explicitIndia(html) {
  return html.replace(/"address"\s*:\s*"Hyderabad"/g, '"address":{"@type":"PostalAddress","addressLocality":"Hyderabad","addressCountry":"IN"}')
}

async function observe(transform = (_url, html) => html, options = {}) {
  const audits = [], requests = [], records = []
  const jobs = await createAsipTechnologiesScraper().run({ now: clock,
    fetchText: async (url, init) => {
      requests.push(url)
      assert.ok(pages.has(url), 'only the declared public role pages may be read')
      return transform(url, pages.get(url), init)
    }, onAudit: audit => audits.push(audit), onRecords: rows => records.push(rows), ...options })
  return { jobs, audits, requests, records }
}

test('current native cards recover all four publisher IDs without inventing country or requisition IDs', () => {
  const rows = extractListings(career)
  assert.deepEqual(rows.map(row => row.jobId), ['326', '324', '322', '270'])
  assert.ok(rows.every(row => row.country === null && row.requisitionId === null && row.location === 'Hyderabad'))
  assert.equal(rows.at(-1).title, 'DFT Architect, Sr. DFT Engineer, DFT Engineer')
})

test('all native criteria and original publication dates survive while missing job countries stay outside persistence', async () => {
  const { jobs, audits, records } = await observe()
  assert.equal(jobs.length, 0)
  assert.equal(audits.length, 1)
  assert.equal(records[0].length, 4)
  assert.equal(readSourceObservationEvidence(jobs, 'asiptechnologies').observedVacancyCount, 4)
  const eol = records[0].find(row => row.jobId === '326')
  const description = extractActiveDescription(eol.jobDescription)
  assert.ok(description.includes('Prepare and present weekly/monthly reports'))
  assert.ok(description.includes('Strong leadership, communication, and problem-solving skills.'))
  assert.equal(eol.jobDescription, eol.sourceNativeDescriptionHTML)
  assert.ok(!eol.jobDescription.includes('Upload CV/Resume'))
  assert.equal(eol.postingDate, '2025-02-27T16:27:38+00:00')
  assert.equal(eol.country, null)
  assert.equal(eol.sourceDetailComplete, true)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

test('a native typed job country qualifies a role without using office footer addresses', async () => {
  const { jobs } = await observe((_url, html) => explicitIndia(html))
  assert.equal(jobs.length, 4)
  assert.ok(jobs.every(row => row.country === 'India' && row.city === 'Hyderabad' && row.requisitionId === null))
  assert.ok(jobs.every(row => row.sourceDetailComplete === true && row.sourceListingComplete === false && row.lifecycleCleanupAllowed === false))
})

test('a wrong native detail identity cannot replace a listing and does not discard the other three observations', async () => {
  const { jobs, audits, records } = await observe((url, html) => url.includes('front-of-line') ? pages.get('https://asip-tech.com/career/end-of-line-eol-manager/') : html)
  assert.equal(jobs.length, 0)
  assert.equal(records[0].filter(row => row.sourceDetailComplete).length, 3)
  assert.equal(audits[0].detailFailures.length, 1)
  assert.equal(audits[0].detailFailures[0].jobId, '324')
})

test('hidden and commented duplicate native cards do not create new vacancies', () => {
  const card = career.match(/<div class="awsm-job-listing-item awsm-grid-item" id="awsm-grid-item-326">[\s\S]*?<\/a><\/div>/)[0]
  const changed = career.replace('</body>', `<div hidden>${card}</div><!-- ${card} --></body>`)
  assert.equal(extractListings(changed).length, 4)
})

test('an advertised role removed from the closing page is held while the other typed India roles survive', async () => {
  let listingReads = 0
  const { jobs, audits } = await observe((url, html) => {
    if (url === CAREERS_PAGE_URL && ++listingReads === 2) html = html.replace(/<div class="awsm-job-listing-item awsm-grid-item" id="awsm-grid-item-326">[\s\S]*?<\/a><\/div>/, '')
    return explicitIndia(html)
  })
  assert.equal(jobs.length, 3)
  assert.ok(jobs.every(row => row.jobId !== '326'))
  assert.equal(audits[0].listingStable, false)
})

test('caller cancellation propagates before any source I/O', async () => {
  const controller = new AbortController(), reason = Error('stop ASIP source')
  controller.abort(reason)
  let calls = 0
  await assert.rejects(observe((_url, html) => { calls++; return html }, { signal: controller.signal }), error => error === reason)
  assert.equal(calls, 0)
})

test('cancellation settles an audit observer that never resolves', async () => {
  const controller = new AbortController(), reason = Error('stop ASIP audit')
  let timer
  try {
    const pending = observe(undefined, { signal: controller.signal, onAudit: () => { controller.abort(reason); return new Promise(() => {}) } })
    await assert.rejects(Promise.race([pending, new Promise((_resolve, reject) => { timer = setTimeout(() => reject(Error('audit still pending')), 400) })]), error => error === reason)
  } finally { clearTimeout(timer) }
})
