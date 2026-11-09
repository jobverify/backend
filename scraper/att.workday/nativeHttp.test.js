import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import {EventEmitter} from 'node:events'
import {gunzipSync} from 'node:zlib'

const roleUrl = 'https://www.att.jobs/job/hyderabad/sr-specialist-applications-development-workday-hcm-development/117/101071794848'

test('AT&T native byte decoding and client fingerprints agree when the published core bundle has a UTF-8 BOM', async () => {
  const {getAttNative} = await transport()
  const {inspectAttClients, CORE_URL} = await import('./nativeContract.js')
  const client = gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261025/att-search-client.body.gz', import.meta.url))).toString('utf8')
  const core = gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261025/att-core-client.body.gz', import.meta.url)))
  assert.equal(core.subarray(0, 3).toString('hex'), 'efbbbf')
  await localResponse((_request, response) => {
    response.setHeader('Content-Type', 'application/javascript; charset=utf-8')
    response.end(core)
  }, async requestImpl => {
    const result = await getAttNative(CORE_URL, {requestImpl})
    assert.notEqual(result.body.charCodeAt(0), 0xfeff)
    assert.doesNotThrow(() => inspectAttClients(client, result.body))
    assert.doesNotThrow(() => inspectAttClients(client, core.toString('utf8')))
    assert.throws(() => inspectAttClients(client, result.body + '\nvoid 0;'), /encoder changed/i)
    assert.throws(() => inspectAttClients(client + '\nvoid 0;', result.body), /search client changed/i)
  })
})
async function transport() {
  assert.ok(fs.existsSync(new URL('./nativeHttp.js', import.meta.url)), 'AT&T needs a bounded strict-TLS native HTTP transport for its observed 21,791-byte response headers')
  return import('./nativeHttp.js')
}
async function localResponse(handler, callback) {
  const sockets = new Set()
  const server = http.createServer(handler)
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)) })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const localUrl = `http://127.0.0.1:${server.address().port}/`
  try {
    return await callback((url, options, listener) => http.request(localUrl, options, listener))
  } finally {
    for (const socket of sockets) socket.destroy()
    await new Promise(resolve => server.close(resolve))
  }
}

test('AT&T reads legitimate native response headers larger than Node default within its source-specific 64KiB bound', async () => {
  const {getAttNative} = await transport()
  await localResponse((_request, response) => {
    response.setHeader('Content-Type', 'text/html; charset=utf-8')
    response.setHeader('Set-Cookie', ['observed-native-header=' + 'a'.repeat(22000)])
    response.end('<html><body>Native response</body></html>')
  }, async requestImpl => {
    const result = await getAttNative(roleUrl, {requestImpl})
    assert.equal(result.body, '<html><body>Native response</body></html>')
    assert.equal(result.url, roleUrl)
  })
})

test('AT&T still rejects headers beyond 64KiB without retrying or disabling TLS', async () => {
  const {getAttNative} = await transport()
  let calls = 0
  await localResponse((_request, response) => {
    calls++
    response.setHeader('X-Oversized-Native-Header', 'b'.repeat(66000))
    response.end('body')
  }, async requestImpl => {
    await assert.rejects(getAttNative(roleUrl, {requestImpl}), /header|overflow/i)
  })
  assert.equal(calls, 1)
})

test('AT&T rejects a redirect without following it or requesting a generic search fallback', async () => {
  const {getAttNative} = await transport()
  let calls = 0
  await localResponse((_request, response) => {
    calls++
    response.writeHead(302, {Location: 'https://other.example/login'})
    response.end('redirect')
  }, async requestImpl => {
    await assert.rejects(getAttNative(roleUrl, {requestImpl}), /AT&T native.*(?:status|redirect)/i)
  })
  assert.equal(calls, 1)
})

for (const status of [202, 403, 429, 500]) {
  test(`AT&T does not turn HTTP ${status} into empty inventory`, async () => {
    const {getAttNative} = await transport()
    await localResponse((_request, response) => {
      response.writeHead(status, {'Content-Type': 'text/html'})
      response.end('unavailable')
    }, async requestImpl => {
      await assert.rejects(getAttNative(roleUrl, {requestImpl}), /AT&T native.*status/i)
    })
  })
}

