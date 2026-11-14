import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { assessSoftFailureAcquisition } from '../../scripts/softFailureAssessment20261113.mjs'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-20261114/native-responses.json.gz', import.meta.url))))
const HOME = 'https://www.vahan.co/', BOARD = HOME + 'careers/'
const ROLE = BOARD + 'business-development-manager-lucknow/'
const BASE = HOME + '_astro/Base.astro_astro_type_script_index_0_lang.D04DSgcs.js'
const provider = { source: 'vahan', companyName: 'Vahan', countryFilter: 'India', sourceScopeComplete: false, lifecycleCleanupAllowed: false }
function transport(change = () => null) {
  const requests = [], counts = new Map()
  return { requests, counts, fetchImpl: async (url, options) => {
    assert.equal(options.method, 'GET'); options.signal.throwIfAborted()
    const count = (counts.get(url) || 0) + 1
    counts.set(url, count); requests.push(url)
    const rows = fixture.responses.filter(row => row.requestedUrl === url)
    assert.ok(rows.length, 'No actual captured public response: ' + url)
    const receipt = rows[Math.min(count - 1, rows.length - 1)], original = fixture.entities[receipt.sha256]
    const changed = change({ url, count, body: original })
    const response = new Response(changed?.body ?? original, { status: receipt.status })
    Object.defineProperty(response, 'url', { value: receipt.url })
    return response
  } }
}
const mutate = (body, before, after) => {
  const changed = body.replace(before, after)
  assert.notEqual(changed, body, 'Mutation must change actual response bytes')
  return { body: changed }
}

test('actual current Vahan response bodies retain their captured SHA256 hashes', () => {
  for (const [sha, body] of Object.entries(fixture.entities)) assert.equal(createHash('sha256').update(body).digest('hex'), sha)
  assert.equal(fixture.responses.find(row => row.requestedUrl.endsWith('/styles.DSJzDw_Y.css')).status, 404)
})

test('registered current deployment returns 28 full employer India roles without requesting removed assets', async () => {
  const io = transport(), jobs = await run({ ...io, now: () => fixture.capturedAt })
  assert.equal(jobs.length, 28); assert.equal(new Set(jobs.map(row => row.jobId)).size, 28)
  assert.ok(jobs.every(row => row.company === 'Vahan' && row.country === 'India' && row.sourceDetailComplete
    && row.sourceScopeComplete === false && row.lifecycleCleanupAllowed === false && row.postingDate === null
    && row.applyUrl === row.sourceUrl + '#apply' && row.sourceDescription === row.jobDescription))
  assert.ok(jobs.every(row => row.sourceUrl.startsWith(BOARD) && row.sourceDescription.length > 200))
  assert.equal(io.counts.get(ROLE), 2); assert.equal(io.counts.get(BOARD), 3)
  assert.ok(!io.requests.some(url => url.includes('/jobs/') || url.includes('script.google.com') || url.includes('DSJzDw_Y')))
  assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed, false)
  const result = assessSoftFailureAcquisition(provider, jobs)
  assert.equal(result.runnerOutcome.success, true); assert.equal(result.eligibleJobs, 28)
  assert.deepEqual(result.cleanupOptions, { replaceExisting: false })
  const manager = jobs.find(row => row.sourceUrl === ROLE)
  assert.match(manager.sourceDescription, /Have 2\+ years of experience in offline sales/)
  assert.match(manager.sourceDescription, /Have experience in BDM supply, ground sales, or B2B sales/)
})

for (const path of ['styles.DCxPlcQy.css', 'responsive.CrAE6xt2.css',
  'Base.astro_astro_type_script_index_0_lang.D04DSgcs.js',
  'LeadGenOtpForm.astro_astro_type_script_index_0_lang.DFChJR4U.js',
  'index.astro_astro_type_script_index_0_lang.D1jvhht4.js',
  'swipe.DY0ALsqN.js', 'turnstile.D0BTt4Nh.js']) {
  test('current deployment requires exact published asset bytes: ' + path, async () => {
    const io = transport(({ url, body }) => url === HOME + '_astro/' + path ? { body: body + '\n/* changed program */' } : null)
    await assert.rejects(run(io), /unreviewed.*(?:stylesheet|client|program)/i)
    assert.equal(io.requests.some(url => url === ROLE), false)
  })
}

