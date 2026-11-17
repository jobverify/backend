import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

const sources = ['puntpartners', 'storeking', 'sumtotalsystems', 'stackedutech', 'startgenie', 'tebsolutions']

for (const source of sources) {
  const fixture = JSON.parse(gunzipSync(readFileSync(new URL(`../../scraper/${source}/fixtures/native-20261117.json.gz`, import.meta.url))))
  const { run } = await import(`../../scraper/${source}/script.js`)

  for (const phase of ['complete-originals', 'known-http-denial']) {
    test(`${source} preserves caller cancellation triggered by final cleanup after ${phase}`, async () => {
      for (const opaque of [Object.freeze({ source, phase }), null]) {
        const caller = new AbortController()
        let requests = 0
        let cleanupNotifications = 0
        let deniedBodyReads = 0
        const fetchImpl = async (url, init) => {
          requests++
          init.signal.addEventListener('abort', () => {
            cleanupNotifications++
            caller.abort(opaque)
          }, { once: true })
          if (phase === 'known-http-denial') {
            return {
              url,
              status: 403,
              headers: new Headers({ 'content-type': 'text/html' }),
              body: { cancel() {}, getReader() { deniedBodyReads++; throw new Error('Denied body must stay unread') } },
            }
          }
          const row = fixture.responses.find(item => (item.requestedURL ?? item.requestedUrl) === url)
          assert.ok(row, `Unrecorded request: ${url}`)
          return Object.defineProperty(new Response(Buffer.from(row.bodyBase64, 'base64'), {
            status: row.status,
            headers: row.headers,
          }), 'url', { value: row.url ?? row.finalUrl ?? url })
        }

        await assert.rejects(run({ signal: caller.signal, fetchImpl }), error => error === opaque)
        assert.ok(requests > 0)
        assert.equal(caller.signal.aborted, true)
        assert.equal(caller.signal.reason, opaque)
        assert.ok(cleanupNotifications > 0)
        assert.equal(deniedBodyReads, 0)
        if (phase === 'known-http-denial') assert.equal(requests, 1)
      }
    })
  }
}
