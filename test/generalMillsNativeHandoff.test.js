import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { createCatalogScraper, getScraperCatalog } from '../scraper-support/providers/index.js'

const receipt = JSON.parse(gunzipSync(fs.readFileSync(new URL('../scraper/generalmills.workday/fixtures/corporate-20261029.json.gz', import.meta.url))))
const body = Buffer.from(receipt.bodyBase64, 'base64')
assert.equal(createHash('sha256').update(body).digest('hex'), receipt.bodySHA256)
const run = options => createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'generalmills')).run({
  retryBaseDelayMs: 0, requestTimeoutMs: 1000,
  requestScheduler: { acquire: async () => () => {}, recordRateLimit() {}, minIntervalMs: 0 }, ...options,
})

test('General Mills registered extraction requires the current corporate Workday handoff', async t => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async url => {
    calls.push(String(url))
    assert.equal(String(url), receipt.url, 'No native listing may be fetched after a removed corporate handoff')
    const response = new Response(body.toString().replaceAll('.myworkdayjobs.com', '.retired.invalid'), {
      status: receipt.status, headers: receipt.headers,
    })
    Object.defineProperty(response, 'url', { value: receipt.finalURL })
    return response
  })
  await assert.rejects(run(), /handoff|scope|board/i)
  assert.deepEqual(calls, [receipt.url])
})

test('General Mills registered extraction honors cancellation before network activity', async t => {
  t.mock.method(globalThis, 'fetch', async () => assert.fail('A cancelled source must not fetch'))
  const controller = new AbortController()
  controller.abort(Error('Cancelled General Mills source'))
  await assert.rejects(run({ signal: controller.signal }), /Cancelled General Mills source/)
})
