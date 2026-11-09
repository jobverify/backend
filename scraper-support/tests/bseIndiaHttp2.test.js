import assert from 'node:assert/strict'
import http2 from 'node:http2'
import { once } from 'node:events'
import test from 'node:test'
import * as bse from '../../scraper/bseindia/script.js'

test('BSE HTTP/2 transport reads complete UTF-8 bodies and follows bounded redirects', async () => {
  const server = http2.createServer()
  server.on('stream', (stream, headers) => {
    if (headers[':path'] === '/start') {
      stream.respond({ ':status': 302, location: '/careers?lang=en' })
      stream.end()
    } else if (headers[':path'] === '/careers?lang=en') {
      stream.respond({ ':status': 200 })
      stream.end('<title>BSE careers – Mumbai</title>')
    } else {
      stream.respond({ ':status': 404 })
      stream.end('Not found')
    }
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const origin = `http://127.0.0.1:${server.address().port}`
  try {
    assert.equal(await bse.fetchTextOverHttp2(`${origin}/start`), '<title>BSE careers – Mumbai</title>')
    await assert.rejects(bse.fetchTextOverHttp2(`${origin}/missing`), /HTTP 404/)
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
})

test('BSE HTTP/2 transport stops a response that never completes', async () => {
  const server = http2.createServer()
  server.on('stream', (stream) => {
    stream.respond({ ':status': 200 })
    stream.write('partial')
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  try {
    await assert.rejects(bse.fetchTextOverHttp2(`http://127.0.0.1:${server.address().port}/careers`, { timeoutMs: 100 }), /timed out/)
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
})
