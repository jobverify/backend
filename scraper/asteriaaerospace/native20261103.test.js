import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { run, CAREERS_URL } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'
import { buildDescriptionSourceUpdate } from '../../src/services/jobDescriptionPolicy.js'

const native = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-20261103.json.gz', import.meta.url))))
const EMBED = 'https://asteria.keka.com/careers/api/embedjobs/276cea58-0e7a-4134-872d-84be59f84fe7'
const ACTIVE = 'https://asteria.keka.com/careers/api/embedjobs/default/active/276cea58-0e7a-4134-872d-84be59f84fe7'
const IDENTITY = 'https://asteria.keka.com/careers/api/organization/default/careerportalinfo'
const LEGACY = 'https://asteria.kekahire.com/api/embed/jobs/276cea58-0e7a-4134-872d-84be59f84fe7'
const replay = ({ unknownCountry, drift, wrongIdentity, hiddenHandoff, activeLegacy } = {}) => {
  let reads = 0
  return {
    fetchText: async url => {
      if (url === CAREERS_URL) {
        let html = hiddenHandoff ? native.company.replace(EMBED, EMBED.replace('asteria.keka', 'other.keka')) : native.company
        if (activeLegacy) html += '<iframe src="'+LEGACY+'"></iframe>'
        return html
      }
      if (url === EMBED) return native.embed
      if (url === LEGACY) throw new TypeError('fetch failed', { cause: { code: 'CERT_HAS_EXPIRED' } })
      assert.fail(url)
    },
    fetchJson: async url => {
      if (url === IDENTITY) return { ...native.identity, ...(wrongIdentity ? { name: 'Another company' } : {}) }
      assert.equal(url, ACTIVE)
      const rows = structuredClone(native.jobs)
      if (++reads === 2 && drift) rows[0].description += '<p>Changed native requirements.</p>'
      if (unknownCountry) rows[0].jobLocations[0].countryCode = ''
      return rows
    },
  }
}

test('Asteria recovers all five full typed India roles and ignores the commented obsolete iframe', async () => {
  const jobs = await run(replay())
  assert.equal(jobs.length, 5)
  assert.ok(jobs.every(row => row.country === 'India' && row.sourceDetailComplete))
  assert.ok(jobs.every(row => row.sourceUrl === 'https://asteria.keka.com/careers/jobdetails/'+row.jobId))
  assert.equal(jobs.find(row => row.jobId === '145710').postingDate, null)
  assert.equal(jobs.find(row => row.jobId === '145710').requisitionId, 'AAL-REQ-00713')
  assert.match(jobs.find(row => row.jobId === '142064').jobDescription, /Fixed-Term Contract/)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 5)
  assert.equal(jobs[0].nativeCollectionEvidence.channelGaps.length, 0)
  assert.equal(jobs[0].nativeCollectionEvidence.modernBoardListingComplete,true)
  assert.equal(jobs[0].nativeCollectionEvidence.sourceScopeComplete,false)
  assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
  assert.ok(jobs.every(job=>job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false&&job.applicationVisited===false))
  for (const row of jobs) assert.doesNotThrow(() => buildDescriptionSourceUpdate(normalizeScrapedJob(row, { source: 'asteriaaerospace', companyName: row.company }), null))
})

test('an additional active iframe with expired TLS retains its actual coverage gap', async () => {
  const jobs = await run(replay({ activeLegacy: true }))
  assert.equal(jobs.length, 5)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /CERT_HAS_EXPIRED/)
})

test('Asteria does not infer a country from Bangalore when the role country code is absent', async () => {
  const jobs = await run(replay({ unknownCountry: true }))
  assert.equal(jobs.length, 4)
  assert.equal(jobs.some(row => row.jobId === '145710'), false)
  assert.equal(jobs[0].nativeCollectionEvidence.failures.length, 1)
})

test('Asteria detects closing full-criteria changes independently from unchanged IDs', async () => {
  const jobs = await run(replay({ drift: true }))
  assert.equal(jobs[0].nativeCollectionEvidence.closingInventoryMatches, false)
})

test('Asteria refuses another employer portal and a changed official iframe', async () => {
  await assert.rejects(run(replay({ wrongIdentity: true })), /identity/)
  await assert.rejects(run(replay({ hiddenHandoff: true })), /handoff|public jobs|surface/)
})

test('Asteria caller cancellation settles injected native fetchers which ignore their signal', async () => {
  const controller = new AbortController(), reason = Error('stop Asteria')
  const options = replay()
  options.fetchJson = () => { controller.abort(reason); return new Promise(() => {}) }
  await assert.rejects(run({ ...options, signal: controller.signal }), error => error === reason)
})

test('Asteria cancellation also settles the initial corporate fetch override', async () => {
  const controller = new AbortController(), reason = Error('stop initial Asteria read')
  await assert.rejects(run({ signal: controller.signal, fetchText: () => { controller.abort(reason); return new Promise(() => {}) } }), error => error === reason)
})