test('AT&T rejects empty and oversized native bodies', async () => {
  const {getAttNative} = await transport()
  for (const body of ['', 'c'.repeat(2097153)]) {
    await localResponse((_request, response) => {
      response.setHeader('Content-Type', 'text/html')
      response.end(body)
    }, async requestImpl => {
      await assert.rejects(getAttNative(roleUrl, {requestImpl}), /AT&T native.*body/i)
    })
  }
})

test('AT&T bounds both response headers and response body waits', async () => {
  const {getAttNative} = await transport()
  for (const sendHeaders of [false, true]) {
    await localResponse((_request, response) => {
      if (sendHeaders) { response.writeHead(200, {'Content-Type': 'text/html'}); response.flushHeaders() }
    }, async requestImpl => {
      await assert.rejects(getAttNative(roleUrl, {requestImpl, timeoutMs: 50}), /abort|timeout|deadline/i)
    })
  }
})

test('AT&T rejects foreign hosts before issuing a request', async () => {
  const {getAttNative} = await transport()
  let requested = false
  await assert.rejects(getAttNative('https://other.example/job/123', {requestImpl: () => { requested = true }}), /AT&T native.*(?:URL|origin|host)/i)
  assert.equal(requested, false)
})

test('AT&T preserves the caller cancellation reason during a native body wait', async () => {
  const {getAttNative} = await transport()
  const controller = new AbortController()
  const reason = Error('Caller cancelled the native role request')
  let started
  const requestStarted = new Promise(resolve => { started = resolve })
  await localResponse((_request, response) => {
    response.writeHead(200, {'Content-Type': 'text/html'})
    response.flushHeaders()
    started()
  }, async requestImpl => {
    const pending = getAttNative(roleUrl, {requestImpl, signal: controller.signal})
    await requestStarted
    controller.abort(reason)
    await assert.rejects(pending, failure => failure === reason)
  })
})

test('AT&T retains a nested permanent TLS code and original failure cause', async () => {
  const {getAttNative} = await transport()
  const certificate = Object.assign(Error('Certificate verification failed'), {code: 'CERT_HAS_EXPIRED'})
  const original = Error('TLS transport failed', {cause: certificate})
  const requestImpl = () => {
    const request = new EventEmitter()
    request.destroy = () => {}
    request.end = () => queueMicrotask(() => request.emit('error', original))
    return request
  }
  await assert.rejects(getAttNative(roleUrl, {requestImpl}), failure => {
    assert.equal(failure.code, 'CERT_HAS_EXPIRED')
    assert.equal(failure.cause, original)
    assert.equal(failure.cause.cause, certificate)
    assert.equal(failure.abortRetries, true)
    return true
  })
})

test('AT&T keeps unexpected request implementation errors observable', async () => {
  const {getAttNative} = await transport()
  const original = TypeError('Unexpected request implementation failure')
  await assert.rejects(getAttNative(roleUrl, {requestImpl: () => { throw original }}), failure => failure === original)
  assert.equal(original.softFailure, undefined)
})

test('AT&T retries one interrupted successful response body within the original request deadline',async()=>{
  const {getAttNative}=await transport()
  let calls=0
  await localResponse((_request,response)=>{
    response.setHeader('Content-Type','text/html')
    if(++calls===1){
      response.flushHeaders()
      response.write('<html>interrupted native response')
      setImmediate(()=>response.destroy())
    }else response.end('<html>complete native response</html>')
  },async requestImpl=>{
    const result=await getAttNative(roleUrl,{requestImpl,timeoutMs:500})
    assert.equal(result.body,'<html>complete native response</html>')
    assert.equal(calls,2)
  })
})

test('AT&T persistent body interruption stops after the bounded second attempt without returning partial HTML',async()=>{
  const {getAttNative}=await transport()
  let calls=0
  await localResponse((_request,response)=>{
    calls++
    response.writeHead(200,{'Content-Type':'text/html'})
    response.flushHeaders()
    response.write('<html>incomplete native body')
    setImmediate(()=>response.destroy())
  },async requestImpl=>{
    await assert.rejects(getAttNative(roleUrl,{requestImpl,timeoutMs:500}),error=>error.code==='ATT_NATIVE_BODY_ABORTED')
    assert.equal(calls,2)
  })
})
