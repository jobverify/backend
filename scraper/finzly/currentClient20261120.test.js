import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const packets = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261120.json.gz', import.meta.url))))
const replay = change => run({ fetchPage: async url => {
  const packet = packets.find(row => row.requestedUrl === url)
  assert.ok(packet, 'Unadvertised native request ' + url)
  return { ...packet, body: change?.(url, packet.body) ?? packet.body }
} })

test('Finzly current advertised optimizer client preserves real India roles and complete authored criteria', async () => {
  const jobs = await replay()
  assert.ok(jobs.length > 0)
  assert.ok(jobs.some(job => job.jobId === '8189' && job.title === 'Senior Software Engineer'))
  assert.ok(jobs.every(job => job.country === 'India' && job.sourceDetailComplete && job.lifecycleCleanupAllowed === false))
  assert.ok(jobs.every(job => job.postingDate === null && job.sourceNativePageDates.meaning.includes('not job publication')))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Finzly current advertised filter still rejects a changed membership program', async () => {
  await assert.rejects(replay((url, body) => url.includes('siteground-optimizer-combined-js-')
    ? body.replace('a&&r?s.show():s.hide()', 'a?s.show():s.hide()') : body), /filtering client/)
})

