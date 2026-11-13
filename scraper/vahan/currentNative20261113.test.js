import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { runVahanCurrentNative } from './currentNative20261113.js'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { assessSoftFailureAcquisition } from '../../scripts/softFailureAssessment20261113.mjs'

const receipts = JSON.parse(readFileSync(new URL('./fixtures/current-20261113/receipts.json', import.meta.url)))
const fixture = name => gunzipSync(readFileSync(new URL('./fixtures/current-20261113/' + name, import.meta.url))).toString()
const HOME = 'https://www.vahan.co/'
const BOARD = HOME + 'careers/'
const ROLE = BOARD + 'business-development-manager-lucknow/'
const provider = { source: 'vahan', companyName: 'Vahan', countryFilter: 'India', sourceScopeComplete: false, lifecycleCleanupAllowed: false }

function transport(change = () => null) {
  const requests = [], counts = new Map()
  const fetchImpl = async (url, options) => {
    assert.equal(options.method || 'GET', 'GET')
    options.signal.throwIfAborted()
    const count = (counts.get(url) || 0) + 1
    counts.set(url, count); requests.push(url)
    const receipt = receipts.find(row => row.requestedUrl === url)
    assert.ok(receipt, 'unadvertised request: ' + url)
    const original = fixture(receipt.file)
    const changed = change({ url, count, body: original })
    const body = changed?.body ?? original
    const response = new Response(body, { status: changed?.status ?? receipt.status, headers: receipt.headers })
    Object.defineProperty(response, 'url', { value: changed?.url ?? receipt.url })
    return response
  }
  return { fetchImpl, requests, counts }
}

test('current first-party Vahan HTML yields all 28 own India roles with full authored criteria', async () => {
  const source = transport(), jobs = await runVahanCurrentNative(source)
  assert.equal(jobs.length, 28)
  assert.equal(new Set(jobs.map(job => job.jobId)).size, 28)
  assert.ok(jobs.every(job => job.company === 'Vahan' && job.country === 'India'
    && job.sourceUrl.startsWith(BOARD) && job.applyUrl === job.sourceUrl + '#apply'
    && job.sourceScopeComplete === false && job.lifecycleCleanupAllowed === false
    && job.sourceDescription === job.jobDescription && job.postingDate === null))
  const manager = jobs.find(job => job.sourceUrl === ROLE)
  assert.equal(manager.title, 'Business Development Manager - Lucknow')
  assert.equal(manager.location, 'Lucknow, Uttar Pradesh, India')
  assert.match(manager.sourceDescription, /Have 2\+ years of experience in offline sales/)
  assert.match(manager.sourceDescription, /Have experience in BDM supply, ground sales, or B2B sales/)
  assert.doesNotMatch(manager.sourceDescription, /Resume link|Submit Application|Monthly Wellness Leaves/)
  assert.ok(source.requests.every(url => !url.includes('/jobs/') && !url.includes('script.google.com')))
  assert.equal(source.counts.get(ROLE), 2, 'reconcile full current role criteria at closing')
  assert.equal(source.counts.get(BOARD), 3, 'final membership follows closing role acquisition')
  const observation = readSourceObservationEvidence(jobs, 'vahan')
  assert.equal(observation.observedVacancyCount, 28)
  assert.equal(observation.companyIndiaTotal, null)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  const assessment = assessSoftFailureAcquisition(provider, jobs)
  assert.deepEqual(assessment.cleanupOptions, { replaceExisting: false })
  assert.equal(assessment.runnerOutcome.success, true)
  assert.equal(assessment.eligibleJobs, 28)
})

test('registered Vahan script executes the current native reader', async () => {
  const source = transport()
  const jobs = await run(source)
  assert.equal(jobs.length, 28)
  assert.ok(source.requests.includes(BOARD))
})

