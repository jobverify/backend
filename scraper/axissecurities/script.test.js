import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { run, inspectInventory } from './script.js'
import { descriptionContent, postingDate } from './parser.js'
import { spawnSync } from 'node:child_process'

const nativeResponse = (body, url, options = {}) => Object.defineProperty(new Response(body, options), 'url', { value: url })
const fixture = file => JSON.parse(readFileSync(new URL('./fixtures/' + file + '.json', import.meta.url)))
const listingCaptures = fixture('listing-json-responses')
const detailCaptures = fixture('detail-responses')
const replay = (mutate = value => value, requests = []) => async (url, options = {}) => {
  requests.push({ url, options })
  let captured, kind
  if (url.includes('simplehai.axisdirect.in')) { captured = fixture('careers-response'); kind = 'official' }
  else if (url.includes('getcandidatecompanydetails')) {
    captured = fixture('company-json-response'); kind = 'company'
  } else if (url.includes('candidatejobsearch')) {
    const params = JSON.parse(new URLSearchParams(options.body).get('careerSiteUrlParams'))
    assert.deepEqual(params, { page: params.page, search: '*:*', token: 'aA6ANFk4CHLUkuOVBmxq', source: 'CAREERSITE', pagesize: 10 })
    captured = listingCaptures[params.page]; kind = 'listing'
  } else if (url.includes('candidatejobdetail')) {
    captured = detailCaptures.find(c => new URL(c.url).searchParams.get('jobSeq') === new URL(url).searchParams.get('jobSeq')); kind = 'detail'
  } else { captured = fixture('board-response'); kind = 'board' }
  assert.ok(captured, 'missing actual capture for ' + url)
  const changed = mutate({ ...captured }, kind, url)
  return nativeResponse(changed.body, changed.finalUrl, { status: changed.status })
}

test('Axis Securities enumerates all77 native details and reports unresolved geography without certifying zero', async () => {
  const requests = []
  const jobs = await run({ fetchImpl: replay(undefined, requests), now: () => '2026-10-23T04:45:00.000Z' })
  assert.equal(jobs.length, 66)
  assert.ok(jobs.every(job => job.country === null))
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.reportedTotal, 77)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.status, 'coverage-gap')
  assert.match(evidence.reason, /77.*unknown.*countr/i)
  assert.equal(requests.filter(r => r.url.includes('candidatejobsearch')).length, 8)
  assert.equal(requests.filter(r => r.url.includes('candidatejobdetail')).length, 77)
})

test('Axis Securities inspection retains all77 native discoveries and original publication evidence', async () => {
  const result = await inspectInventory({ fetchImpl: replay() })
  assert.equal(result.listings.length,77)
  assert.equal(result.details.length,77)
  assert.equal(result.unknownCountryCount,77)
  assert.equal(result.listingComplete,true)
  assert.equal(result.details[0].description,null)
  assert.equal(result.details[0].publicationDate,'2025-12-12')
  assert.equal(result.details[0].row.jobPostingDate,'12-Dec-2025')
  assert.equal(result.details[0].publicationSource,'native-jobPostingDate')
  assert.ok(result.missingDescriptionCount > 0)
})

