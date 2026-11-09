import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const loadCodemonkModule = async () => {
  try {
    return await import('../../scraper/codemonk/script.js')
  } catch {
    return null
  }
}

const careersHtml = `
  <a class="flex flex-wrap justify-between items-center" target="_blank" href="/careers/qa-intern-E3A2655F70">
    <div>
      <div class="font-semibold">QA Intern</div>
      <div class="mt-2 text-gray-600">Bengaluru, Karnataka, India | Experience entry-level</div>
    </div>
    <button class="button-secondary">Apply</button>
  </a>
  <a class="flex flex-wrap justify-between items-center" target="_blank" href="/careers/backend-intern-(django)-4039481B76">
    <div>
      <div class="font-semibold">Backend Intern (Django)</div>
      <div class="mt-2 text-gray-600">Bangalore Urban, Karnataka, India | Experience entry-level</div>
    </div>
    <button class="button-secondary">Apply</button>
  </a>
  <a class="flex flex-wrap justify-between items-center" target="_blank" href="/careers/sales-intern-83F72CA009">
    <div>
      <div class="font-semibold">Sales Intern</div>
      <div class="mt-2 text-gray-600">Bengaluru, Karnataka, India | Experience entry-level</div>
    </div>
    <button class="button-secondary">Apply</button>
  </a>
  <a class="flex flex-wrap justify-between items-center" target="_blank" href="/careers/business-development-executive--it-staffing-D24FF6E4F2">
    <div>
      <div class="font-semibold">Business Development Executive -IT Staffing</div>
      <div class="mt-2 text-gray-600">Bengaluru, Karnataka, India | Experience mid-senior-level</div>
    </div>
    <button class="button-secondary">Apply</button>
  </a>
`

test('extractCareerListings maps official Codemonk career cards to India job listings', async () => {
  const codemonk = await loadCodemonkModule()
  assert.ok(codemonk)

  const jobs = codemonk.extractCareerListings(careersHtml)

  assert.equal(jobs.length, 4)
  assert.deepEqual(jobs[0], {
    title: 'QA Intern',
    company: 'Codemonk',
    department: null,
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    jobId: 'qa-intern-E3A2655F70',
    requisitionId: 'qa-intern-E3A2655F70',
    sourceUrl: 'https://codemonk.io/careers/qa-intern-E3A2655F70',
    applyUrl: 'https://codemonk.io/careers/qa-intern-E3A2655F70',
    employmentType: null,
    experienceRequired: 'entry-level',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    remoteStatus: 'On-site',
  })
  assert.equal(jobs[1].city, 'Bangalore Urban')
  assert.equal(jobs[3].experienceRequired, 'mid-senior-level')
})

test('run recovers eight retained native India records while keeping source coverage incomplete', async () => {
  const codemonk = await loadCodemonkModule()
  assert.ok(codemonk)

  const archive = JSON.parse(gunzipSync(readFileSync(
    new URL('../../scraper/codemonk/fixtures/retained-http-20261029.json.gz', import.meta.url),
  )))
  const bytes = Buffer.from(archive.bodyBase64, 'base64')
  assert.equal(createHash('sha256').update(bytes).digest('hex'), archive.receipt.sha256)
  const html = bytes.toString('utf8'), requestedUrls = [], audits = []
  const controller = new AbortController()
  const jobs = await codemonk.run({
    signal: controller.signal,
    fetchText: async (url, { signal }) => {
      assert.equal(signal, controller.signal)
      requestedUrls.push(url)
      if (url !== archive.receipt.url) throw Error('Native application not retained in this listing-only archive')
      return html
    },
    onAudit: audit => audits.push(audit),
  })

  assert.equal(requestedUrls[0], 'https://codemonk.io/careers')
  assert.equal(requestedUrls.length, 9)
  assert.equal(jobs.length, 8)
  assert.ok(jobs.every(job => job.country === 'India' && job.sourceDetailComplete === false))
  assert.ok(jobs.every(job => job.sourceListingDescriptionComplete === true && job.sourceDeclaredCriteriaCopyComplete === false))
  assert.deepEqual(new Set(requestedUrls.slice(1)), new Set(jobs.map(job => job.sourceNativeRecord.apply_link)))
  assert.ok(jobs.every(job => job.jobDescription && job.sourceNativeDescription && job.sourceNativeRecord))
  assert.ok(jobs.every(job => job.postingDate === null && job.legalHiringEmployer === null))
  assert.equal(jobs[0].source, 'codemonk')
  assert.equal(jobs[0].link, jobs[0].sourceNativeRecord.apply_link)
  assert.equal(jobs[0].company, 'Codemonk')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
  assert.equal(audits.length, 1)
  assert.equal(audits[0].originalNativeHTML, html)
  assert.equal(audits[0].observedIndiaRecords, 8)
  assert.equal(audits[0].renderedRoleIds.length, 2)
  assert.equal(audits[0].unrenderedNativeRoleIds.length, 6)
  assert.equal(audits[0].currentLiveQualification, false)
  assert.equal(audits[0].lifecycleCleanupAllowed, false)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
})
