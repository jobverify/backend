import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { CAREERS_URL, createLifeSignsScraper, extractVerifiedOpenRoles } from './script.js'
import { resolveJobPublicationDate } from '../../src/utils/jobPublicationDate.js'
import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261107/current-native-publication.json.gz', import.meta.url))))
const feedBytes = Buffer.from(fixture.publicFeed.bodyBase64, 'base64')
const items = JSON.parse(feedBytes).dataItems
const clock = '2026-11-07T08:30:00.000Z'
const pages = new Map(fixture.pages.map(row => [row.receipt.request.url, { ...row.receipt, html: Buffer.from(row.bodyBase64, 'base64').toString('utf8') }]))
const careersHTML = pages.get(CAREERS_URL).html
// Explicit projection of retained current HTML for the existing snapshot API.
// The whole-oracle test below separately exercises the actual default parser.
const careers = { status: 200, url: CAREERS_URL, title: careersHTML.match(/<title[^>]*>([\s\S]*?)<\/title>/i)[1], text: careersHTML.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ') }
const detailSnapshots = Object.fromEntries(items.map(item => {
  const url = 'https://www.lifesigns.us/careers/' + item.data.slug + '/', row = pages.get(url)
  return [new URL(url).pathname, { status: row.status, url: row.finalURL, title: row.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)[1] }]
}))
const expectedDates = {
  'eae87bc3-398d-4cad-9063-3ce9841aa8c6': '2026-07-15T13:15:35.148Z',
  'bdb69df1-b5cf-4ee6-b7b2-98c332aede01': '2026-07-15T13:11:32.120Z',
  'c349bf34-944d-4ace-9544-1eab27d29d75': '2025-12-06T09:07:33.118Z',
  'f6aa45be-281e-45a0-9eb8-a08e25359864': '2025-12-06T09:07:33.118Z',
}
const extract = item => extractVerifiedOpenRoles(careers, [item], detailSnapshots)[0]
const withDate = value => { const item = structuredClone(items[0]); item.data._publishDate = value; return item }
const normalized = job => normalizeScrapedJob({ ...job, source: 'lifesigns', scrapedAt: clock }, { source: 'lifesigns', company: 'LifeSigns' })

test('publication fixture preserves complete original public feed and six original HTML bodies without grant material', () => {
  assert.equal(feedBytes.length, 73021)
  assert.equal(createHash('sha256').update(feedBytes).digest('hex'), '5638dafb832136c16a6f64d202d1395fac4798c1014342d63c080fadfb8e8e58')
  assert.equal(items.length, 4); assert.equal(fixture.pages.length, 6)
  assert.deepEqual(fixture.nativeExpectedPublicationDates, expectedDates)
  for (const row of fixture.pages) {
    const body = Buffer.from(row.bodyBase64, 'base64')
    assert.equal(body.length, row.receipt.bodyBytes)
    assert.equal(createHash('sha256').update(body).digest('hex'), row.receipt.bodySHA256)
  }
})

for (const item of items) test('actual native wrapper retains original source publication date through extractor and backend normalizer: ' + item.id, t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(clock) })
  const original = JSON.stringify(item), job = extract(item), result = normalized(job), expected = expectedDates[item.id]
  // Meaningful RED: before repair these genuine objects become observation dates.
  assert.equal(result.postedAtProvenance, 'source')
  assert.equal(result.postedAt.toISOString(), expected)
  assert.equal(resolveJobPublicationDate({ ...job, scrapedAt: clock }).provenance, 'source')
  assert.equal(job.postingDate, expected)
  assert.deepEqual(job.sourceNativePublicationEvidence, { field: '_publishDate', rawValue: { $date: expected }, value: expected })
  assert.equal(JSON.stringify(item), original)
  assert.equal(job.country, null); assert.equal(job.location, null); assert.equal(job.nativeGeographyQualified, false)
  assert.equal(job.sourceScopeComplete, false); assert.equal(job.sourceListingComplete, false); assert.equal(job.lifecycleCleanupAllowed, false)
})

test('complete genuine controlled source output differs only native postingDate and its explicit evidence', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(clock) })
  const calls = [], originalFeed = JSON.stringify(items)
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    const page = pages.get(url); assert.ok(page, 'no additional HTTP, token, role or application route')
    calls.push({ url, init })
    return { status: page.status, url: page.finalURL, headers: new Headers({ 'content-type': page.mime }), text: async () => page.html }
  })
  const jobs = await createLifeSignsScraper().run({ fetchRoleItems: async () => items })
  // Historical country-null/date oracles remain byte-exact in the fixture.
  // Reverse only this successor country/evidence/inventory-reason delta first;
  // all original date assertions and their original pre-date reversal follow.
  const current = { qualification: fixture.before.qualification, clock, jobs, inventory: readInventoryEvidence(jobs), calls }
  assert.deepEqual(jobs.map(job => job.country), ['India', 'India', 'India', 'India'])
  assert.ok(jobs.every(job => job.location === null && job.city === null && job.state === null))
  const actual = structuredClone(current)
  for (const job of actual.jobs) {
    job.country = null
    job.nativeGeographyQualified = false
    delete job.sourceNativeRoleCountryEvidence
  }
  actual.inventory.reason = fixture.after.inventory.reason
  assert.deepEqual(actual, fixture.after)
  assert.equal(JSON.stringify(actual), JSON.stringify(fixture.after))
  const reversed = structuredClone(actual)
  for (const job of reversed.jobs) {
    job.postingDate = job.sourceNativePublicationEvidence.rawValue
    delete job.sourceNativePublicationEvidence
  }
  assert.deepEqual(reversed, fixture.before)
  assert.equal(JSON.stringify(reversed), JSON.stringify(fixture.before))
  assert.equal(JSON.stringify(items), originalFeed)
  assert.deepEqual(actual.jobs.map(job => job.country), [null, null, null, null])
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

