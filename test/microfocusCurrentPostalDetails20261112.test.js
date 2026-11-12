import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {buildScrapers} from '../scraper-support/providers/index.js'
import {extractPhAppDdo} from '../scraper-support/phenom/engine.js'
import {extractionDetailHealth} from '../scraper-support/utils/extractionDetailHealth.js'
import {isCompleteScraperAttempt, readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'

// Actual public listing/widget and all 25 detail responses captured on November 12.
// HTTP alone is replayed; the registered source, enumeration, country, identity
// and description validation run unchanged.
const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/microfocus-current-postal-details-20261112.json.gz', import.meta.url))))
const firstDetailUrl = 'https://careers.opentext.com/us/en/job/53161/Lead-Network-Engineer'
const replay = async (t, mutateDetail, {detailUrl = firstDetailUrl, mutateHtml} = {}) => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Uncaptured network request'))
  const scraper = buildScrapers().find(row => row.name === 'microfocus')
  const responseFor = (url, method, body) => {
    const response = fixture.responses.find(row => row.requestedUrl === url && row.method === method && row.requestBody === (body ?? null))
    assert.ok(response, 'Request must belong to the captured public inventory: ' + url)
    assert.equal(response.status, 200)
    assert.equal(response.url, url)
    return response.body
  }
  return scraper.run({
    fetchText: async url => {
      const html = responseFor(url, 'GET')
      if (url !== detailUrl) return html
      if (mutateHtml) return mutateHtml(html)
      if (!mutateDetail) return html
      const ddo = extractPhAppDdo(html)
      mutateDetail(ddo.jobDetail.data.job)
      const scripts = html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || []
      return '<link rel="canonical" href="' + url + '"><script>phApp.ddo = '
        + JSON.stringify(ddo).replaceAll('<', '\\u003c') + '</script>' + scripts.join('')
    },
    fetchJson: async (url, options) => JSON.parse(responseFor(url, options.method || 'GET', options.body)),
  })
}

test('registered Micro Focus hydrates all 25 current native roles with country-before-zip office labels', async t => {
  const jobs = await replay(t)
  assert.equal(jobs.length, 25)
  assert.equal(jobs.filter(job => job.sourceDetailComplete === true).length, 25)
  assert.equal(jobs[0].jobId, '53161')
  assert.equal(jobs[0].title, 'Lead Network Engineer')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].location, 'Bangalore, Karnataka, IND')
  assert.ok(jobs.every(job => job.jobDescription?.length > 100))
  const inventoryEvidence = readInventoryEvidence(jobs)
  assert.equal(inventoryEvidence.status, 'complete-inventory')
  assert.equal(inventoryEvidence.indiaFacetCount, 25)
  assert.equal(isCompleteScraperAttempt({success: true, inventoryEvidence,
    detailHealth: extractionDetailHealth(jobs), completedAt: new Date().toISOString()}), true)
})

for (const [label, mutate] of [
  ['different zip code', job => {job.multi_location[0].zipCode = '999999'}],
  ['foreign office country', job => {job.multi_location[0].country = 'USA'}],
  ['different native requisition', job => {job.reqId = 'different-role'}],
  ['contradictory office state', job => {job.multi_location[0].state = 'Maharashtra'}],
]) test('Micro Focus postal recovery still rejects ' + label, async t => {
  const jobs = await replay(t, mutate)
  assert.equal(jobs[0].jobId, '53161')
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceDetailFailureKind, 'identity-mismatch')
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(extractionDetailHealth(jobs).complete, false)
})

// Sharing an explicitly reviewed OpenText binding must not authorize new titles.
test('Micro Focus rejects an unreviewed schema title on the reviewed OpenText role', async t => {
  const jobs = await replay(t, undefined, {
    detailUrl: 'https://careers.opentext.com/us/en/job/51919/Premium-Support-Specialist-SMAX',
    mutateHtml: html => html.replaceAll('Premium Support Developer ( SMAX)', 'Unreviewed alternate title'),
  })
  const job = jobs.find(row => row.jobId === '51919')
  assert.equal(job.title, 'Premium Support Specialist ( SMAX)')
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.sourceDetailFailureKind, 'identity-mismatch')
  assert.equal(job.jobDescription, null)
})
