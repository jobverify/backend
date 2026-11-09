import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { statSync, readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createCodingNinjasScraper } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const homepage = '<h1>Coding Ninjas</h1><a href="https://codingninjas.keka.com/careers">Careers</a>'
const response = (url, body, status = 200) => ({ url, status, text: async () => body })
const expectedGap = jobs => {
  assert.deepEqual([...jobs], [])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  return evidence
}
const captures = [JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/official-response.json.gz', import.meta.url)))), JSON.parse(readFileSync(new URL('./fixtures/board-response.json', import.meta.url))), ...JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-responses.json.gz', import.meta.url))))]
const replay = (mutate = x => x) => async url => {
  const capture = captures.find(x => x.url === url)
  assert.ok(capture, `unexpected request ${url}`)
  const value = mutate({ ...capture })
  return response(value.finalUrl, value.body, value.status)
}

test('fresh official handoff and captured unfiltered tenant inventory certify real zero', async () => {
  const jobs = await createCodingNinjasScraper({ fetchImpl: replay() }).run()
  assert.equal(jobs.length, 0)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'verified-empty')
  assert.equal(evidence.firstParty, true)
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.reportedTotal, 0)
  assert.equal(evidence.indiaFacetCount, 0)
  assert.equal(evidence.pagesFetched, 7)
})

test('changed tenant, portal identity, client contract or nonempty unsampled records cannot certify zero', async () => {
  for (const mutate of [
    x => x.url.endsWith('/careers') ? { ...x, body: x.body.replaceAll('0ec89a02-c247-4dc7-b554-64ae46e3ffc5', 'other-tenant') } : x,
    x => x.url.endsWith('careerportalinfo') ? { ...x, body: x.body.replace('codingninjas.keka.com', 'other.keka.com') } : x,
    x => x.url.includes('/embedjobs/js/') ? { ...x, body: x.body + '\n// changed contract' } : x,
    x => x.url.includes('/default/active/') ? { ...x, body: '[{"id":"new-job"}]' } : x,
    x => x.url.includes('/grouplinkstatus/') ? { ...x, body: '{"isGroupLinked":true}' } : x,
    x => x.url.includes('/grouplinkstatus/') ? { ...x, body: '{}' } : x,
  ]) expectedGap(await createCodingNinjasScraper({ fetchImpl: replay(mutate) }).run())
})

test('commented expected tenant cannot mask a foreign actual widget configuration', async () => {
  expectedGap(await createCodingNinjasScraper({ fetchImpl: replay(x => x.url.includes('/careerportal/') && x.url.endsWith('.html') ? { ...x, body: x.body.replace("identifier: '0ec89a02-c247-4dc7-b554-64ae46e3ffc5'", "identifier: 'foreign' /* identifier: '0ec89a02-c247-4dc7-b554-64ae46e3ffc5' */") } : x) }).run())
})

test('a denied current Keka board is failed coverage rather than a successful empty inventory', async () => {
  const jobs = await createCodingNinjasScraper({ fetchImpl: async url => response(url,
    url === 'https://www.codingninjas.com/' ? homepage : 'Forbidden', url === 'https://www.codingninjas.com/' ? 200 : 403) }).run()
  const evidence = expectedGap(jobs)
  assert.equal(evidence.pagesFetched, 1)
  assert.match(evidence.reason, /403/)
})

test('a historical endpoint returning [] cannot certify an unobserved current native contract', async () => {
  const jobs = await createCodingNinjasScraper({ fetchImpl: async url => response(url,
    url === 'https://www.codingninjas.com/' ? homepage : url.endsWith('/careers') ? '<title>Coding Ninjas Careers</title>' : '[]') }).run()
  assert.match(expectedGap(jobs).reason, /shell|contract-unverified/)
})

test('inactive handoff and redirect identity changes cannot establish employer identity', async () => {
  for (const html of [`<template>${homepage}</template>`, `<div hidden>${homepage}</div>`, `<div style="content-visibility:hidden">${homepage}</div>`, `<script>${homepage}</script>`, '<title>Coding Ninjas</title>']) {
    const evidence = expectedGap(await createCodingNinjasScraper({ fetchImpl: async url => response(url, html) }).run())
    assert.equal(evidence.firstParty, false)
  }
  const evidence = expectedGap(await createCodingNinjasScraper({ fetchImpl: async () => response('https://elsewhere.example/', homepage) }).run())
  assert.equal(evidence.firstParty, false)
})

test('overall timeout bounds a fetch or body reader that ignores cancellation', async () => {
  for (const fetchImpl of [async () => new Promise(() => {}), async url => ({ url, status: 200, text: () => new Promise(() => {}) })]) {
    const jobs = await createCodingNinjasScraper({ fetchImpl, timeoutMs: 20 }).run()
    assert.match(expectedGap(jobs).reason, /timed out/)
  }
})

test('caller cancellation rejects promptly even when upstream ignores the signal', async () => {
  const controller = new AbortController()
  const pending = createCodingNinjasScraper({ fetchImpl: async () => new Promise(() => {}), timeoutMs: 1000 }).run({ signal: controller.signal })
  controller.abort(new Error('caller cancelled'))
  await assert.rejects(pending, /caller cancelled/)
})

test('importing with --dry-run causes no fetch or persistence side effects', () => {
  const moduleUrl = new URL('./script.js', import.meta.url).href
  const output = new URL('./jobs.json', import.meta.url)
  const before = statSync(output).mtimeMs
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `process.argv.push('--dry-run'); globalThis.fetch = () => { throw Error('unexpected import fetch') }; await import(${JSON.stringify(moduleUrl)}); console.log('inert')`], { encoding: 'utf8', timeout: 3000 })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout.trim(), 'inert')
  assert.equal(statSync(output).mtimeMs, before)
})
