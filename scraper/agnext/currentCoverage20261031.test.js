import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run, OFFICIAL_CAREERS_URL, JOB_OPENINGS_URL } from './script.js'
import { registerCurrentRecruitmentContract } from '../../scraper-support/tests/helpers/currentRecruitmentContract.js'

const input = JSON.parse(gunzipSync(readFileSync(new URL('./test-inputs/current-denial-20261031.json.gz', import.meta.url))))
const replay = (change = packet => packet) => {
  const calls = []
  return { calls, fetchImpl: async url => {
    calls.push(url)
    const packet = change(structuredClone(new URL(url).hostname.replace(/^www\./, '') === 'agnext.com' ? input.home : input.denial))
    const response = new Response(packet.body, { status: packet.status, headers: { 'content-type': packet.contentType } })
    Object.defineProperty(response, 'url', { value: packet.finalUrl })
    return response
  } }
}

test('the current AgNext forbidden redirect retains unknown coverage and the actual observed HTTP status', async () => {
  const options = replay()
  await assert.rejects(run(options), error => {
    assert.equal(error.failureKind, 'coverage_gap')
    assert.equal(error.softFailure, true)
    const evidence = error.recruitmentObservations
    assert.equal(evidence.nativeRecords, 0)
    assert.equal(evidence.sourceScopeComplete, false)
    assert.equal(evidence.lifecycleCleanupAllowed, false)
    const denial = evidence.receipts.find(row => row.requestedURL === JOB_OPENINGS_URL)
    assert.equal(denial.status, input.denial.status)
    assert.equal(denial.finalURL, input.denial.finalUrl)
    return true
  })
  assert.ok(options.calls.includes(OFFICIAL_CAREERS_URL))
  assert.ok(options.calls.includes(JOB_OPENINGS_URL))
})

for (const [name, change] of [
  ['commented', body => body.replace(/(<a\b[^>]*href="https:\/\/agnext\.keka\.com\/careers"[^>]*>[\s\S]*?<\/a>)/g, '<!-- $1 -->')],
  ['hidden', body => body.replace(/<a\b([^>]*href="https:\/\/agnext\.keka\.com\/careers"[^>]*)>/g, '<a hidden$1>')],
]) test('a ' + name + ' link in the actual homepage cannot bind the Keka employer', async () => {
  const options = replay(packet => packet.url === OFFICIAL_CAREERS_URL ? { ...packet, body: change(packet.body) } : packet)
  await assert.rejects(run(options), error => error.failureKind === 'coverage_gap')
  assert.ok(options.calls.every(url => new URL(url).hostname.replace(/^www\./, '') === 'agnext.com'))
})

test('a successful foreign redirect cannot become an employer-bound generic Keka shell', async () => {
  const options = replay(packet => packet.url === input.denial.url ? { ...packet, body: '<title>AgNext</title><app-root></app-root>', finalUrl: 'https://other.example/careers' } : packet)
  await assert.rejects(run(options), error => {
    assert.equal(error.failureKind, 'coverage_gap')
    assert.equal(error.recruitmentObservations.nativeRecords, 0)
    assert.ok(error.recruitmentObservations.failures.some(row => /redirect/i.test(row.message)))
    return true
  })
})

registerCurrentRecruitmentContract('agnext', 'captured boundary and current extraction')
