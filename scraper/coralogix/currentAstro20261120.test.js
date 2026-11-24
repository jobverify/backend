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
  return { ...packet, html: change?.(url, packet.html) ?? packet.html }
} })

test('Coralogix current Astro clients retain the same employer tenant and real India criteria', async () => {
  const jobs = await replay()
  assert.ok(jobs.some(job => job.jobId === '4D.169' && job.title === 'Cloud and Observability Engineer (Remote Role, 6pm - 3am)'))
  assert.ok(jobs.every(job => job.country === 'India' && job.sourceDetailComplete && job.lifecycleCleanupAllowed === false))
  assert.ok(jobs.every(job => job.postingDate === null && job.sourcePostingDateUnavailable === true))
  assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed, false)
})

test('Coralogix current Astro client must retain the exact reviewed public tenant and complete criteria program', async () => {
  await assert.rejects(replay((url, html) => url.includes('/_astro/careers-page.')
    ? html.replace('/company/06.004/', '/company/99.999/') : html), /inventory client contract/)
  await assert.rejects(replay((url, html) => url.includes('/_astro/careers-position-page.')
    ? html.replace('&details=true', '') : html), /criteria client contract/)
})
