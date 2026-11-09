import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { syncBuiltinESMExports } from 'node:module'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import tls from 'node:tls'
import dns from 'node:dns'
import dgram from 'node:dgram'
import http2 from 'node:http2'

const networkAttempts = []
const restorations = []
const guard = (owner, name, label) => {
  const original = owner[name]
  owner[name] = () => {
    networkAttempts.push(label)
    throw new Error(`Offline Allyis control forbids network: ${label}`)
  }
  restorations.push(() => { owner[name] = original })
}
guard(globalThis, 'fetch', 'global.fetch')
for (const [owner, names, prefix] of [
  [http, ['request', 'get'], 'http'], [https, ['request', 'get'], 'https'],
  [net, ['connect', 'createConnection'], 'net'], [tls, ['connect'], 'tls'],
  [http2, ['connect'], 'http2'], [dgram, ['createSocket'], 'dgram'],
  [dns, ['lookup', 'resolve', 'resolve4', 'resolve6', 'resolveAny', 'reverse'], 'dns'],
  [dns.promises, ['lookup', 'resolve', 'resolve4', 'resolve6', 'resolveAny', 'reverse'], 'dns.promises'],
]) for (const name of names) guard(owner, name, `${prefix}.${name}`)
guard(net.Socket.prototype, 'connect', 'net.Socket.connect')
syncBuiltinESMExports()

// The subject imports occur only after process-wide network guards are active.
const { getScraperCatalog, createCatalogScraper } = await import('../providers/index.js')
const { CAREERS_URL, EMBEDDED_JOBS_URL } = await import('../../scraper/allyisindia/script.js')
const providers = getScraperCatalog().filter(provider => provider.source === 'allyisindia')
const provider = providers[0]

// Portable, deliberately derived shell fixture. No captured board, vacancy,
// employer, geography or inventory-completeness evidence is represented here.
const derivedCareersShell = `<!doctype html><html><body><main>
<h1>Join Our Team</h1><h2>Jobs at Allyis, India</h2><p>TechM Allyis</p>
<iframe src="https://staffing.allyisapps.com/home/listjobs/114025"></iframe>
</main></body></html>`

async function assertOriginalFailure(reason, iframeRead = () => { throw reason }) {
  const requests = []
  const outcome = await createCatalogScraper(provider).run({
    fetchPage: async url => {
      requests.push(url)
      if (url === CAREERS_URL) return { status: 200, url, html: derivedCareersShell }
      assert.equal(url, EMBEDDED_JOBS_URL, 'Only the configured root and declared iframe may be read')
      return iframeRead()
    },
  }).then(value => ({ kind: 'fulfilled', value }), error => ({ kind: 'rejected', error }))
  assert.deepEqual(requests, [CAREERS_URL, EMBEDDED_JOBS_URL])
  assert.equal(outcome.kind, 'rejected', 'An iframe failure must reject instead of returning an empty jobs array')
  assert.equal(outcome.error, reason, 'The exact original thrown object must reach the registered caller')
}

test('Allyis transport controls use the exact default-registered source', () => {
  assert.equal(providers.length, 1)
  assert.equal(provider.adapter, 'script')
  assert.equal(path.resolve(provider.modulePath), fileURLToPath(new URL('../../scraper/allyisindia/script.js', import.meta.url)))
  assert.equal(provider.companyCareerPage, CAREERS_URL)
})

for (const [code, message] of [
  ['ECONNRESET', 'socket hang up'],
  ['UND_ERR_CONNECT_TIMEOUT', 'fetch failed | Connect Timeout Error (attempted address: staffing.allyisapps.com:443, timeout: 10000ms)'],
]) test(`default-registered Allyis preserves a synthetic ${code} Error`, async () => {
  const error = Object.assign(new Error(message), { code })
  assert.equal(error.status, undefined)
  assert.equal(error.response, undefined)
  await assertOriginalFailure(error)
})

test('default-registered Allyis preserves a cancellation reason thrown by the iframe transport', async () => {
  const reason = Object.freeze({ kind: 'SyntheticTransportCancellation', message: 'socket hang up', code: 'ECONNRESET' })
  const controller = new AbortController()
  await assertOriginalFailure(reason, () => {
    controller.abort(reason)
    controller.signal.throwIfAborted()
  })
})

test('default-registered Allyis does not inspect an opaque iframe rejection', async () => {
  let propertiesRead = 0
  const reason = Object.freeze(Object.defineProperties({}, {
    message: { get() { propertiesRead++; throw new Error('Opaque rejection message must not be read') } },
    code: { get() { propertiesRead++; throw new Error('Opaque rejection code must not be read') } },
  }))
  await assertOriginalFailure(reason)
  assert.equal(propertiesRead, 0)
})

for (const [status, expected] of [
  [200, /reachable again and requires a real scraper upgrade/],
  [503, /changed materially and requires manual review/],
]) test(`synthetic iframe status ${status} retains the existing review error`, async () => {
  const requests = []
  await assert.rejects(createCatalogScraper(provider).run({
    fetchPage: async url => {
      requests.push(url)
      if (url === CAREERS_URL) return { status: 200, url, html: derivedCareersShell }
      assert.equal(url, EMBEDDED_JOBS_URL)
      // Deliberate status-boundary unit input, not retained native HTTP.
      return { status, url, html: 'Explicitly synthetic iframe boundary control' }
    },
  }), expected)
  assert.deepEqual(requests, [CAREERS_URL, EMBEDDED_JOBS_URL])
})

test('Allyis transport regression invokes no network', () => {
  assert.deepEqual(networkAttempts, [])
})

after(() => {
  for (const restore of restorations.reverse()) restore()
  syncBuiltinESMExports()
  assert.deepEqual(networkAttempts, [])
})