for (const [label, before, after] of [
  ['changed root-scaling initializer', "d.style.setProperty('--z',String(w/1920))", "d.style.setProperty('--z','0')"],
  ['duplicate module activation', '</body>', '<script type="module" src="/_astro/Base.astro_astro_type_script_index_0_lang.D04DSgcs.js"></script></body>'],
  ['inert module declaration', '<script type="module" src="/_astro/Base.', '<template><script type="module" src="/_astro/Base.'],
  ['module event handler', '<script type="module" src="/_astro/Base.', '<script onload="otherProgram()" type="module" src="/_astro/Base.'],
]) {
  test('current listing rejects ' + label, async () => {
    const io = transport(({ url, body }) => url === BOARD ? mutate(body, before, after) : null)
    await assert.rejects(run(io), /client|program|contract|declaration|document/i)
  })
}

test('mixed old and current stylesheet declarations never select a fallback deployment', async () => {
  const io = transport(({ url, body }) => url === BOARD
    ? mutate(body, 'styles.DCxPlcQy.css', 'styles.DSJzDw_Y.css') : null)
  await assert.rejects(run(io), /deployment|stylesheet|contract/)
  assert.equal(io.requests.some(url => url.includes('/_astro/')), false)
})

test('the exact head scrollbar rule does not admit any additional inline CSS', async () => {
  const io = transport(({ url, body }) => url === BOARD
    ? mutate(body, 'html{scrollbar-gutter:stable}', 'html{scrollbar-gutter:stable}.job-row{display:none}') : null)
  await assert.rejects(run(io), /inline stylesheet|criteria/)
})

for (const [label, before, after] of [
  ['criteria-bound decorative animation', 'class="jr-body"', 'class="jr-body logo-strip-track"'],
  ['application-bound video handler', 'class="jr-form"', 'class="jr-form" data-video="dQw4w9WgXcQ"'],
  ['unreviewed application event', 'class="jr-form"', 'class="jr-form" onsubmit="return false"'],
  ['video handler on the page ancestor', '<body', '<body data-video="dQw4w9WgXcQ"'],
  ['foreign document base', '</head>', '<base href="https://other.example/"></head>'],
  ['case-insensitive additional stylesheet', '</head>', '<link rel="StyleSheet" href="https://other.example/criteria.css"></head>'],
  ['additional stylesheet in a rel-token list', '</head>', '<link rel="other STYLESHEET" href="https://other.example/criteria.css"></head>'],
  ['refresh document handoff', '</head>', '<meta http-equiv="Refresh" content="0;url=https://other.example/"></head>'],
]) {
  test('current document rejects ' + label, async () => {
    const io = transport(({ url, body }) => url === ROLE ? mutate(body, before, after) : null)
    await assert.rejects(run(io), /binding|event|base|stylesheet|document|delegat|handoff|contract/)
  })
}

for (const [label, before, after] of [
  ['hidden body ancestor', '<body', '<body hidden'],
  ['inert body ancestor', '<body', '<body inert'],
  ['contradictory workplace country', 'Sales · Lucknow, Uttar Pradesh, India', 'Sales · Lucknow, Uttar Pradesh, United States'],
  ['closed role notice', 'Have 2+ years of experience', 'This position is closed. Have 2+ years of experience'],
]) {
  test('current role rejects ' + label, async () => {
    const io = transport(({ url, body }) => url === ROLE ? mutate(body, before, after) : null)
    await assert.rejects(run(io), /criteria|country|title|canonical|closed|missing|client/)
  })
}

test('changed full authored criteria at closing rejects the current snapshot', async () => {
  const io = transport(({ url, count, body }) => url === ROLE && count === 2
    ? mutate(body, 'Have 2+ years of experience', 'Have 5+ years of experience') : null)
  await assert.rejects(run(io), /closing.*criteria/)
})

test('a changed current Base program at closing rejects opening-only evidence', async () => {
  const io = transport(({ url, count, body }) => url === BASE && count === 2 ? { body: body + ';void 0' } : null)
  await assert.rejects(run(io), /unreviewed.*(?:client|program)/)
})

test('current document rejects a video URL wrapping the native submit button', async () => {
  const io = transport(({ url, body }) => url === ROLE ? mutate(body,
    /(<button class="btn grad-290 jr-submit"[\s\S]*?<\/button>)/,
    '<a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">$1</a>') : null)
  await assert.rejects(run(io), /client binding/)
})

test('current document rejects a mobile dropdown binding on the native form', async () => {
  const io = transport(({ url, body }) => url === ROLE ? mutate(body,
    'class="jr-form"', 'class="jr-form nav-item has-dropdown"') : null)
  await assert.rejects(run(io), /client binding/)
})

test('opaque caller cancellation during current acquisition is preserved and starts no later requests', async () => {
  const controller = new AbortController(), reason = Symbol('Vahan caller')
  const io = transport(({ url }) => { if (url === BOARD) controller.abort(reason); return null })
  await assert.rejects(run({ ...io, signal: controller.signal }), error => error === reason)
  assert.deepEqual(io.requests, [HOME, BOARD])
})
