import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'

for (const [source, rawCount, retainedCount] of [['iamneo', 5, 5], ['smartcoin', 42, 40], ['axiralabs', 0, 0]]) {
  test(`${source} November 6 portable capture preserves every actual entity and distinct historical profile`, () => {
    const directory = new URL(`../scraper/${source}/test-data-20261106/`, import.meta.url)
    const profile = JSON.parse(readFileSync(new URL('manifest.json', directory), 'utf8'))
    assert.equal(profile.profile, 'current-public-2026-11-06')
    assert.equal(profile.historicalProfileReplayable, false)
    assert.equal(profile.expectedNativeIds.length, retainedCount)
    for (const row of profile.requests) {
      assert.equal(row.status, 200)
      assert.equal(row.finalURL, row.url)
      assert.match(row.startedAt, /^2026-11-06T/)
      const bytes = gunzipSync(readFileSync(new URL(row.bodySHA256 + '.gz', directory)))
      assert.equal(bytes.length, row.bodyBytes)
      assert.equal(createHash('sha256').update(bytes).digest('hex'), row.bodySHA256)
      if (row.url.includes('/api/jobs/default/active') || row.url.includes('/api/embedjobs/default/active/')) {
        assert.equal(JSON.parse(bytes).length, rawCount)
      }
    }
    const historical = JSON.parse(readFileSync(new URL('historical-profile.json', directory), 'utf8'))
    assert.equal(historical.replayable, false)
    assert.match(historical.oldFixtureHelper, /keka-next-sources/)
    assert.equal(typeof historical.originalScope.$renderers, 'object')
  })
}
