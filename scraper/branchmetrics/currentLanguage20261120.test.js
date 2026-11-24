import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { mergeListings, parseDetail, parseListing } from './native.js'

const packets = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-language-20261120.json.gz', import.meta.url))))
const rows = parseListing(JSON.parse(packets[0].body), 0).rows
const ukId = '9d4dd384-e953-4fc1-86e9-660e0cf42077'

test('Branch native vacancy language does not reject the current unfiltered board or change its India countries', () => {
  const listings = mergeListings(rows)
  const uk = listings.find(row => row.jobId === ukId)
  assert.equal(uk.language, 'en-GB')
  assert.deepEqual(uk.locations.map(place => place.countryCode), ['GB'])
  assert.deepEqual(listings.filter(row => row.locations.some(place => place.countryCode === 'IN')).map(row => row.jobId), [
    '454f3d28-ca85-4640-9cfe-c48f1931cfdc',
    '736cd9d9-935d-4eff-9359-3437ac66eff1',
    '14034902-e87c-4cdc-a07b-46260a42d095',
    'dd6618ff-342f-4a05-a258-96bb8d347be8',
  ])
  const detail = parseDetail(packets[1].body, uk)
  assert.equal(detail.sourceDetailComplete, true)
  assert.equal(detail.postingDate, '2026-11-18T05:29:24.828000-08:00')
})

test('Branch rejects malformed vacancy language and conflicting same-ID language', () => {
  const malformed = structuredClone(rows)
  malformed.find(row => row.id === ukId).language = 'javascript:alert(1)'
  assert.throws(() => mergeListings(malformed), /listing identity/)
  const conflicting = structuredClone(rows)
  conflicting[1].language = 'en-GB'
  assert.throws(() => mergeListings(conflicting), /conflicting fields/)
})

