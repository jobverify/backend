import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run, readBazaarvoiceProof } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const canonical = 'https://www.bazaarvoice.com/company/careers'
const listing = canonical + '/career-job-listing'
const api = 'https://api.lever.co/v0/postings/bazaarvoice?mode=json'
const role = 'https://jobs.lever.co/bazaarvoice/28cd3ded-6aba-41c9-bb67-a5c6887c878c'
const read = name => gunzipSync(readFileSync(new URL('./fixtures-current-20261115/' + name, import.meta.url))).toString()
const makeOptions = ({ change = (body => body), redirect = '/company/careers' } = {}) => ({
  fetchImpl: async (url, options) => {
    assert.equal(options.method, 'GET')
    assert.equal(options.redirect, 'manual')
    const file = url === canonical + '/' ? 'redirect.html.gz' : url === canonical ? 'careers.html.gz'
      : url === listing ? 'listing.html.gz' : url === api ? 'postings.json.gz' : url === role ? 'india-role.html.gz' : null
    assert.ok(file, 'Unexpected native request: ' + url)
    const body = change(read(file), url)
    const response = new Response(body, { status: url === canonical + '/' ? 308 : 200,
      headers: { 'content-type': url === api ? 'application/json' : 'text/html', ...(url === canonical + '/' ? { location: redirect } : {}) } })
    Object.defineProperty(response, 'url', { value: url })
    return response
  },
})

test('the current Next careers handoff recovers the source-advertised native India role', async () => {
  let proof
  const jobs = await run({ ...makeOptions(), onProof: value => { proof = value } })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '28cd3ded-6aba-41c9-bb67-a5c6887c878c')
  assert.equal(jobs[0].title, 'Staff Devops Engineer')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].sourceUrl, role)
  assert.equal(jobs[0].applyUrl, role + '/apply')
  assert.match(jobs[0].jobDescription, /Kubernetes/)
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readBazaarvoiceProof(jobs), proof)
  assert.equal(proof.source, 'bazaarvoice')
})

test('an unrelated employer redirect cannot authorize the new careers route', async () => {
  await assert.rejects(run(makeOptions({ redirect: 'https://example.org/careers' })), /redirect|handoff/i)
})

test('a native API India record without its active corporate role link stays unpublished', async () => {
  const jobs = await run(makeOptions({ change: (body, url) => url === listing ? body.replaceAll(role, 'https://jobs.lever.co/foreign/28cd3ded-6aba-41c9-bb67-a5c6887c878c') : body }))
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('current corporate and native role titles must agree', async () => {
  const jobs = await run(makeOptions({ change: (body, url) => url === api ? body.replaceAll('Staff Devops Engineer', 'Unrelated Engineer') : body }))
  assert.equal(jobs.length, 0)
})

test('no native India matches cannot become a company zero', async () => {
  const jobs = await run(makeOptions({ change: (body, url) => {
    if (url !== api) return body
    const records = JSON.parse(body)
    return JSON.stringify(records.filter(record => record.country !== 'IN'))
  } }))
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.notEqual(readInventoryEvidence(jobs).status, 'verified-empty')
})
