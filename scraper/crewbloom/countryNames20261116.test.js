import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createWorkablePublicApiScraper } from '../../scraper-support/utils/workablePublicApi.js'

const pages = JSON.parse(gunzipSync(readFileSync(new URL('./native-captures/listings-20261116.json.gz', import.meta.url))))
const accountUid = '53568b5e-6585-43a9-930b-705aec25df28'
const listingURL = 'https://apply.workable.com/api/v3/accounts/crewbloom/jobs'
const stop = Error('Stop at uncaptured India details after all five current public cursor pages')

async function exercise(change = () => {}) {
  let reads = 0, error
  try {
    await createWorkablePublicApiScraper({ source: 'crewbloom', company: 'CrewBloom', tenant: 'crewbloom',
      accountUid, boardIdentityVerified: true }).run({ now: () => '2026-11-16T17:00:00.000Z',
      fetchJson: async (url, init) => {
        if (url !== listingURL) { reads++; throw stop }
        const index = reads++, entry = pages[index]
        assert.ok(entry, 'Only the captured five native cursor pages are available')
        const request = JSON.parse(init.body)
        assert.equal(request.token, index === 0 ? undefined : pages[index - 1].payload.nextPage)
        const payload = structuredClone(entry.payload)
        for (const record of payload.results) if (record.shortcode === '6B92E4EEE6') {
          change(record.location); record.locations.forEach(change)
        }
        return payload
      },
    })
  } catch (cause) { error = cause }
  return { reads, error }
}

test('the exact CrewBloom TR/Turkey country carrier permits all 42 current native identities to reach India detail acquisition', async () => {
  assert.deepEqual(pages.map(page => page.payload.results.length), [10, 10, 10, 10, 2])
  const native = pages.flatMap(page => page.payload.results).find(row => row.shortcode === '6B92E4EEE6')
  assert.equal(native.location.countryCode, 'TR')
  assert.equal(native.location.country, 'Turkey')
  const result = await exercise()
  assert.equal(result.error, stop)
  assert.equal(result.reads, 6)
})

for (const [name, change] of [
  ['TR with India', location => { location.country = 'India' }],
  ['IN with Turkey', location => { location.countryCode = 'IN' }],
  ['US with Turkey', location => { location.countryCode = 'US' }],
  ['TR with an unreviewed label', location => { location.country = 'Anywhere in Asia' }],
]) test('the Workable country alias still rejects ' + name, async () => {
  const result = await exercise(change)
  assert.notEqual(result.error, stop)
  assert.match(result.error?.message || '', /country\/location scope/)
  assert.equal(result.reads, 4)
})
