import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { run, LISTING_API_URL } from './script.js'
import { extractActiveDescription } from './nativeContent.js'
const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/native-current-20261020.json', import.meta.url)))
const empty = () => {
  const p = structuredClone(fixture.listing)
  p.data.data = []; p.data.totalCount = 0; p.data.hasMoreData = false
  return p
}
const execute = payload => run({ now: () => '2026-10-20T23:00:00.000Z', fetchJson: async () => payload })

for (const [label, mutate] of [
  ['error text', p => { p.error = 'upstream unavailable' }],
  ['error list', p => { p.errors = ['upstream unavailable'] }],
  ['failure status', p => { p.success = false }],
  ['HTTP error code', p => { p.statusCode = 500 }],
  ['nested error', p => { p.data.error = 'upstream unavailable' }],
  ['array total', p => { p.data.totalCount = [0] }],
  ['array page size', p => { p.data.facetedSearchConfig.paginationHowMuch = [12] }],
]) test(`${label} cannot certify a complete empty InfoEdge inventory`, async () => {
  const p = empty(); mutate(p)
  await assert.rejects(execute(p))
})

test('default native transport requires exact HTTP200 and endpoint identity', async () => {
  const original = globalThis.fetch
  try {
    for (const [status, url] of [[202, LISTING_API_URL], [206, LISTING_API_URL], [200, LISTING_API_URL + '/other']]) {
      globalThis.fetch = async () => ({ ok: true, status, url, json: async () => empty() })
      await assert.rejects(run({ now: () => '2026-10-20T23:00:00.000Z' }))
    }
  } finally { globalThis.fetch = original }
})

for (const value of ['<div hidden>Develop software and support customers</div>',
  '<p style="display:none">Develop software and support customers</p>',
  '<div aria-hidden="true">Develop software and support customers</div>',
  'See attachment', 'JD attached', 'Job Description']) {
  test('hidden or attachment-placeholder text cannot supply a complete native role description', () => {
    assert.equal(extractActiveDescription(value), null)
  })
}

test('visible role content survives while explicitly hidden text is excluded', () => {
  assert.equal(extractActiveDescription('<p>Develop and test software applications.</p><span hidden>Internal placeholder</span>'),
    'Develop and test software applications.')
})