const mutatePayload = (target, transform) => (capture, kind, url) => {
  if (kind === target) {
    const payload = JSON.parse(capture.body)
    transform(payload,url)
    capture.body = JSON.stringify(payload)
  }
  return capture
}
for (const [name, kind, change, pattern] of [
  ['employer mismatch','company',p => { p.companyCd = 'ELSEWHERE' }, /employer/],
  ['detail employer mismatch','detail',p => { p.companyVO.companyMstrSeq = '999' }, /employer/],
  ['detail identity mismatch','detail',p => { p.jobSeq = '999' }, /identity/],
  ['detail geography drift','detail',p => { p.jobVO.jobLocation = 'Mumbai' }, /location/],
  ['secondary country field','detail',p => { p.jobVO.SecondaryCountry = 'United States' }, /geograph/],
  ['new secondary location shape','detail',p => { p.jobVO.jobLocationList = [{ country: 'India',city: 'Delhi' }] }, /secondary/],
  ['unresolved numeric country ID','detail',p => { p.jobVO.countryMstNewSeq = '1' }, /country identifier/],
  ['inactive detail','detail',p => { p.linkDeactivated = true }, /inactive/],
  ['detail count drift','detail',p => { p.jobCount = 78 }, /count changed/],
  ['duplicate listing','listing',p => { p.jobVoList[1] = p.jobVoList[0] }, /duplicate/],
  ['missing listing row','listing',p => { p.jobVoList.pop() }, /truncated/],
  ['wrong page offset','listing',p => { p.startJobIndex = 1 }, /pagination/],
  ['unsuccessful listing','listing',p => { p.errorStatus = 'failed' }, /pagination/],
  ['contradictory country label','listing',p => { p.jobVoList[0].locations = 'Toronto, Canada, India' }, /geograph/],
  ['contradictory India state label','listing',p => { p.jobVoList[0].locations = 'Bengaluru, CA, India' }, /geograph/],
]) test('Axis Securities rejects ' + name, async () => {
  await assert.rejects(run({ fetchImpl: replay(mutatePayload(kind,change)) }), pattern)
})

