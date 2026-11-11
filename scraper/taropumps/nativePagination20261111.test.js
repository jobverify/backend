import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { run, CAREERS_URL, TEXMO_CAREERS_URL } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261111.json.gz', import.meta.url))))
const reply = (url, body, status = 200) => {
  const response = new Response(body, { status, headers: { 'content-type': 'text/html; charset=UTF-8' } })
  Object.defineProperty(response, 'url', { value: url })
  return response
}
const exercise = ({ careers = fixture.careers, group = fixture.group, employerPage = fixture.employerPage,
  detail = fixture.detail, denied = false, signal, mutateResponse = (_url, _init, body) => body } = {}) => {
  const counts = new Map()
  return run({
  // The old reader sees the exact current documents, including the foreign-only
  // first group page. Network substitution stays below the real source reader.
  fetchText: async url => url === CAREERS_URL ? careers : group,
  fetchImpl: async (url, init) => {
    const key = init.method + ' ' + url, count = (counts.get(key) || 0) + 1
    counts.set(key, count)
    const respond = (responseURL, body, status) => reply(responseURL, mutateResponse(url, init, body, count), status)
    if (url === CAREERS_URL) return respond(url, careers)
    if (url === TEXMO_CAREERS_URL && init.method === 'GET') return respond(url, group)
    if (url === TEXMO_CAREERS_URL && init.method === 'POST') {
      assert.equal(init.body, 'company=1489&location=&role=&pageNumber=1')
      return respond(url, denied ? 'Access denied' : employerPage, denied ? 403 : 200)
    }
    if (url === fixture.detailURL) return respond(fixture.finalDetailURL, detail)
    throw Error('Unexpected native acquisition: ' + init.method + ' ' + url)
  },
  maxPages: 1, maxDetails: 1, signal,
  now: () => '2026-11-11T03:20:00.000Z',
  })
}

test('current Taro delegation submits the published employer form when the first group page has no India cards', async () => {
  const jobs = await exercise()
  assert.equal(jobs.length, 1)
  const [job] = jobs
  assert.equal(job.jobId, '541133')
  assert.equal(job.source, 'taropumps')
  assert.equal(job.company, 'Texmo Industries')
  assert.equal(job.country, 'India')
  assert.equal(job.city, 'Coimbatore')
  assert.equal(job.applyUrl, 'https://www.texmo.com/job-application/?id=541133')
  assert.match(job.jobDescription, /B\.E\. in Electrical Engineering/)
  assert.match(job.jobDescription, /Solid works \(optional\)/)
  assert.doesNotMatch(job.jobDescription, /Renukadevi|14\+ years|Post recruitment|About the Hiring Team/)
  assert.equal(job.experienceRequired, null)
  assert.equal(job.postingDate, null)
  assert.equal(job.closingDate, null)
  assert.equal(job.sourceScopeComplete, false)
  assert.equal(job.sourceListingComplete, false)
  assert.equal(job.lifecycleCleanupAllowed, false)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.lifecycleCleanupAllowed, false)
})

test('a different native Texmo group employer cannot become a Taro Pumps role', async () => {
  await assert.rejects(exercise({ detail: fixture.detail.replace('Design (Electrical) • Texmo Industries', 'Design (Electrical) • Texmo Blank') }), /employer|identity/i)
})

test('native detail country conflicts cannot inherit the India listing country', async () => {
  await assert.rejects(exercise({ detail: fixture.detail.replace('Coimbatore, India • Product Engineering', 'Coimbatore, Singapore • Product Engineering') }), /country|location/i)
})

test('the full native own-role requirements are mandatory before recruiter biographies', async () => {
  const start = fixture.detail.indexOf('<div class="career-details-item--content">')
  const end = fixture.detail.indexOf('<div class="bkg--white career-details--additional">', start)
  assert(start > 0 && end > start)
  const truncated = fixture.detail.slice(0, start) + '<div class="career-details-item--content"><p>Job description</p></div></section></div>' + fixture.detail.slice(end)
  await assert.rejects(exercise({ detail: truncated }), /description|criteria|content/i)
})

