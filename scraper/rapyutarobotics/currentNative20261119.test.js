import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261119/current-native.json.gz', import.meta.url))))
const root = 'https://www.rapyuta-robotics.com/careers/'
const key = value => { const url = new URL(value); url.searchParams.delete('_'); return url.href }
const options = (change = (_url, body) => body) => {
  const counts = new Map()
  return { now: () => '2026-11-19T02:37:12.000Z',
    fetchText: async url => fixture.packets.find(packet => packet.requestUrl === url)?.body,
    fetchImpl: async (url, init) => {
      assert.equal(init.method, 'GET')
      assert.doesNotMatch(url, /\/apply(?:[/?]|$)/)
      const packet = fixture.packets.find(packet => key(packet.requestUrl) === key(url)
        || packet.url === url)
      assert.ok(packet, 'Only the current declared public endpoints and own roles: ' + url)
      const count = (counts.get(key(url)) || 0) + 1; counts.set(key(url), count)
      const changed = change(url, packet.body, count)
      const body = typeof changed === 'string' ? changed : changed.body
      return Object.defineProperty(new Response(body, { status: changed.status || packet.status,
        headers: { 'content-type': packet.contentType } }), 'url', {
        value: changed.url || (packet.requestUrl === packet.url ? url : packet.url),
      })
    } }
}

test('Rapyuta follows its current first-party Bento Jobs declarations and retains every original native observation before India selection', async () => {
  const jobs = await run(options())
  assert.equal(jobs.length, 8)
  assert.equal(jobs[0].jobId, '7B321E7D97')
  assert.ok(jobs.every(job => job.country === 'India' && job.sourceDetailComplete === true && job.lifecycleCleanupAllowed === false))
  assert.equal(readSourceObservationEvidence(jobs, 'rapyutarobotics').observedVacancyCount, 37)
  assert.equal(jobs.nativeCollectionEvidence.originalIndex.index['3EE3968348'].split('\n')[0], 'Account Sales')
  assert.equal(jobs.nativeCollectionEvidence.originalListings.length, 37)
  assert.equal(jobs.nativeCollectionEvidence.fullRoles.length, 8)
  const frontend = jobs.find(job => job.jobId === '457595D608')
  assert.match(frontend.sourceDescription, /TypeScript/)
  assert.match(frontend.sourceDescription, /Benefits/)
  assert.equal(frontend.sourceUrl, 'https://apply.workable.com/rapyuta-robotics/j/457595D608')
  assert.equal(frontend.applyUrl, 'https://apply.workable.com/j/457595D608/apply')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed, false)
  assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete, false)
})

for (const [label, mutate] of [
  ['foreign application account', value => ({ ...value, apply_url: 'https://evil.test/apply' })],
  ['wrong native role', value => ({ ...value, shortcode: 'OTHER12345' })],
  ['missing criteria', value => ({ ...value, html: '<div class="bj-detail" data-key="457595D608"><div class="bj-detail-body"></div></div>' })],
]) {
  test('Rapyuta holds a ' + label + ' while retaining its observed record and other qualified roles', async () => {
    const jobs = await run(options((url, body) => new URL(url).searchParams.get('shortcode') === '457595D608'
      ? JSON.stringify(mutate(JSON.parse(body))) : body))
    assert.equal(jobs.length, 7)
    assert.ok(!jobs.some(job => job.jobId === '457595D608'))
    assert.equal(readSourceObservationEvidence(jobs, 'rapyutarobotics').observedVacancyCount, 37)
    assert.ok(jobs.nativeCollectionEvidence.failures.some(failure => failure.id === '457595D608'))
  })
}

test('Rapyuta rejects a changed renderer or publisher instead of promoting a string endpoint', async () => {
  for (const change of [
    (url, body) => url.includes('bento-jobs.js') ? body.replace('getJSON', 'changedGET') : body,
    (url, body) => url === root ? body.replaceAll('Rapyuta Robotics', 'Different Employer') : body,
    (url, body) => url === root ? body.replaceAll('data-account="rapyuta-robotics"', 'data-account="unrelated"') : body,
  ]) await assert.rejects(run(options(change)), /native|publisher|renderer|account|Bento/i)
})

test('Rapyuta revokes staged jobs when the closing native criteria change', async () => {
  await assert.rejects(run(options((url, body, count) => new URL(url).searchParams.get('shortcode') === '457595D608' && count === 2
    ? body.replace('TypeScript', 'Changed criteria') : body)), /closing|changed|criteria/i)
})

test('Rapyuta caller output caps preserve all original native observations and acquired full roles', async () => {
  const jobs = await run({ ...options(), maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(jobs.nativeCollectionEvidence.originalListings.length, 37)
  assert.equal(jobs.nativeCollectionEvidence.fullRoles.length, 8)
})