for (const [label, modify, pattern] of [
  ['hidden individual requirement', body => body.replace('<li>Have 2+ years', '<li hidden>Have 2+ years'), /visible.*criteria/],
  ['CSS-hidden individual requirement', body => body.replace('<li>Have 2+ years', '<li class="unread-criterion">Have 2+ years').replace('</head>', '<style>.unread-criterion{display:none}</style></head>'), /visible.*criteria/],
  ['hidden entire role', body => body.replace('class="jr-body"', 'class="jr-body" hidden'), /visible.*criteria/],
  ['offscreen criteria container', body => body.replace('class="jr-body"', 'class="jr-body" style="position:fixed;left:-9999px"'), /visible.*criteria/],
  ['offscreen page ancestor', body => body.replace('class="page"', 'class="page" style="position:fixed;left:-9999px"'), /visible.*criteria/],
  ['hidden active title', body => body.replace('class="jr-title"', 'class="jr-title" hidden'), /title/],
  ['hidden native application', body => body.replace('class="jr-form"', 'class="jr-form" hidden'), /application/],
  ['disabled application fieldset', body => body.replace(/(<form class="jr-form"[^>]*>)/, '$1<fieldset disabled>').replace('</form>', '</fieldset></form>'), /application/],
  ['disabled required resume control', body => body.replace('id="jr-resume"', 'disabled id="jr-resume"'), /application/],
  ['readonly required resume control', body => body.replace('id="jr-resume"', 'readonly id="jr-resume"'), /application/],
  ['aria-disabled application ancestor', body => body.replace('class="jr-form"', 'class="jr-form" aria-disabled="true"'), /application/],
  ['wrong form role', body => body.replace('data-slug="business-development-manager-lucknow"', 'data-slug="bde-indore"'), /application/],
  ['foreign company identity', body => body.replace('"legalName":"Vahan Technologies India Pvt. Ltd."', '"legalName":"Other Employer"'), /employer/],
  ['contradictory role country', body => body.replace('Sales · Lucknow, Uttar Pradesh, India', 'Sales · Lucknow, Uttar Pradesh, United States'), /country/],
  ['missing role country', body => body.replace('Sales · Lucknow, Uttar Pradesh, India', 'Sales · Lucknow, Uttar Pradesh'), /country/],
  ['unknown role client', body => body.replace('const m="https://script.google.com', 'const m="https://different.example'), /client/],
]) {
  test('rejects ' + label + ' in a current Vahan role', async () => {
    const source = transport(({ url, body }) => {
      if (url !== ROLE) return null
      const changed = modify(body)
      assert.notEqual(changed, body, 'fixture mutation must exercise the intended failure')
      return { body: changed }
    })
    await assert.rejects(runVahanCurrentNative(source), pattern)
  })
}

test('rejects an unreviewed criteria stylesheet instead of publishing hidden content', async () => {
  const source = transport(({ url, body }) => url.endsWith('/career-role.B2ZynOP3.css') ? { body: body + '.jr-body li{display:none}' } : null)
  await assert.rejects(runVahanCurrentNative(source), /stylesheet/)
})

test('rejects role URL redirects even when the replacement body is a valid role', async () => {
  const source = transport(({ url }) => url === ROLE ? { url: BOARD + 'bde-indore/' } : null)
  await assert.rejects(runVahanCurrentNative(source), /URL identity/)
})

test('rejects inventory changes after closing details and retains no mixed snapshot', async () => {
  const source = transport(({ url, count, body }) => url === BOARD && count === 3 ? { body: body.replace('Business Development Manager - Lucknow', 'Different Role') } : null)
  await assert.rejects(runVahanCurrentNative(source), /closing inventory/)
})

test('rejects a changed requirement between opening and closing detail passes', async () => {
  const source = transport(({ url, count, body }) => url === ROLE && count === 2 ? { body: body.replace('Have 2+ years of experience', 'Have 5+ years of experience') } : null)
  await assert.rejects(runVahanCurrentNative(source), /closing.*criteria/)
})

test('unknown empty employer board remains a coverage gap through runner assessment', async () => {
  const source = transport(({ url, body }) => url === BOARD ? { body: body.replace(/<section class="job-group"[\s\S]*?<\/section>/g, '') } : null)
  const jobs = await runVahanCurrentNative(source)
  assert.equal(jobs.length, 0)
  const result = assessSoftFailureAcquisition(provider, jobs)
  assert.equal(result.runnerOutcome.success, false)
  assert.equal(result.runnerOutcome.softFailure, true)
  assert.equal(result.zeroJobEvidence, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed, false)
})

test('maxJobs retains partial-inventory and cleanup holds without skipping source acquisition', async () => {
  const source = transport(), jobs = await runVahanCurrentNative({ ...source, maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(source.counts.get(ROLE), 2)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readSourceObservationEvidence(jobs, 'vahan').observedVacancyCount, 28)
  assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed, false)
})

test('cancels a transport that ignores abort and preserves the caller reason', async () => {
  const controller = new AbortController(), reason = new Error('Vahan caller cancelled')
  const pending = runVahanCurrentNative({ signal: controller.signal, fetchImpl: () => new Promise(() => {}) })
  controller.abort(reason)
  await assert.rejects(pending, error => error === reason)
})
