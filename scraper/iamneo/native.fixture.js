import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'

// Unmodified November 6 public responses. The absent October packet set and
// its original oracles are retained separately in historical-profile.json.
const directory = new URL('./test-data-20261106/', import.meta.url)
export const profile = JSON.parse(readFileSync(new URL('manifest.json', directory), 'utf8'))
const requests = new Map()
for (const row of profile.requests) {
  if (!requests.has(row.url)) requests.set(row.url, [])
  requests.get(row.url).push(row)
}
export function transport(change) {
  const counts = new Map()
  return async url => {
    const rows = requests.get(url), occurrence = counts.get(url) || 0
    assert.ok(rows && occurrence < rows.length, `unexpected capture request ${url}`)
    counts.set(url, occurrence + 1)
    const receipt = rows[occurrence]
    const bytes = gunzipSync(readFileSync(new URL(receipt.bodySHA256 + '.gz', directory)))
    assert.equal(createHash('sha256').update(bytes).digest('hex'), receipt.bodySHA256)
    const body = bytes.toString('utf8')
    const changed = change?.(url, body, occurrence + 1) ?? body
    return { status: receipt.status, url: receipt.finalURL, text: async () => changed }
  }
}
