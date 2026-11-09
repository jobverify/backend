import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

import { createCatalogScraper, getScraperCatalog } from '../providers/index.js'

// Existing authentic HTTP capture: October 30 opening/closing arrays and one
// role-page pass. Replaying it is neither a current public check nor proof of
// company scope. Selected records and mutations below are controlled cases.
const capture = JSON.parse(gunzipSync(readFileSync(new URL(
  '../../scraper/watchguard/fixtures/native-http-20261030.json.gz', import.meta.url,
))))
const bytes = response => Buffer.from(response.bodyBase64, 'base64')
const opening = capture.responses[capture.openingReceiptIndex]
const closing = capture.responses[capture.closingReceiptIndex]
const records = JSON.parse(bytes(opening))
const roles = new Map(capture.roleReceiptIndices.map(index => {
  const response = capture.responses[index]
  return [response.url, response]
}))

export const capturedWatchguardRecords = () => structuredClone(records)

export async function replayRegisteredWatchguard({ selectedRecords } = {}) {
  const provider = getScraperCatalog().find(row => row.source === 'watchguard')
  assert.equal(provider.adapter, 'script')
  assert.match(provider.modulePath, /scraper[\\/]watchguard[\\/]script\.js$/)
  const calls = []
  let apiRequests = 0, audit
  const jobs = await createCatalogScraper(provider).run({
    async fetchImpl(url, options) {
      options.signal.throwIfAborted()
      calls.push(url)
      const native = url === opening.url
        ? [opening, closing][apiRequests++] : roles.get(url)
      assert.ok(native, `Unexpected captured WatchGuard request: ${url}`)
      const response = { ...native, body: bytes(native) }
      if (selectedRecords && url === opening.url) response.body = Buffer.from(JSON.stringify(selectedRecords))
      const result = new Response(response.body, {
        status: response.status, headers: { 'content-type': response.contentType },
      })
      Object.defineProperty(result, 'url', { value: response.finalUrl })
      return result
    },
    onAudit(value) { audit = value },
  })
  return { jobs, audit, calls }
}
