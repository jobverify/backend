import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { createGadgeonScraper, CAREERS_PAGE_URL } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/actual-http-20261030.json.gz', import.meta.url))))
for (const row of fixture.responses) {
  const bytes = Buffer.from(row.bodyBase64, 'base64')
  assert.equal(bytes.length, row.bytes)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), row.sha256)
}
const originals = fixture.responses.filter(row => row.purpose !== 'declared-region-option:All')
const opening = Buffer.from(originals[0].bodyBase64, 'base64').toString('utf8')
const execute = async ({ change = response => response, maxJobs, signal, onAudit, beforeReturn } = {}) => {
  const queues = new Map()
  for (const original of originals) {
    const row = structuredClone(original)
    row.html = Buffer.from(row.bodyBase64, 'base64').toString('utf8')
    if (!queues.has(row.url)) queues.set(row.url, [])
    queues.get(row.url).push(row)
  }
  const audits = [], requests = []
  const jobs = await createGadgeonScraper({ maxJobs }).run({
    signal,
    fetchText: async (url, options = {}) => {
      requests.push(url)
      const row = queues.get(url)?.shift()
      assert.ok(row, 'No genuine retained response for requested URL: ' + url)
      const response = await change({ html: row.html, status: row.status, url: row.finalURL, purpose: row.purpose })
      await beforeReturn?.(row, options)
      return response
    },
    onAudit: async audit => { audits.push(audit); await onAudit?.(audit) },
  })
  return { jobs, audits, requests, evidence: readInventoryEvidence(jobs) }
}
const alter = (response, purpose, fn) => response.purpose === purpose ? { ...response, html: fn(response.html) } : response

test('actual native region responses recover ten India roles and retain the original modal requirements', async () => {
  const { jobs, audits, evidence } = await execute()
  assert.equal(jobs.length, 10)
  assert.equal(jobs[0].title, 'Principal Engineer (Backend & Agentic AI)')
  assert.match(jobs[0].jobDescription, /Node\.js and TypeScript/)
  assert.match(jobs[0].jobDescription, /Qualification/)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].location, 'SmartCity, Kochi')
  assert.equal(jobs[0].jobId, null)
  assert.equal(jobs[0].requisitionId, null)
  assert.equal(jobs[0].applyUrl, 'mailto:careers@gadgeon.com')
  assert.equal(jobs[0].sourceNativeModal.id, 'jobModal-229')
  assert.ok(opening.includes(jobs[0].sourceNativeModal.originalHTML))
  assert.ok(opening.includes(jobs[0].descriptionHtml))
  assert.equal(jobs[0].sourceCountryProvenance.method, 'declared-native-region-facet')
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(audits.length, 1)
  assert.equal(audits[0].observations.length, 10)
  assert.equal(audits[0].pages[0].originalHTML, opening)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.notEqual(evidence.status, 'verified-empty')
})

test('the real GET form determines requests and distinct closing captures are consumed once', async () => {
  const { requests, jobs } = await execute()
  assert.deepEqual(requests, originals.map(row => row.url))
  assert.equal(requests.filter(url => url === CAREERS_PAGE_URL).length, 2)
  assert.equal(jobs.every(job => job.country === 'India'), true)
})

test('the India query is unqualified when the response does not select the requested region', async () => {
  const { jobs, audits } = await execute({ change: response => alter(response, 'declared-region-option:India', html => html.replace('value="India" selected', 'value="India"')) })
  assert.equal(jobs.length, 0)
  assert.equal(audits[0].observations.length, 10)
  assert.equal(audits[0].observations.every(role => role.country === null), true)
})

test('a role returned in India and another region is retained as a country conflict', async () => {
  const { jobs, audits } = await execute({ change: response => response.purpose === 'declared-region-option:USA'
    ? { ...response, html: opening.replace('<option value="USA">', '<option value="USA" selected>') } : response })
  assert.equal(jobs.length, 0)
  assert.equal(audits[0].observations.length, 10)
  assert.equal(audits[0].observations.every(role => role.country === null), true)
})

