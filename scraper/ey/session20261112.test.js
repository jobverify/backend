import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { createEyScraper, buildIndiaSearchUrl } from './script.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('../../test/fixtures/ey-session-20261112.json.gz', import.meta.url))))
// Keep the captured legacy query/receipt intact. These bytes provide the
// controlled transport body while the scraper now emits the native IN facet.
const listing = fixture.packets.find(packet => new URL(packet.requestedUrl).pathname === '/ey/search/' && !packet.phase)
const detail = fixture.packets.find(packet => packet.requestedUrl.includes('/ey/job/') && !packet.phase)
const response = (packet, url = packet.url, cookie) => {
  const value = new Response(packet.body, { status: packet.status, headers: {
    'Content-Type': packet.contentType || 'text/html', ...(cookie ? { 'Set-Cookie': cookie } : {}),
  } })
  Object.defineProperty(value, 'url', { value: url })
  return value
}

test('retained EY responses preserve native bytes and demonstrate stable totals only within the anonymous session', () => {
  for (const packet of fixture.packets) assert.equal(createHash('sha256').update(packet.body).digest('hex'), packet.hash)
  const session = fixture.packets.filter(packet => packet.phase === 'unsorted-session')
  assert.equal(session.length, 6)
})

test('EY keeps the native anonymous session from search through the role-detail HTTP request', async context => {
  let detailCookie
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === buildIndiaSearchUrl()) return response(listing, url, 'JSESSIONID=ey-native-test-session; Path=/; Secure; HttpOnly')
    assert.equal(url, detail.requestedUrl)
    detailCookie = new Headers(options.headers).get('cookie')
    return response(detail)
  })
  const jobs = await createEyScraper().run({ maxPages: 1, maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.match(jobs[0].jobDescription, /Guidewire|JUTRO/i)
  assert.equal(detailCookie, 'JSESSIONID=ey-native-test-session')
})

test('EY does not send a search-path cookie to a role detail outside that path', async context => {
  let detailCookie
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === buildIndiaSearchUrl()) return response(listing, url, 'JSESSIONID=ey-native-test-session; Path=/ey/search/; Secure; HttpOnly')
    detailCookie = new Headers(options.headers).get('cookie')
    return response(detail)
  })
  await createEyScraper().run({ maxPages: 1, maxJobs: 1 })
  assert.equal(detailCookie, null)
})

test('EY rejects a foreign role authority before making a role-detail request', async context => {
  const foreign = 'https://outside.example'
  const nativePath = new URL(detail.requestedUrl).pathname
  const body = listing.body.replace(`href="${nativePath}"`, `href="${foreign}${nativePath}"`)
  assert.notEqual(body, listing.body)
  let detailReads = 0
  context.mock.method(globalThis, 'fetch', async url => {
    if (url === buildIndiaSearchUrl()) return response({ ...listing, body }, url, 'JSESSIONID=ey-native-test-session; Path=/; Secure')
    detailReads++
    return response(detail, url)
  })
  await assert.rejects(createEyScraper().run({ maxPages: 1, maxJobs: 1 }), /EY.*(?:authority|request|origin)/i)
  assert.equal(detailReads, 0)
})

test('an EY reader rejects a foreign final response URL and never trusts its cookies', async context => {
  context.mock.method(globalThis, 'fetch', async () => response(listing, 'https://outside.example/ey/search/',
    'JSESSIONID=unbound-test-session; Path=/; Secure'))
  await assert.rejects(createEyScraper().run({ maxPages: 1, maxJobs: 1 }), /EY.*(?:authority|response|origin)/i)
})