for (const [name, value] of [
  ['empty wrapper', {}],
  ['unknown wrapper key', { date: '2026-07-15T13:15:35.148Z' }],
  ['extra ambiguous date', { $date: '2026-07-15T13:15:35.148Z', date: '2026-11-07T08:30:00.000Z' }],
  ['extra foreign carrier', { $date: '2026-07-15T13:15:35.148Z', country: 'US' }],
  ['nonstring numeric date', { $date: 1784121335148 }],
  ['nested wrapper', { $date: { $date: '2026-07-15T13:15:35.148Z' } }],
  ['empty date', { $date: '' }],
  ['unknown text date', { $date: 'not a date' }],
  ['country text', { $date: 'India' }],
  ['date-only native wrapper', { $date: '2026-07-15' }],
  ['no milliseconds', { $date: '2026-07-15T13:15:35Z' }],
  ['offset timezone', { $date: '2026-07-15T18:45:35.148+05:30' }],
  ['impossible February day', { $date: '2026-02-30T00:00:00.000Z' }],
  ['nonleap February29', { $date: '2025-02-29T00:00:00.000Z' }],
  ['invalid hour', { $date: '2026-07-15T25:15:35.148Z' }],
  ['future date', { $date: '2027-01-01T00:00:00.000Z' }],
  ['future one millisecond', { $date: '2026-11-07T08:30:00.001Z' }],
  ['array wrapper', [{ $date: '2026-07-15T13:15:35.148Z' }]],
  ['bare number', 1784121335148],
  ['bare zero', 0],
  ['bare boolean', false],
  ['foreign Date object', new Date('2026-07-15T13:15:35.148Z')],
]) test('malformed or unreviewed native publication value fails before observation-date promotion: ' + name, t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(clock) })
  assert.throws(() => extract(withDate(value)), /LifeSigns native publication date/)
})

test('native date getter is rejected without reading its value', t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(clock) })
  let calls = 0
  const wrapper = Object.defineProperty({}, '$date', { enumerable: true, get() { calls++; return '2026-07-15T13:15:35.148Z' } })
  assert.throws(() => extract(withDate(wrapper)), /LifeSigns native publication date/)
  assert.equal(calls, 0)
})
for (const [name, make] of [
  ['inherited date', () => Object.create({ $date: '2026-07-15T13:15:35.148Z' })],
  ['unknown symbol carrier', () => ({ $date: '2026-07-15T13:15:35.148Z', [Symbol('unknown')]: '2027-01-01' })],
  ['non-enumerable date', () => Object.defineProperty({}, '$date', { value: '2026-07-15T13:15:35.148Z' })],
]) test('finite native wrapper rejects ' + name, t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(clock) })
  assert.throws(() => extract(withDate(make())), /LifeSigns native publication date/)
})

for (const value of ['2024-02-29T12:34:56.789Z', '2026-11-07T08:30:00.000Z']) test('real-calendar nonfuture wrapper boundary remains native: ' + value, t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(clock) })
  const job = extract(withDate({ $date: value }))
  assert.equal(job.postingDate, value); assert.equal(normalized(job).postedAtProvenance, 'source')
})

for (const [label, value, want, provenance] of [
  ['legacy ISO string', '2026-09-15T00:00:00.000Z', '2026-09-15T00:00:00.000Z', 'source'],
  ['legacy date-only string', '2026-09-15', '2026-09-15', 'source'],
  ['legacy future string policy unchanged', '2027-01-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z', 'source'],
  ['legacy invalid-string unknown policy unchanged', 'legacy-unreviewed', 'legacy-unreviewed', 'observation'],
  ['legacy empty string', '', null, 'observation'],
  ['native null', null, null, 'observation'],
  ['native missing', undefined, null, 'observation'],
]) test('legacy output and existing backend date policy preserved: ' + label, t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(clock) })
  const job = extract(withDate(value)), result = normalized(job)
  assert.equal(job.postingDate, want)
  assert.equal(Object.hasOwn(job, 'sourceNativePublicationEvidence'), false)
  assert.equal(result.postedAtProvenance, provenance)
  if (provenance === 'observation') assert.equal(result.postedAt.toISOString(), clock)
  assert.equal(job.country, null); assert.equal(job.lifecycleCleanupAllowed, false)
})