test('a current native HTTP denial never becomes an empty successful result', async () => {
  await assert.rejects(exercise({ denied: true }), error => error.status === 403)
})

test('a hidden corporate delegation cannot authorize the shared group board', async () => {
  const careers = fixture.careers.replaceAll('href="https://www.texmo.com/careers"', 'hidden href="https://www.texmo.com/careers"')
  await assert.rejects(exercise({ careers }), /handoff|delegation|employer/i)
})

test('an empty or unrelated current employer response cannot become a verified zero', async () => {
  const empty = fixture.employerPage.replace(/href="\/career-details\?[^\"]*"/g, 'href="#"')
  await assert.rejects(exercise({ employerPage: empty }), /inventory|roles|cards/i)
  await assert.rejects(exercise({ employerPage: '<html><body>Other employer</body></html>' }), /inventory|form|identity/i)
})

test('cancellation prevents every native read', async () => {
  const reason = Error('cancel Taro native acquisition')
  await assert.rejects(exercise({ signal: AbortSignal.abort(reason) }), error => error === reason)
})

test('a selected native employer listing card that changes after detail acquisition withholds every staged job', async () => {
  assert.ok(fixture.employerPage.includes('id=541133'))
  await assert.rejects(exercise({ mutateResponse: (url, init, body, count) =>
    url === TEXMO_CAREERS_URL && init.method === 'POST' && count === 2
      ? body.replaceAll('id=541133', 'id=999999') : body }), /closing.*(?:listing|inventory)|(?:listing|inventory).*changed/i)
})

test('a current branded employer handoff that changes after native detail acquisition withholds every staged job', async () => {
  await assert.rejects(exercise({ mutateResponse: (url, _init, body, count) =>
    url === CAREERS_URL && count === 2
      ? body.replaceAll('href="https://www.texmo.com/careers"', 'hidden href="https://www.texmo.com/careers"') : body }), /closing.*(?:handoff|declaration)|(?:handoff|delegation|employer).*missing/i)
})

test('changed closing full native own-role criteria withhold every staged job', async () => {
  assert.ok(fixture.detail.includes('Solid works (optional)'))
  await assert.rejects(exercise({ mutateResponse: (url, _init, body, count) =>
    url === fixture.detailURL && count === 2
      ? body.replace('Solid works (optional)', 'Solid works (mandatory)') : body }), /closing.*(?:criteria|role)|(?:criteria|role).*changed/i)
})

test('unchanged selected roles and each native page are rechecked before partial output', async () => {
  const calls = []
  const jobs = await exercise({ mutateResponse: (url, init, body, count) => {
    calls.push({ url, method: init.method, count })
    return body
  } })
  assert.equal(calls.filter(call => call.url === CAREERS_URL).length, 2)
  assert.equal(calls.filter(call => call.url === TEXMO_CAREERS_URL && call.method === 'POST').length, 2)
  assert.equal(calls.filter(call => call.url === fixture.detailURL).length, 2)
  assert.equal(jobs.nativeCollectionEvidence.closingListingMatches, true)
  assert.equal(jobs.nativeCollectionEvidence.closingCorporateHandoffMatches, true)
  assert.equal(jobs.nativeCollectionEvidence.observedListingCount, 12)
  assert.equal(jobs.nativeCollectionEvidence.listingRecords.length, 12)
  assert.equal(jobs.nativeCollectionEvidence.inspectedDetails, 1)
  assert.ok(jobs.nativeCollectionEvidence.receipts.length <= jobs.nativeCollectionEvidence.requestBudget)
  assert.equal(jobs[0].sourceNativeClosingEvidence.fullRoleCriteriaRechecked, true)
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(jobs[0].postingDate, null)
  assert.equal(jobs[0].closingDate, null)
})
