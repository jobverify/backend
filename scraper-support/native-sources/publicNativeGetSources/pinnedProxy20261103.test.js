import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import https from 'node:https'
import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { pinnedHTTPSFetch } from './safeTransport.js'

const target = 'https://public-origin.example/jobs?start=0'
const addresses = [{ address: '8.8.8.8', family: 4 }]
const proxy = 'http://test-user:test-secret@proxy.example:8888'

async function fakeRequest(proxyEnv, inspect, options = {}) {
  const previousRequest = https.request
  const previousEnv = https.globalAgent.options.proxyEnv
  const connections = []
  let destroyed = false
  https.globalAgent.options.proxyEnv = proxyEnv
  https.request = (settings, respond) => {
    inspect(settings)
    const request = new EventEmitter()
    const socket = new EventEmitter()
    Object.assign(socket, { remoteAddress: options.remoteAddress || '127.0.0.1', connecting: false,
      encrypted: true, authorized: options.authorized !== false })
    request.destroy = error => { destroyed = true; queueMicrotask(() => request.emit('error', error)); return request }
    request.end = () => queueMicrotask(() => {
      request.emit('socket', socket)
      if (!destroyed) {
        const incoming = Readable.from([Buffer.from('original native response')])
        Object.assign(incoming, { statusCode: 200, headers: { 'content-type': 'text/plain' }, socket })
        respond(incoming)
      }
    })
    return request
  }
  try {
    const response = await pinnedHTTPSFetch(options.target || target, {
      validatedAddresses: options.addresses || addresses, signal: AbortSignal.timeout(1000),
      headers: { Accept: 'text/html', 'User-Agent': 'test' }, onConnected: receipt => connections.push(receipt)
    })
    const body = await response.text()
    return { response, body, connections }
  } finally {
    https.request = previousRequest
    https.globalAgent.options.proxyEnv = previousEnv
  }
}

test('an explicitly enabled HTTPS proxy CONNECTs to a validated IP and keeps original Host and TLS identity', async () => {
  const result = await fakeRequest({ HTTPS_PROXY: proxy }, settings => {
    assert.equal(settings.hostname, '8.8.8.8')
    assert.equal(settings.servername, 'public-origin.example')
    assert.equal(settings.rejectUnauthorized, true)
    assert.equal(new Headers(settings.headers).get('host'), 'public-origin.example')
    assert.equal(new Headers(settings.headers).get('proxy-authorization'), null)
    assert.ok(settings.agent instanceof https.Agent)
    assert.equal(settings.agent.options.proxyEnv.https_proxy, proxy)
    const error = settings.checkServerIdentity('8.8.8.8', { subjectaltname: 'DNS:other.example' })
    assert.equal(error.code, 'ERR_TLS_CERT_ALTNAME_INVALID')
  })
  assert.equal(result.body, 'original native response')
  assert.equal(result.connections.length, 1)
  assert.equal(result.connections[0].connectionMode, 'validated-public-ip-connect')
  assert.equal(result.connections[0].pinnedAddress, '8.8.8.8')
  assert.equal(result.connections[0].originCertificateVerified, true)
  assert.equal(result.connections[0].remoteAddress, undefined, 'the proxy peer must not be reported as an observed public origin')
})

for (const noProxy of ['*', 'public-origin.example', 'PUBLIC-ORIGIN.EXAMPLE:443', '.example', '*.example']) {
  test('NO_PROXY uses the original hostname: ' + noProxy, async () => {
    const result = await fakeRequest({ HTTPS_PROXY: proxy, NO_PROXY: noProxy }, settings => {
      assert.equal(settings.hostname, 'public-origin.example')
      assert.equal(settings.agent, false)
      let pinned
      settings.lookup('public-origin.example', { all: true }, (error, values) => { assert.equal(error, null); pinned = values })
      assert.deepEqual(pinned, addresses)
    }, { remoteAddress: '8.8.8.8' })
    assert.equal(result.body, 'original native response')
  })
}

test('NO_PROXY for a different port or a lookalike domain does not change the pinned proxy route', async () => {
  await fakeRequest({ HTTPS_PROXY: proxy, NO_PROXY: 'public-origin.example:8443,.origin.example' }, settings => {
    assert.equal(settings.hostname, '8.8.8.8')
    assert.ok(settings.agent instanceof https.Agent)
  })
})

test('lowercase proxy settings take precedence without mutating the shared environment', async () => {
  const env = Object.freeze({ https_proxy: proxy, HTTPS_PROXY: 'http://other.example:8888', no_proxy: 'elsewhere.example', NO_PROXY: '*' })
  await fakeRequest(env, settings => {
    assert.equal(settings.hostname, '8.8.8.8')
    assert.equal(settings.agent.options.proxyEnv.https_proxy, proxy)
  })
  assert.equal(env.NO_PROXY, '*')
})

test('an absent Node proxy opt-in preserves the direct public socket checks', async () => {
  await fakeRequest(undefined, settings => {
    assert.equal(settings.agent, false)
    assert.equal(settings.hostname, 'public-origin.example')
  }, { remoteAddress: '8.8.8.8' })
})