for (const purpose of ['declared-region-option:India', 'declared-region-option:USA', 'declared-india-closing']) {
  test('an unavailable ' + purpose + ' preserves raw roles without manufacturing country or zero', async () => {
    const { jobs, audits, evidence } = await execute({ change: response => {
      if (response.purpose === purpose) throw Error('Retained transport failure')
      return response
    } })
    assert.equal(jobs.length, 0)
    assert.equal(audits[0].observations.length, 10)
    assert.match(audits[0].observations[0].descriptionText, /Node\.js and TypeScript/)
    assert.notEqual(evidence.status, 'verified-empty')
  })
}

test('a single changed India description leaves the other nine roles intact', async () => {
  const { jobs, audits } = await execute({ change: response => alter(response, 'declared-region-option:India', html => html.replace('We are seeking a highly experienced Principal Engineer', 'Different requirements for this role')) })
  assert.equal(jobs.length, 9)
  assert.equal(jobs.some(job => job.sourceNativeModal.id === 'jobModal-229'), false)
  assert.equal(audits[0].observations.length, 10)
})

test('a changed closing description does not reuse an older country-qualified copy', async () => {
  const { jobs } = await execute({ change: response => alter(response, 'declared-india-closing', html => html.replace('We are seeking a highly experienced Principal Engineer', 'Changed at closing')) })
  assert.equal(jobs.length, 9)
})

test('duplicate modal IDs cannot supply a unique same-role detail', async () => {
  const { jobs } = await execute({ change: response => alter(response, 'declared-region-option:India', html => html.replace('id="jobModal-228"', 'id="jobModal-229"')) })
  assert.equal(jobs.length, 8)
  assert.equal(jobs.some(job => ['jobModal-229', 'jobModal-228'].includes(job.sourceNativeModal.id)), false)
})

test('a modal moved into an inert template cannot qualify its role', async () => {
  const { jobs } = await execute({ change: response => alter(response, 'declared-region-option:India', html => html.replace('<div class="modal fade" id="jobModal-229"', '<template><div class="modal fade" id="jobModal-229"').replace('<div class="modal fade" id="jobModal-228"', '</template><div class="modal fade" id="jobModal-228"')) })
  assert.equal(jobs.some(job => job.sourceNativeModal.id === 'jobModal-229'), false)
  assert.ok(jobs.length < 10)
})

test('a non200 response cannot lend country from a retained matching HTML body', async () => {
  const { jobs } = await execute({ change: response => response.purpose === 'declared-region-option:India' ? { ...response, status: 403 } : response })
  assert.equal(jobs.length, 0)
})

test('a changed final response URL cannot lend country from a retained matching HTML body', async () => {
  const { jobs } = await execute({ change: response => response.purpose === 'declared-region-option:India' ? { ...response, url: CAREERS_PAGE_URL } : response })
  assert.equal(jobs.length, 0)
})

test('a title and city-only listing copy does not invent India or posting IDs', async () => {
  const { jobs, audits } = await execute({ change: response => ({ ...response, html: response.html.replace(/<form id="w0"[\s\S]*?<\/form>/, '') }) })
  assert.equal(jobs.length, 0)
  assert.equal(audits[0].observations.length, 10)
  assert.equal(audits[0].observations[0].country, null)
})

test('a positive cap preserves all audited native roles and does not claim total or cleanup', async () => {
  const { jobs, audits, evidence } = await execute({ maxJobs: 2 })
  assert.equal(jobs.length, 2)
  assert.equal(audits[0].observations.length, 10)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.listingComplete, false)
})

test('abort before entry propagates without requesting a source page', async () => {
  const controller = new AbortController()
  const reason = Error('Stop before request');controller.abort(reason)
  await assert.rejects(execute({ signal: controller.signal }), error => error === reason)
})

test('abort during a regional response propagates instead of becoming missing-country evidence', async () => {
  const controller = new AbortController(), reason = Error('Stop during region')
  await assert.rejects(execute({ signal: controller.signal, beforeReturn: row => {
    if (row.purpose === 'declared-region-option:USA') controller.abort(reason)
  } }), error => error === reason)
})

test('audit consumer failures propagate', async () => {
  const reason = Error('Audit consumer rejected output')
  await assert.rejects(execute({ onAudit: () => { throw reason } }), error => error === reason)
})
