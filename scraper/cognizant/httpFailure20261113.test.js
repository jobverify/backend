import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createServer } from 'node:http'
import test from 'node:test'
import { createDefaultFetchText, CAREER_PAGE_URL } from './script.js'

const body = gunzipSync(readFileSync(new URL('./fixtures/current-20261113/aspnet-startup-error-500.html.gz', import.meta.url))).toString()

test('actual upstream HTTP500 startup error cannot fall back to curl and become a successful empty listing', async () => {
  let fallbackCalls = 0
  const read = createDefaultFetchText({
    fetchImpl: async () => new Response(body, { status: 500, headers: { 'content-type': 'text/html' } }),
    execFileImpl: (_command, _args, callback) => { fallbackCalls++; callback(null, body, '') },
  })
  await assert.rejects(read(CAREER_PAGE_URL), error => error.status === 500 && /HTTP 500/.test(error.message))
  assert.equal(fallbackCalls, 0)
})

test('an explicit HTTP503 response remains an HTTP failure, even with nonempty HTML', async () => {
  let fallbackCalls = 0
  const read = createDefaultFetchText({
    fetchImpl: async () => new Response('<h1>Temporarily unavailable</h1>', { status: 503 }),
    execFileImpl: (_command, _args, callback) => { fallbackCalls++; callback(null, '<html>not a vacancy board</html>', '') },
  })
  await assert.rejects(read(CAREER_PAGE_URL), error => error.status === 503)
  assert.equal(fallbackCalls, 0)
})

test('native curl fallback rejects a real HTTP500 after a fetch transport failure', async () => {
  const server = createServer((_request, response) => {
    response.writeHead(500, { 'Content-Type': 'text/html' })
    response.end(body)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const read = createDefaultFetchText({ fetchImpl: async () => { throw new TypeError('fetch transport unavailable') } })
    await assert.rejects(read(`http://127.0.0.1:${server.address().port}/jobs/`), error => error.code === 22 && /500/.test(error.message))
  } finally {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
})
