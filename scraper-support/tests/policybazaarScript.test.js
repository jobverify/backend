import assert from 'node:assert/strict'
import test from 'node:test'
import { createPolicybazaarScraper, extractSearchResults, CAREERS_URL } from '../../scraper/policybazaar/script.js'

const html = `<!doctype html><html><head><title>Policybazaar Careers</title></head><body>
<h1>Find the job that's right for you</h1><ul class="ijp">
<li><span class="content"><p class="heading">Associate Sales Consultant</p><p class="text"><strong>Role: </strong>Assist customers in buying various financial products, focusing on insurance policies, over the phone.</p><p class="text"><strong>Eligibility: </strong>Seeking SSC, Graduates or higher education applicants; regardless of experience.</p></span><span class="applynow"><a href="javascript:void(0)">Apply now</a></span></li>
<li><p class="heading">Don't see a Job Opening which interests you?</p><p class="text">Share your resume and dream role with us.</p></li></ul>
<div>Currently hiring for</div><span class="city-location">Gurugram</span><span class="city-location">Mumbai</span>
<form id="careerFormReferer"><select id="refPosition"><option value="">Position applied for</option><option value="Associate Sales Consultant">Associate Sales Consultant</option></select><input type="file"></form></body></html>`
const response = (body = html, overrides = {}) => {
 const stream=overrides.text?new ReadableStream({async start(c){try{const value=await overrides.text();c.enqueue(new TextEncoder().encode(value));c.close()}catch(error){c.error(error)}}}):body
 const r=new Response(stream,{status:overrides.status??200});Object.defineProperty(r,'url',{value:overrides.url??CAREERS_URL});return r
}

test('generic hiring cities do not become a role country, location, remote status, requisition or publication date', () => {
  const jobs = extractSearchResults(html)
  assert.equal(jobs.length, 1)
  for (const key of ['country', 'city', 'location', 'remoteStatus', 'requisitionId', 'postingDate', 'closingDate']) assert.equal(jobs[0][key], null, key)
  assert.equal(jobs[0].jobDescription, 'Assist customers in buying various financial products, focusing on insurance policies, over the phone.')
})

test('checks native surface and reports observed roles with unknown role location as an explicit coverage gap', async () => {
  await assert.rejects(createPolicybazaarScraper().run({ fetchImpl: async () => response() }), error => {
    assert.equal(error.code, 'POLICYBAZAAR_COVERAGE_GAP')
    assert.equal(error.inventoryEvidence.status, 'coverage-gap')
    assert.equal(error.inventoryEvidence.listingComplete, false)
    assert.equal(error.inventoryEvidence.reportedTotal, null)
    assert.equal(error.nativeRoleCards.length, 1)
    assert.equal(error.nativeRoleCards[0].country, null)
    assert.match(error.inventoryEvidence.reason, /role-specific.*country|country.*role-specific/i)
    return true
  })
})

test('transport, HTTP, drift, challenge, redirect, and body failures cannot report verified zero', async () => {
  const failure = new Error('socket unavailable')
  for (const fetchImpl of [
    async () => { throw failure },
    async () => response('', { status: 403 }),
    async () => response('<h1>Careers</h1>'),
    async () => response(html, { url: 'https://example.org/careers/' }),
    async () => response('', { text: async () => { throw failure } }),
  ]) await assert.rejects(createPolicybazaarScraper().run({ fetchImpl }), error => {
    assert.equal(error.code, 'POLICYBAZAAR_COVERAGE_GAP')
    assert.equal(error.inventoryEvidence.status, 'coverage-gap')
    assert.equal(error.inventoryEvidence.listingComplete, false)
    return true
  })
})

test('aggregate deadline bounds ignored fetch signals and body consumption', async () => {
  for (const fetchImpl of [async () => new Promise(() => {}), async () => response('', { text: () => new Promise(() => {}) })]) {
    await assert.rejects(createPolicybazaarScraper().run({ fetchImpl, timeoutMs: 15 }), error => error.code === 'POLICYBAZAAR_COVERAGE_GAP' && /deadline/i.test(error.inventoryEvidence.reason))
  }
})

test('caller cancellation preserves exact reason before fetch and during ignored body signal', async () => {
  const reason = new Error('operator stopped run')
  const before = new AbortController(); before.abort(reason)
  await assert.rejects(createPolicybazaarScraper().run({ signal: before.signal, fetchImpl: async () => response() }), error => error === reason)
  const during = new AbortController()
  const pending = createPolicybazaarScraper().run({ signal: during.signal, fetchImpl: async () => response('', { text: () => { during.abort(reason); return new Promise(() => {}) } }) })
  await assert.rejects(pending, error => error === reason)
})

test('hidden, inert, template, content-visibility and title-only descriptions cannot become active prose', () => {
  for (const replacement of ['<span hidden>Assist customers with insurance.</span>', '<span inert>Assist customers with insurance.</span>', '<template>Assist customers with insurance.</template>', '<span style="content-visibility: hidden">Assist customers with insurance.</span>', '<strong>Associate Sales Consultant</strong>']) {
    const jobs = extractSearchResults(html.replace('Assist customers in buying various financial products, focusing on insurance policies, over the phone.', replacement))
    assert.equal(jobs[0]?.jobDescription ?? null, null)
  }
})

test('an empty or hidden role-card surface remains an unknown inventory, never a verified empty board', async () => {
  for (const body of [html.replace(/<ul class="ijp">[\s\S]*?<\/ul>/, '<ul class="ijp"></ul>'), html.replace('<ul class="ijp">', '<ul class="ijp" inert>')]) {
    await assert.rejects(createPolicybazaarScraper().run({ fetchImpl: async () => response(body) }), error => {
      assert.equal(error.inventoryEvidence.status, 'coverage-gap')
      assert.equal(error.inventoryEvidence.reportedTotal, null)
      assert.equal(error.inventoryEvidence.indiaFacetCount, null)
      return true
    })
  }
})
