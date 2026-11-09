import test from 'node:test'
import assert from 'node:assert/strict'
import { createCareHealthInsuranceScraper } from './script.js'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
const receipts = ['care-browser-captures', 'native-opening-responses'].flatMap(name => JSON.parse(gunzipSync(readFileSync(new URL(`./fixtures/${name}.json.gz`, import.meta.url)))))
const replay = (mutate = r => r) => async url => {
  const original = receipts.find(r => r.url === url)
  assert.ok(original, `Unexpected source request ${url}`)
  const r = mutate({...original})
  return {url:r.finalUrl || r.url, status:r.status, text:async () => r.body}
}

const gap = error => {
  assert.equal(error.code, 'CAREHEALTHINSURANCE_COVERAGE_GAP')
  assert.equal(error.lifecycleCleanupAllowed, false)
  assert.equal(error.sourceListingComplete, false)
  assert.equal(error.inventoryEvidence.status, 'coverage-gap')
  assert.equal(error.inventoryEvidence.listingComplete, false)
  assert.equal(error.inventoryEvidence.reportedTotal, null)
  assert.equal(error.inventoryEvidence.indiaFacetCount, null)
  return true
}

test('an inaccessible or selected-area empty careers surface cannot certify company zero', async () => {
  for (const [body, status] of [['blocked', 403], ['No opening in this area. Please check after sometime.', 200], ['', 200]]) {
    await assert.rejects(createCareHealthInsuranceScraper().run({ fetchImpl: async url => ({url, status, text:async () => body}) }), gap)
  }
})

test('source bodies exceeding the bounded budget become a coverage gap', async () => {
  await assert.rejects(createCareHealthInsuranceScraper().run({fetchImpl:async url => ({url, status:200,
    text:async () => 'x'.repeat(5000001)})}), gap)
})

test('oversize streaming bodies are cancelled before reading beyond the first overflowing chunk', async () => {
  let cancelled = false
  await assert.rejects(createCareHealthInsuranceScraper().run({fetchImpl:async url => ({url, status:200,
    body:new ReadableStream({start(c) {c.enqueue(new Uint8Array(5000001))}, cancel() {cancelled = true}}),
  })}), gap)
  assert.equal(cancelled, true)
})

test('one aggregate deadline bounds both fetch and body stalls', async () => {
  for (const fetchImpl of [() => new Promise(() => {}), async url => ({url, status:200, text:() => new Promise(() => {})})]) {
    await assert.rejects(createCareHealthInsuranceScraper().run({fetchImpl, timeoutMs:10}), gap)
  }
})

test('pre-abort and in-flight cancellation preserve exact caller reason', async () => {
  for (const stage of ['before', 'fetch', 'body']) {
    const controller = new AbortController(), reason = {stage}
    if (stage === 'before') controller.abort(reason)
    await assert.rejects(createCareHealthInsuranceScraper().run({signal:controller.signal, fetchImpl:async url => {
      if (stage === 'fetch') { controller.abort(reason); return new Promise(() => {}) }
      return {url, status:200, text:() => {controller.abort(reason); return new Promise(() => {})}}
    }}), error => error === reason)
  }
})

test('all three native categories recover eight explicit India jobs while retaining geography gaps', async () => {
  const jobs = await createCareHealthInsuranceScraper().run({fetchImpl:replay()})
  assert.equal(jobs.length, 8)
  assert.deepEqual(jobs.map(j => j.jobId), ['25','26','27','28','32','40','44','45'])
  assert.ok(jobs.every(j => j.country === 'India' && j.sourceListingComplete === false && j.lifecycleCleanupAllowed === false))
  assert.equal(jobs[0].postingDate, '2021-02-11')
  assert.match(jobs[0].jobDescription, /Recruit.*Train/)
  assert.equal(jobs[0].applyUrl, 'https://www.careinsurance.com/rhicl/careers/job-search')
  assert.equal(jobs[0].nativeCollectionEvidence.nativeRecordCount, 34)
  assert.equal(jobs[0].nativeCollectionEvidence.geographyGaps.length, 26)
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})

test('missing, hidden, inert, template and heading-only JD keep eligible jobs with null description', async () => {
  for (const description of [null, '<div hidden>Substantive responsibilities '.repeat(8) + '</div>', '<div inert>Responsibilities</div>', '<template>Responsibilities</template>', '<h2>Responsibilities</h2>', '<strong>'+'Responsibilities and qualifications '.repeat(8)+'</strong>']) {
    const jobs = await createCareHealthInsuranceScraper().run({fetchImpl:replay(r => {
      if (r.url.endsWith('/getOpenings/0')) {const rows=JSON.parse(r.body); rows[0].description=description; r.body=JSON.stringify(rows)}
      return r
    })})
    assert.equal(jobs[0].jobDescription, null)
    assert.equal(jobs[0].sourceDetailComplete, false)
  }
})

test('native category, identity, public date and secondary country drift cannot certify inventory', async () => {
  for (const patch of [{job_category:'1'}, {id:26}, {country:'Singapore'}, {created_at:'2099-01-01 00:00:00'}, {validThrough:'2000-01-01'}, {hiringOrganization:{name:'Cair Health'}}, {banner_heading:'Cair Health'}]) {
    await assert.rejects(createCareHealthInsuranceScraper().run({fetchImpl:replay(r => {
      if (r.url.endsWith('/getOpenings/0')) {const rows=JSON.parse(r.body);Object.assign(rows[0],patch);r.body=JSON.stringify(rows)}return r
    })}), gap)
  }
})

test('disabled or inactive native Apply controls and broken official handoffs fail closed', async () => {
  for (const mutate of [
    r => r.url.endsWith('/careers') ? {...r,body:r.body.replaceAll('href="https://www.careinsurance.com/rhicl/careers/job-search"','href="https://cairhealth.com/career"')} : r,
    r => r.url.endsWith('/job-search') ? {...r,body:r.body.replace('id="apply-button"','disabled id="apply-button"')} : r,
    r => r.url.endsWith('/job-search') ? {...r,body:r.body.replace('id="job-form"','hidden id="job-form"')} : r,
  ]) await assert.rejects(createCareHealthInsuranceScraper().run({fetchImpl:replay(mutate)}),gap)
})