test('Axis Securities retains explicit native countries and city-only missing JD as partial', async () => {
  const jobs = await run({ fetchImpl: replay((capture,kind,url) => {
    if (kind === 'listing' || kind === 'detail') {
      const payload = JSON.parse(capture.body)
      if (kind === 'listing') for (const row of payload.jobVoList) if (row.jobSeq === '645595') row.locations = 'Central Delhi, India'
      if (kind === 'detail' && new URL(url).searchParams.get('jobSeq') === '645595') payload.jobVO.locations = payload.jobVO.jobLocation = 'Central Delhi, India'
      capture.body = JSON.stringify(payload)
    }
    return capture
  }) })
  assert.equal(jobs.length,66)
  assert.equal(jobs[0].country,'India')
  assert.equal(jobs[0].jobId,'645595')
  assert.equal(jobs[0].jobDescription,null)
  assert.equal(jobs[0].sourceDetailComplete,false)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

for (const value of [null, '<div inert>Develop software and support enterprise customers for our business operations and critical infrastructure.</div>', '<template>Develop software and support customers.</template>', '<strong>Responsibilities</strong>', '<p>Please update the Job Description</p>', '<p>Equity Dealer</p>']) {
  test('Axis Securities missing/inert/title-only JD is partial: ' + String(value), () => {
    assert.equal(descriptionContent(value,'Equity Dealer'),null)
  })
}
test('Axis Securities validates calendar publication dates and never substitutes creation', () => {
  assert.equal(postingDate({ createDttm: '2026-01-01',openDate:'2026-01-01' }),null)
  assert.equal(postingDate({ jobPostingDate:'22-Feb-2024' }),'2024-02-22')
  assert.throws(() => postingDate({ jobPostingDate:'31-Feb-2024' }),/calendar/)
  assert.equal(postingDate({ jobPostingDate:'12-Dec-2025',publishDetails:{ CAREER_SITE:'2026-06-01T05:10:30Z' } }),'2025-12-12')
})
test('Axis Securities output caps preserve native counts and incomplete evidence', async () => {
  const jobs = await run({ fetchImpl: replay(),maxJobs:0 })
  assert.equal(jobs.length,0)
  assert.equal(readInventoryEvidence(jobs).reportedTotal,77)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('Axis Securities caller abort bounds noncooperative fetch after discovery starts', async () => {
  const controller = new AbortController(), reason = Error('stop now')
  const pending = run({ fetchImpl: () => new Promise(() => {}),signal:controller.signal })
  controller.abort(reason)
  await assert.rejects(pending,error => error === reason)
})
test('Axis Securities import with --dry-run remains inert', () => {
  const result = spawnSync(process.execPath,['--input-type=module','-e',"globalThis.fetch=()=>{throw Error('import fetched')}; await import('./scraper/axissecurities/script.js'); console.log('import-only')",'--','--dry-run'],{ encoding:'utf8' })
  assert.equal(result.status,0,result.stderr)
  assert.equal(result.stdout.trim(),'import-only')
})

test('Axis Securities propagates cancellation before discovery', async () => {
  const controller = new AbortController(), reason = Error('cancelled')
  controller.abort(reason)
  await assert.rejects(run({ signal: controller.signal, fetchImpl: () => assert.fail('must not fetch') }), error => error === reason)
})
test('Axis Securities rejects discovery failure instead of returning zero', async () => {
  await assert.rejects(run({ fetchImpl: async () => { throw Error('offline fixture') } }), /offline fixture/)
})
test('Axis Securities aggregate deadline covers a noncooperative fetch', async () => {
  await assert.rejects(run({ timeoutMs: 20, fetchImpl: () => new Promise(() => {}) }), /deadline|timeout/i)
})
test('Axis Securities aggregate deadline covers a noncooperative body', async () => {
  await assert.rejects(run({ timeoutMs: 20, fetchImpl: async url => nativeResponse(new ReadableStream({ pull() { return new Promise(() => {}) } }),url) }), /deadline|timeout/i)
})


test('Axis Securities rejects oversized native streams before consuming the remaining body', async () => {
  let cancelled = false, reads = 0
  await assert.rejects(run({ timeoutMs: 1000, maxResponseBytes: 64, fetchImpl: async url => nativeResponse(new ReadableStream({
    pull(controller) { reads++; if (reads === 1) controller.enqueue(new Uint8Array(65)); else return new Promise(() => {}) },
    cancel() { cancelled = true },
  }, { highWaterMark: 0 }), url) }), /response.*byte.*limit/i)
  assert.equal(cancelled,true)
  assert.equal(reads,1)
})

test('Axis Securities deadline cancels a stalled native response stream', async () => {
  let cancelled = false
  await assert.rejects(run({ timeoutMs: 20, fetchImpl: async url => nativeResponse(new ReadableStream({
    pull() { return new Promise(() => {}) },
    cancel() { cancelled = true; return new Promise(() => {}) },
  }), url) }), /deadline/i)
  assert.equal(cancelled,true)
})

test('Axis Securities cancels a rejected native HTTP response without reading it', async () => {
  let cancelled = false
  await assert.rejects(run({ fetchImpl: async url => nativeResponse(new ReadableStream({
    cancel() { cancelled = true },
  }),url,{ status: 429 }) }), /HTTP status/)
  assert.equal(cancelled,true)
})

test('Axis Securities cancels a response that arrives after the aggregate deadline', async () => {
  let respond, cancelled = false
  const pending = run({ timeoutMs: 20, fetchImpl: url => new Promise(resolve => {
    respond = () => resolve(nativeResponse(new ReadableStream({ cancel() { cancelled = true } }),url))
  }) })
  await assert.rejects(pending,/deadline/i)
  respond()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(cancelled,true)
})



test('Axis Securities checks elapsed deadline while synchronous stream chunks starve timers', async () => {
  let reads = 0, cancelled = false
  await assert.rejects(run({ timeoutMs: 20, fetchImpl: async url => nativeResponse(new ReadableStream({
    pull(controller) {
      reads++
      if (reads === 8) return new Promise(() => {})
      const until = Date.now() + 6
      while (Date.now() < until) {}
      controller.enqueue(new Uint8Array([32]))
    },
    cancel() { cancelled = true },
  }, { highWaterMark: 0 }),url) }),/deadline/i)
  assert.ok(reads < 8, 'deadline must interrupt synchronous chunk consumption')
  assert.equal(cancelled,true)
})


test('Axis Securities checks elapsed deadline after final detail parsing before returning inventory', async t => {
  let elapsed = 0
  const parse = JSON.parse
  t.mock.method(performance,'now',() => elapsed)
  t.mock.method(JSON,'parse',function(value,...args) {
    const parsed = parse(value,...args)
    // Simulate synchronous final-detail parsing/hydration consuming the remaining budget.
    if (parsed?.jobVO?.jobSeq === '645595') elapsed = 2000
    return parsed
  })
  await assert.rejects(inspectInventory({ fetchImpl: replay(), maxJobs: 1, timeoutMs: 1000 }),/deadline/i)
})
