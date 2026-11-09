import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import * as wati from '../../scraper/wati/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const place = (country = 'India', countryCode = 'IN', city = 'Bengaluru') => ({ country, countryCode, city, region: city })
const row = (extra = {}) => ({ id: 1, shortcode: 'ABCDEF1234', title: 'Software Engineer', accountUid: wati.ACCOUNT_UID,
  state: 'published', isInternal: false, approvalStatus: 'approved', published: '2026-10-01T10:00:00Z',
  location: place(), locations: [place()], ...extra })
const detail = (extra = {}) => ({ ...row(), description: '<p>Build reliable customer messaging software.</p>', requirements: '<p>Experience with JavaScript.</p>', benefits: '', ...extra })
const fetchFor = (records, changes = {}) => async (url, options) => {
  assert.ok(options.signal)
  return options.method === 'POST' ? { total: records.length, results: records, ...changes.listing } : detail(changes.detail)
}

test('WATI maps explicit India native vacancies with original identity and content', async () => {
  const jobs = await wati.run({ fetchJson: fetchFor([row(), row({ id: 2, shortcode: 'FOREIGN123', location: place('Canada', 'CA', 'Toronto'), locations: [place('Canada', 'CA', 'Toronto')] })]) })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, 'ABCDEF1234')
  assert.equal(jobs[0].company, 'WATI')
  assert.equal(jobs[0].source, 'wati')
  assert.match(jobs[0].jobDescription, /Build reliable/)
  assert.match(jobs[0].jobDescription, /Experience with JavaScript/)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 2)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('WATI returns truthful empty evidence only after counted terminal native inventory', async () => {
  const jobs = await wati.run({ fetchJson: fetchFor([]) })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
})

test('WATI rejects truncated, failed, and ambiguous-country inventories', async () => {
  for (const options of [
    { listing: { total: 2 } }, { listing: { error: 'blocked' } },
    { listing: { results: [row({ location: place('Remote', 'ZZ'), locations: [place('Remote', 'ZZ')] })] } },
  ]) await assert.rejects(wati.run({ fetchJson: fetchFor([row()], options) }))
})

test('WATI retains an India role with missing employer content for downstream checks', async () => {
  const jobs = await wati.run({ fetchJson: fetchFor([row()], { detail: { description: '', requirements: '', benefits: '' } }) })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('WATI verifies detail identity against the listing', async () => {
  await assert.rejects(wati.run({ fetchJson: fetchFor([row()], { detail: { shortcode: 'FOREIGN123' } }) }), /identity/i)
})

test('WATI honors cancellation and bounds a transport that ignores signals', async () => {
  const controller = new AbortController()
  controller.abort(Error('stop WATI'))
  await assert.rejects(wati.run({ signal: controller.signal, fetchJson: async () => assert.fail('must not fetch') }), /stop WATI/)
  await assert.rejects(wati.run({ timeoutMs: 20, fetchJson: () => new Promise(() => {}) }), /timed out/i)
})

test('WATI follows native cursors and reconciles the unfiltered total before mapping details', async () => {
  const calls = []
  const foreign = row({ id: 2, shortcode: 'FOREIGN123', location: place('Canada', 'CA', 'Toronto'), locations: [place('Canada', 'CA', 'Toronto')] })
  const jobs = await wati.run({ fetchJson: async (url, options) => {
    calls.push(url)
    if (options.method !== 'POST') return detail()
    const body = JSON.parse(options.body)
    assert.equal(body.query, '')
    assert.deepEqual(body.location, [])
    return body.token ? { total: 2, results: [foreign] } : { total: 2, results: [row()], nextPage: 'next-native-page' }
  } })
  assert.equal(calls.length, 3)
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs).pagesFetched, 2)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('WATI observed official six-page inventory returns all 17 native India roles', async () => {
  const root = new URL('../../scraper/wati/fixtures/', import.meta.url)
  const listings = JSON.parse(readFileSync(new URL('listing-responses.json', root)))
  const details = JSON.parse(readFileSync(new URL('detail-responses.json', root)))
  let page = 0
  const jobs = await wati.run({ fetchJson: async (url, options) => {
    if (options.method === 'POST') {
      const capture = listings[page++]
      assert.equal(url, capture.url)
      assert.deepEqual(JSON.parse(options.body), typeof capture.requestBody === 'string' ? JSON.parse(capture.requestBody) : capture.requestBody)
      return JSON.parse(capture.body)
    }
    const capture = details.find(item => item.url === url)
    assert.ok(capture, 'only captured native India details are requested')
    return JSON.parse(capture.body)
  } })
  assert.equal(page, 6)
  assert.equal(jobs.length, 17)
  assert.deepEqual(jobs.map(job => job.jobId).sort(), details.map(capture => JSON.parse(capture.body).shortcode).sort())
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 57)
  assert.equal(readInventoryEvidence(jobs).pagesFetched, 6)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('WATI official binding and captured response hashes remain inspectable', () => {
  const root = new URL('../../scraper/wati/fixtures/', import.meta.url)
  const metadata = JSON.parse(readFileSync(new URL('metadata.json', root)))
  for (const entry of metadata.responses) {
    const bytes = readFileSync(new URL(entry.file, root))
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.captureSha256)
    const decoded = JSON.parse(bytes)
    const response = entry.responseIndex == null ? decoded : decoded[entry.responseIndex]
    assert.equal(response.status, 200)
    assert.equal(createHash('sha256').update(response.body).digest('hex'), entry.bodySha256)
  }
  const careers = JSON.parse(readFileSync(new URL('careers-response.json', root)))
  assert.match(careers.body, /href="https:\/\/apply\.workable\.com\/wati-dot-i-o\/"/)
  const account = JSON.parse(JSON.parse(readFileSync(new URL('account-response.json', root))).body)
  assert.equal(account.uid, wati.ACCOUNT_UID)
  assert.equal(account.subdomain, 'wati-dot-i-o')
  assert.equal(account.name, 'WATI.io')
  assert.equal(account.url, 'https://www.wati.io/')
})
