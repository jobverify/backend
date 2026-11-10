import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const homepage = gunzipSync(readFileSync(new URL('./test-data/current-apex-20261110.html.gz', import.meta.url))).toString('utf8')

test('eNTrust reads its TLS-valid official apex when the www alias has a certificate hostname mismatch', async () => {
  const jobs = await run({ fetchText: async url => {
    if (url === 'https://entrustsoft.in/') return homepage
    if (url === 'https://www.entrustsoft.in/') {
      throw Object.assign(new TypeError('fetch failed'), {
        cause: Object.assign(new Error('Host www.entrustsoft.in is not in the certificate alternative names'), {
          code: 'ERR_TLS_CERT_ALTNAME_INVALID',
        }),
      })
    }
    throw new Error(`Unreviewed eNTrust public URL: ${url}`)
  } })
  // This homepage has no public vacancies. Its successful read does not prove
  // an authoritative empty inventory or permit lifecycle cleanup.
  assert.deepEqual(jobs, [])
})

test('a successful eNTrust homepage read preserves unknown current inventory totals', async () => {
  const jobs = await run({ fetchText: async () => homepage, now: () => '2026-11-10T02:00:00.000Z' })
  const evidence = readInventoryEvidence(jobs)
  assert.ok(evidence, 'the source must carry evidence from this read rather than stale catalog counts')
  assert.equal(evidence.surface, 'https://entrustsoft.in/')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(evidence.pagesFetched, 1)
  assert.equal(evidence.verifiedAt, '2026-11-10T02:00:00.000Z')
})
