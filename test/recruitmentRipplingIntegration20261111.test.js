import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { createVerifiedRecruitmentScraper, recruitmentEmployerMatches, RECRUITMENT_OBSERVATIONS } from '../scraper-support/utils/verifiedRecruitment.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { readNativeDocument } from '../scraper-support/utils/activeNativeHtml.js'

const providers = JSON.parse(readFileSync(new URL('../scraper-support/providers/providerExtensions/zz-297-remaining-recruitment-1033.json', import.meta.url)))
const provider = providers.find(row => row.source === 'branch')
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/recruitment-rippling-branch-20261111.json.gz', import.meta.url))))
const captured = new Map(fixture.responses.map(row => {
  const body = Buffer.from(row.bodyBase64, 'base64')
  assert.equal(createHash('sha256').update(body).digest('hex'), row.bodySHA256)
  return [row.requestedURL, { ...row, body: body.toString('utf8') }]
}))
const endpoint = 'https://ats.rippling.com/api/v2/board/branch/jobs?groupJobsByLocation=false&page=0&pageSize=1000'
const ids = ['454f3d28-ca85-4640-9cfe-c48f1931cfdc', '736cd9d9-935d-4eff-9359-3437ac66eff1',
  '14034902-e87c-4cdc-a07b-46260a42d095', 'd69a1abd-a1b2-4a2e-a73b-57fd5769ce83', 'dd6618ff-342f-4a05-a258-96bb8d347be8']

const replay = (change = (_, body) => body) => {
  const calls = [], counts = new Map()
  return { calls, fetchImpl: async (url, init) => {
    const row = captured.get(url)
    assert.ok(row, 'The integration must request only captured current declarations: ' + url)
    const count = (counts.get(url) || 0) + 1
    counts.set(url, count); calls.push({ url, cache: init.cache })
    const response = new Response(change(url, row.body, count), {
      status: row.status, headers: { 'content-type': row.contentType },
    })
    Object.defineProperty(response, 'url', { value: row.finalURL })
    return response
  } }
}
const run = r => createVerifiedRecruitmentScraper({ ...provider,
  // Bound this integration replay to its actual captured corporate page.
  officialHomepageUrl: provider.companyCareerPage,
}).run({ fetchImpl: r.fetchImpl, maxPages: 1, now: () => '2026-11-11T03:15:00.000Z' })

test('the registered Branch provider binds its current native legal employer exactly', () => {
  assert.deepEqual(provider.nativeEmployerNames, ['Branch Metrics, Inc.'])
  assert.equal(recruitmentEmployerMatches(provider, 'Branch Metrics, Inc.'), true)
  assert.equal(recruitmentEmployerMatches(provider, 'Another Branch Company'), false)
})

test('the generic reader follows Branch current widget through full native India details and preserves scope holds', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Captured integration forbids uncontrolled HTTP'))
  const r = replay(), jobs = await run(r)
  assert.deepEqual(jobs.map(job => job.jobId), ids)
  for (const job of jobs) {
    assert.equal(job.country, 'India')
    assert.equal(job.nativeHiringOrganization.name, 'Branch Metrics, Inc.')
    assert.ok(job.jobDescription.length > 12000)
    assert.equal(job.postingDate, null)
    assert.equal(job.closingDate, null)
    assert.equal(job.sourceDetailComplete, true)
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.sourceListingComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
    assert.equal(job.nativeSourceRecord.nativeClosingContext.currentPublisherHandoffRechecked, true)
  }
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].nativeRecords, 11)
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].nativeInventoryReads[0].reportedTotal, 18)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(r.calls.filter(call => call.url === endpoint).length, 2)
  assert.equal(r.calls.filter(call => call.url === endpoint)[1].cache, 'no-store')
})

test('a closing native listing change withholds every staged Rippling job through the shared reader', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Captured integration forbids uncontrolled HTTP'))
  const r = replay((url, body, count) => {
    if (url !== endpoint || count !== 2) return body
    const payload = JSON.parse(body)
    payload.totalItems++
    return JSON.stringify(payload)
  })
  const jobs = await run(r)
  assert.equal(jobs.length, 0)
  assert.ok(jobs[RECRUITMENT_OBSERVATIONS].failures.some(row => row.stage === 'native-rippling'))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('punctuation in full visible experience criteria cannot be erased by description reconciliation', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Captured integration forbids uncontrolled HTTP'))
  const changedRole = 'https://ats.rippling.com/branch/jobs/' + ids[0]
  const r = replay((url, body) => {
    if (url !== changedRole) return body
    const changed = body.replace('3-5+ years of experience', '35 years of experience')
    assert.notEqual(changed, body, 'Mutate the actual visible captured experience range')
    const model = html => readNativeDocument(html).nodes(node => node.tag === 'script' && node.attrs.id === '__NEXT_DATA__')[0].raw
    assert.equal(model(changed), model(body), 'Leave the authoritative native criteria unchanged')
    return changed
  })
  const jobs = await run(r)
  assert.equal(jobs.length, 0, 'A changed experience range cannot agree with the complete native criteria')
  assert.ok(jobs[RECRUITMENT_OBSERVATIONS].failures.some(row => row.stage === 'native-rippling'))
})
