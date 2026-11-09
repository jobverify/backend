import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import net from 'node:net'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { runIsolatedExtraction } from '../scripts/auditCatalogExtractions.js'

const backend = fileURLToPath(new URL('../', import.meta.url))
const parent = path.join(backend, '.tmp')
const keys = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'NO_PROXY', 'no_proxy', 'NODE_USE_ENV_PROXY']
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const supported = typeof http.setGlobalProxyFromEnv === 'function'

for (const scenario of ['configured', 'bypass', 'disabled', 'invalid', 'runner-sequential', 'runner-parallel']) {
  test(`restricted extraction respects proxy environment: ${scenario}`, { skip: !supported }, async () => {
    fs.mkdirSync(parent, { recursive: true })
    const directory = fs.mkdtempSync(path.join(parent, 'scraper-proxy-isolation-'))
    const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]))
    const sockets = new Set()
    let originReads = 0, proxyReads = 0
    const origin = http.createServer((_request, response) => {
      originReads++
      response.setHeader('Content-Type', 'application/json')
      response.end('{"ok":true}')
    })
    const proxy = http.createServer((_request, response) => {
      proxyReads++; response.writeHead(502); response.end()
    })
    for (const server of [origin, proxy]) server.on('connection', socket => {
      sockets.add(socket); socket.once('close', () => sockets.delete(socket))
    })
    try {
      await listen(origin)
      const port = origin.address().port
      proxy.on('connect', (request, socket, head) => {
        assert.equal(request.url, `127.0.0.1:${port}`)
        proxyReads++
        const upstream = net.connect(port, '127.0.0.1', () => {
          socket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
          if (head.length) upstream.write(head)
          socket.pipe(upstream); upstream.pipe(socket)
        })
        sockets.add(upstream); upstream.once('close', () => sockets.delete(upstream))
        upstream.on('error', () => socket.destroy()); socket.on('error', () => upstream.destroy())
        socket.on('close', () => upstream.destroy())
      })
      await listen(proxy)
      for (const key of keys) delete process.env[key]
      process.env.HTTP_PROXY = `http://127.0.0.1:${proxy.address().port}`
      process.env.NO_PROXY = scenario === 'bypass' ? '127.0.0.1' : ''
      if (scenario === 'disabled') process.env.NODE_USE_ENV_PROXY = '0'
      if (scenario === 'invalid') process.env.HTTP_PROXY = 'invalid://PRIVATE_PROXY_VALUE'
      const modulePath = path.join(directory, 'fixture.mjs')
      fs.writeFileSync(modulePath, `export const run = async () => {
        const response = await fetch('http://127.0.0.1:${port}/jobs', {signal:AbortSignal.timeout(5000)});
        if (!(await response.json()).ok) throw Error('Unexpected loopback response');
        return [{jobId:'proxy-role',title:'Engineer',location:'Bengaluru, India',
          applyUrl:'https://example.test/jobs/proxy-role',description:'Build and maintain software for customers.'}];
      }`)
      if (scenario.startsWith('runner-')) {
        const fixture = fileURLToPath(new URL('./fixtures/scraperProxyRunner.js', import.meta.url))
        const result = await new Promise((resolve, reject) => {
          const child = spawn(process.execPath, [fixture, `http://127.0.0.1:${port}/jobs`,
            ...(scenario === 'runner-parallel' ? ['--parallel'] : [])], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
          let stdout = '', stderr = ''
          const timer = setTimeout(() => { child.kill(); reject(new Error('Runner fixture deadline')) }, 15000)
          child.stdout.on('data', data => { stdout += data }); child.stderr.on('data', data => { stderr += data })
          child.once('error', reject)
          child.once('close', code => { clearTimeout(timer); code === 0 ? resolve(JSON.parse(stdout)) : reject(new Error(stderr || stdout)) })
        })
        assert.equal(result.saves, 1)
        assert.equal(result.summary['proxy-fixture'].success, true)
        assert.equal(result.summary['proxy-fixture'].eligibleJobs, 1)
        assert.equal(originReads, 1); assert.equal(proxyReads, 1)
        return
      }
      const row = await runIsolatedExtraction({ adapter: 'script', source: 'proxy-fixture', companyName: 'Fixture', modulePath },
        { outputDirectory: path.join(directory, 'output'), timeoutMs: 15000 })
      assert.equal(row.productionWrites, false)
      if (scenario === 'invalid') {
        assert.equal(row.outcome, 'extraction-failed')
        assert.equal(row.failureCode, 'SCRAPER_PROXY_CONFIGURATION_INVALID')
        assert.equal(row.rawJobs, null)
        assert.doesNotMatch(JSON.stringify(row), /PRIVATE_PROXY_VALUE/)
        assert.equal(originReads, 0); assert.equal(proxyReads, 0)
      } else {
        assert.equal(row.outcome, 'positive-extraction-incomplete-evidence')
        assert.equal(row.eligibleJobs, 1)
        assert.equal(originReads, 1)
        assert.equal(proxyReads, scenario === 'configured' ? 1 : 0)
      }
    } finally {
      for (const key of keys) delete process.env[key]
      for (const [key, value] of Object.entries(previous)) if (value !== undefined) process.env[key] = value
      for (const socket of sockets) socket.destroy()
      await Promise.all([origin, proxy].map(server => new Promise(resolve => server.close(resolve))))
      const resolved = path.resolve(directory)
      assert.equal(path.dirname(resolved), path.resolve(parent))
      assert.match(path.basename(resolved), /^scraper-proxy-isolation-/)
      fs.rmSync(resolved, { recursive: true, force: true })
    }
  })
}
