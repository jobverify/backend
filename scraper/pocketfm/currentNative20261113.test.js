import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { decorateJobsWithProviderMetadata, getScraperCatalog } from '../../scraper-support/providers/index.js'
import { assessSoftFailureAcquisition } from '../../scripts/softFailureAssessment20261113.mjs'

const packets = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-20261113.json.gz', import.meta.url)))).packets
const FINANCE = '5b82d0d8-4ca5-4d87-ad95-eb5b8e5fb9c8'
const replay = async (mutate = () => {}) => {
  const original = globalThis.fetch, visits = new Map()
  globalThis.fetch = async input => {
    const url = String(input), packet = structuredClone(packets.find(row => row.requestedUrl === url))
    assert.ok(packet, 'actual captured public URL ' + url)
    const visit = (visits.get(url) || 0) + 1
    visits.set(url, visit)
    mutate(packet, url, visit)
    const response = new Response(packet.html, { status: packet.status })
    Object.defineProperty(response, 'url', { value: packet.url })
    return response
  }
  try { return await run() } finally { globalThis.fetch = original }
}

test('Pocket FM current client retains two full original India roles, native salary and public policy through closing', async () => {
  const jobs = await replay(), finance = jobs.find(job => job.jobId === FINANCE)
  assert.equal(jobs.length, 2)
  assert.ok(jobs.every(job => job.country === 'India' && job.sourceDetailComplete))
  assert.match(finance.jobDescription, /2-4 years of hands-on experience/)
  assert.match(finance.jobDescription, /30,00,000/)
  assert.match(finance.jobDescription, /artificial intelligence/)
  assert.equal(finance.sourceNativeRecord.country, 'IN')
  assert.equal(finance.sourceScopeComplete, false)
  assert.equal(finance.lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 15)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  const provider = getScraperCatalog().find(row => row.source === 'pocketfm')
  const decorated = decorateJobsWithProviderMetadata(jobs, provider), assessment = assessSoftFailureAcquisition(provider, decorated)
  assert.equal(decorated.nativeCollectionEvidence.observedDetails.length, 2)
  assert.equal(assessment.runnerOutcome.success, true)
  assert.equal(assessment.cleanupOptions.replaceExisting, false)
})

test('Pocket FM disabled native fieldset holds its otherwise unchanged India role', async () => {
  const jobs = await replay((packet, url) => {
    if (url.endsWith('/' + FINANCE + '/apply')) {
      const original = packet.html
      packet.html = original.replace(/(<form\b[^>]*id="application-form"[^>]*>)/, '$1<fieldset disabled>')
        .replace('</form>', '</fieldset></form>')
      assert.notEqual(packet.html, original)
    }
  })
  assert.equal(jobs.some(job => job.jobId === FINANCE), false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})

test('Pocket FM concealed original native body text cannot qualify from API text alone', async () => {
  const jobs = await replay((packet, url) => {
    if (url.endsWith('/' + FINANCE)) {
      const original = packet.html
      packet.html = original.replace('data-qa="job-description"', 'style="opacity:0" data-qa="job-description"')
      assert.notEqual(packet.html, original)
    }
  })
  assert.equal(jobs.some(job => job.jobId === FINANCE), false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})

test('Pocket FM existing native CSS hiding an individual authored requirement holds that role', async () => {
  const jobs = await replay((packet, url) => {
    if (url.endsWith('/' + FINANCE)) {
      assert.match(packet.html, /\.hidden\s*\{\s*display:\s*none\s*!important/)
      const original = packet.html
      packet.html = original.replace('2-4 years of hands-on experience', '<span class="hidden">2-4 years of hands-on experience</span>')
      assert.notEqual(packet.html, original)
    }
  })
  assert.equal(jobs.some(job => job.jobId === FINANCE), false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})

test('Pocket FM a read-only required native name field holds that role', async () => {
  const jobs = await replay((packet, url) => {
    if (url.endsWith('/' + FINANCE + '/apply')) {
      const original = packet.html
      packet.html = original.replace(/(<input\b[^>]*\bname="name")/, '$1 readonly')
      assert.notEqual(packet.html, original)
    }
  })
  assert.equal(jobs.some(job => job.jobId === FINANCE), false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})

for (const [label, mutate] of [
  ['additional native description body', row => { row.descriptionBody += '<p>Mandatory security clearance.</p>' }],
  ['additional native plain criteria', row => { row.additionalPlain = 'Mandatory security clearance.' }],
  ['raw native criteria subtree', row => { row.description += '<script type="application/json">Mandatory security clearance.</script>' }],
  ['nested native salary criteria', row => { row.salaryRange.mandatoryRequirement = 'Mandatory security clearance.' }],
]) test('Pocket FM unpaired ' + label + ' holds the affected India role and retains every native field', async () => {
  const jobs = await replay((packet, url) => {
    if (!url.includes('api.lever.co')) return
    const rows = JSON.parse(packet.html), row = rows.find(row => row.id === FINANCE)
    mutate(row); packet.html = JSON.stringify(rows)
  })
  assert.equal(jobs.some(job => job.jobId === FINANCE), false)
  assert.equal(jobs.length, 1, 'The independently qualified sibling remains available')
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.match(JSON.stringify(jobs.nativeCollectionEvidence.opening.find(row => row.id === FINANCE)), /Mandatory security clearance/)
})

for (const [label, mutate] of [
  ['unhandled schema criteria', schema => { schema.mandatoryRequirements = 'Mandatory security clearance.' }],
  ['conflicting native employment terms', schema => { schema.employmentType = 'Contract' }],
]) test('Pocket FM ' + label + ' cannot be omitted from a complete India detail', async () => {
  const jobs = await replay((packet, url) => {
    if (!url.endsWith('/' + FINANCE)) return
    const original = packet.html
    packet.html = packet.html.replace(/(<script[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/,
      (_, start, value, end) => { const schema = JSON.parse(value); mutate(schema); return start + JSON.stringify(schema) + end })
    assert.notEqual(packet.html, original)
  })
  assert.equal(jobs.some(job => job.jobId === FINANCE), false)
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})

test('Pocket FM final native membership after closing details holds a removed role', async () => {
  const jobs = await replay((packet, url, visit) => {
    if (url.includes('api.lever.co') && visit === 3) packet.html = JSON.stringify(JSON.parse(packet.html).filter(row => row.id !== FINANCE))
  })
  assert.equal(jobs.some(job => job.jobId === FINANCE), false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})

test('Pocket FM changed current loader still rejects unreviewed executable logic', async () => {
  await assert.rejects(replay((packet, url) => {
    if (url.endsWith('/0lrwflru-qh1-.js')) packet.html += '\nwindow.currentJobs=[]'
  }), /binding|client|program/i)
})