test('NO_PROXY IPv4 ranges apply to literal targets and leave hostname DNS pinning intact', async () => {
  await fakeRequest({ HTTPS_PROXY: proxy, NO_PROXY: '8.8.8.1-8.8.8.9' }, settings => {
    assert.equal(settings.agent, false)
    assert.equal(settings.hostname, '8.8.8.8')
  }, { target: 'https://8.8.8.8/jobs', remoteAddress: '8.8.8.8' })
  await fakeRequest({ HTTPS_PROXY: proxy, NO_PROXY: '8.8.8.1-8.8.8.9' }, settings => {
    assert.ok(settings.agent instanceof https.Agent)
  })
})

test('a proxy cannot qualify an unauthorized TLS socket', async () => {
  await assert.rejects(fakeRequest({ HTTPS_PROXY: proxy }, () => {}, { authorized: false }), /certificate|TLS/i)
})

test('private and mixed DNS sets are refused before a proxy request is constructed', async () => {
  let requests = 0
  await assert.rejects(fakeRequest({ HTTPS_PROXY: proxy }, () => { requests++ }, {
    addresses: [...addresses, { address: '127.0.0.1', family: 4 }]
  }), /validated public destination/i)
  assert.equal(requests, 0)
})

test('IPv6 literal CONNECT targets retain the original host and custom port', async () => {
  await fakeRequest({ HTTPS_PROXY: proxy }, settings => {
    assert.equal(settings.hostname, '2606:4700::1111')
    assert.equal(settings.port, '8443')
    assert.equal(new Headers(settings.headers).get('host'), 'public-origin.example:8443')
    assert.equal(settings.servername, 'public-origin.example')
  }, { target: 'https://public-origin.example:8443/jobs', addresses: [{ address: '2606:4700::1111', family: 6 }] })
})

test('invalid proxy configuration errors do not expose credentials', async () => {
  await assert.rejects(fakeRequest({ HTTPS_PROXY: 'http://test-user:test-secret@bad proxy/' }, () => {}), error => {
    assert.match(error.message, /proxy configuration/i)
    assert.ok(!error.message.includes('test-secret'))
    return true
  })
})

test('the real Node proxy agent sends only the validated public IP in CONNECT and redacts tunnel failures', async () => {
  const server = http.createServer()
  const receipts = []
  server.on('connect', (request, socket) => {
    receipts.push({ method: request.method, path: request.url, auth: request.headers['proxy-authorization'] })
    socket.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const previousEnv = https.globalAgent.options.proxyEnv
  https.globalAgent.options.proxyEnv = { HTTPS_PROXY: `http://test-user:test-secret@127.0.0.1:${server.address().port}` }
  try {
    await assert.rejects(pinnedHTTPSFetch(target, { validatedAddresses: addresses, signal: AbortSignal.timeout(1500), headers: {} }), error => {
      assert.ok(!error.message.includes('test-secret'))
      assert.equal(error.code, 'ERR_PROXY_TUNNEL')
      return true
    })
    assert.deepEqual(receipts, [{ method: 'CONNECT', path: '8.8.8.8:443', auth: 'Basic ' + Buffer.from('test-user:test-secret').toString('base64') }])
  } finally {
    https.globalAgent.options.proxyEnv = previousEnv
    await new Promise(resolve => server.close(resolve))
  }
})

for (const phase of ['CONNECT headers', 'origin TLS']) test('caller cancellation promptly destroys a socket waiting for ' + phase, async () => {
  const server = http.createServer()
  const controller = new AbortController()
  const sockets = new Set()
  let closed
  const socketClosed = new Promise(resolve => { closed = resolve })
  server.on('connect', (_request, socket) => {
    sockets.add(socket)
    // HTTP CONNECT hands ownership of this half-open socket to the proxy.
    socket.once('end', () => socket.destroy())
    socket.once('close', () => { sockets.delete(socket); closed() })
    socket.resume()
    if (phase === 'origin TLS') {
      socket.write('HTTP/1.1 200 Connection established\r\n\r\n')
      socket.once('data', () => controller.abort(Error('source cancelled during origin TLS')))
    } else controller.abort(Error('source cancelled during CONNECT'))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const previousEnv = https.globalAgent.options.proxyEnv
  https.globalAgent.options.proxyEnv = { HTTPS_PROXY: `http://127.0.0.1:${server.address().port}` }
  let timer, deadline
  try {
    const request = pinnedHTTPSFetch(target, { validatedAddresses: addresses,
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(1500)]), headers: {} })
    await assert.rejects(Promise.race([request, new Promise((_resolve, reject) => {
      deadline = setTimeout(() => reject(Error('Pending proxy request did not settle')), 2000)
    })]), /ABORT|cancel/i)
    const outcome = await Promise.race([socketClosed.then(() => 'closed'), new Promise(resolve => { timer = setTimeout(() => resolve('open'), 300) })])
    assert.equal(outcome, 'closed')
  } finally {
    clearTimeout(timer)
    clearTimeout(deadline)
    https.globalAgent.options.proxyEnv = previousEnv
    for (const socket of sockets) socket.destroy()
    await new Promise(resolve => server.close(resolve))
  }
})
