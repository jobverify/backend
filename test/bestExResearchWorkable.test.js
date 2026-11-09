import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { run } from '../scraper/bestexresearch/script.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/bestexresearch/native.json', import.meta.url)))
const exercise = async ({ pages = [{ results: [fixture.foreign], total: 2, nextPage: 'native-cursor' },
  { results: [fixture.india], total: 2 }], detail = fixture.detail, ...options } = {}) => {
  let page = 0
  const requests = []
  const jobs = await run({ ...options, now: () => '2026-10-20T22:00:00.000Z', fetchJson: async (url, init = {}) => {
    requests.push({ url, body: init.body && JSON.parse(init.body) })
    if (init.method === 'POST') return structuredClone(pages[page++])
    return structuredClone(detail)
  } })
  return { jobs, requests }
}

test('BestEx uses the officially bound Workable account and paginates unified full descriptions', async () => {
  const { jobs, requests } = await exercise()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'BestEx Research')
  assert.equal(jobs[0].jobId, '3B47AFBD68')
  assert.equal(jobs[0].companyDomain, 'bestexresearch.com')
  assert.equal(jobs[0].applyUrl, 'https://apply.workable.com/bestex-research/j/3B47AFBD68/apply/')
  assert.match(jobs[0].sourceDescription, /FIX/)
  assert.ok(!jobs[0].sourceDescription.endsWith('Benefits\n'))
  assert.equal(requests.length, 3)
  assert.equal(requests[1].body.token, 'native-cursor')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 2)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 1)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('BestEx keeps identity, native geography and complete cursor guards despite optional empty sections', async () => {
  for (const overrides of [
    { accountUid: 'other-company' }, { shortcode: 'WRONGID' }, { title: 'Unrelated role' },
    { isInternal: true }, { state: 'draft' }, { approvalStatus: 'pending' },
    { description: '' }, { description: '<script>window.ready=true;</script>' }, { benefits: {} },
    { location: { ...fixture.detail.location, countryCode: 'US' } },
  ]) await assert.rejects(exercise({ detail: { ...fixture.detail, ...overrides } }))
  await assert.rejects(exercise({ pages: [{ results: [fixture.india], total: 2 }] }), /incomplete/i)
  await assert.rejects(exercise({ pages: [{ results: [fixture.india], total: 2, nextPage: 'repeat' },
    { results: [fixture.india], total: 2 }] }), /duplicate/i)
})

test('BestEx zero and output caps keep exact first-party inventory scope', async () => {
  const empty = await exercise({ pages: [{ results: [], total: 0 }] })
  assert.equal(readInventoryEvidence(empty.jobs).status, 'verified-empty')
  const foreign = await exercise({ pages: [{ results: [fixture.foreign], total: 1 }] })
  assert.equal(readInventoryEvidence(foreign.jobs).status, 'complete-inventory')
  assert.equal(readInventoryEvidence(foreign.jobs).indiaFacetCount, 0)
  for (const location of [
    { ...fixture.foreign.location, country: 'Unknownland' },
    { ...fixture.foreign.location, countryCode: ['US'] },
  ]) await assert.rejects(exercise({ pages: [{ results: [{ ...fixture.foreign, location, locations: [location] }], total: 1 }] }), /country|location/i)
  await assert.rejects(exercise({ maxPages: 1 }), /incomplete/i)
})

test('Workable non-country regions, impossible dates and explicit error envelopes cannot prove successful inventory', async () => {
  const names = new Intl.DisplayNames(['en'], { type: 'region' })
  for (const countryCode of ['EU', 'UN', 'QO']) {
    const location = { ...fixture.foreign.location, countryCode, country: names.of(countryCode) }
    await assert.rejects(exercise({ pages: [{ results: [{ ...fixture.foreign, location, locations: [location] }], total: 1 }] }))
  }
  for (const published of ['not-a-date', '2026-02-30T00:00:00.000Z', '2099-01-01T00:00:00.000Z']) {
    await assert.rejects(exercise({ detail: { ...fixture.detail, published } }))
  }
  await assert.rejects(exercise({ detail: { ...fixture.detail, published: '2026-09-26T00:00:00.000Z' } }))
  for (const status of [503, 'error']) {
    await assert.rejects(exercise({ pages: [{ results: [], total: 0, status }] }))
    await assert.rejects(exercise({ detail: { ...fixture.detail, status } }))
  }
})
