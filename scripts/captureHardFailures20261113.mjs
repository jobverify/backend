import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { initializeScraperProxyEnvironment } from '../scraper-support/utils/proxyEnvironment.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

// Read-only acquisition: call the source module directly, never runner persistence.
initializeScraperProxyEnvironment()
const output = path.resolve(process.env.HARD_FAILURE_CAPTURE_DIR || '../scraper-log-analysis-20261113/repair-evidence')
await fs.mkdir(output, { recursive: true })
const source = process.argv[2]
if (!/^[a-z][a-z0-9]*$/.test(source || '')) throw Error('Provide one catalog source')
const pythonFetch = async (input, options = {}) => {
  const url = String(input?.url || input)
  const headers = Object.fromEntries(new Headers(options.headers || {}))
  if (!headers['user-agent']) headers['user-agent'] = 'node'
  headers['accept-encoding'] = 'identity'
  const args = { url, headers, method: options.method || 'GET', body: options.body ?? null, redirect: options.redirect || 'follow' }
  const packet = await new Promise((resolve, reject) => {
    options.signal?.throwIfAborted()
    const child = spawn('python', [fileURLToPath(new URL('./publicReadTransport20261113.py', import.meta.url))],
      { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
    const out = [], errors = []
    const abort = () => { child.kill(); reject(options.signal.reason) }
    options.signal?.addEventListener('abort', abort, { once: true })
    child.stdout.on('data', chunk => out.push(chunk))
    child.stderr.on('data', chunk => errors.push(chunk))
    child.on('error', reject)
    child.on('close', code => {
      options.signal?.removeEventListener('abort', abort)
      if (code) reject(Error('Public read transport failed: ' + Buffer.concat(errors).toString().slice(-1200)))
      else { try { resolve(JSON.parse(Buffer.concat(out).toString())) } catch (error) { reject(error) } }
    })
    child.stdin.on('error', reject)
    child.stdin.end(JSON.stringify(args))
  })
  const responseHeaders = new Headers()
  for (const [name, value] of packet.headers) responseHeaders.append(name, value)
  const response = new Response([204, 205, 304].includes(packet.status) ? null : Buffer.from(packet.body, 'base64'),
    { status: packet.status, headers: responseHeaders })
  Object.defineProperties(response, { url: { value: packet.url }, redirected: { value: packet.url !== url } })
  return response
}
const originalFetch = process.argv.includes('--python') ? pythonFetch : globalThis.fetch
const receipts = []
let receiptSequence = 0
const captureFetch = async (input, options = {}) => {
  const index = receiptSequence++
  const requestedUrl = String(input?.url || input)
  const startedAt = new Date().toISOString()
  try {
    const response = await originalFetch(input, options)
    const body = Buffer.from(await response.arrayBuffer())
    const credentialBody = new URL(requestedUrl).pathname.replace(/\/$/, '') === '/api/token/noauth'
    const filename = credentialBody ? null : `${source}-${index}.body.gz`
    if (filename) await fs.writeFile(path.join(output, filename), gzipSync(body))
    receipts.push({ requestedUrl, method: options.method || 'GET', startedAt,
      status: response.status, url: response.url, headers: Object.fromEntries([...response.headers].filter(([name]) =>
        ['content-type', 'location', 'last-modified', 'etag', 'content-length'].includes(name))),
      bytes: body.length, sha256: createHash('sha256').update(body).digest('hex'), file: filename,
      ...(credentialBody ? { bodyOmittedReason: 'Issued anonymous session credentials are not retained in capture artifacts' } : {}) })
    const replay = new Response([204, 205, 304].includes(response.status) ? null : body,
      { status: response.status, statusText: response.statusText, headers: response.headers })
    Object.defineProperties(replay, { url: { value: response.url }, redirected: { value: response.redirected } })
    return replay
  } catch (error) {
    receipts.push({ requestedUrl, method: options.method || 'GET', startedAt, error: error.message })
    throw error
  }
}
globalThis.fetch = captureFetch
const startedAt = new Date().toISOString()
const runOptions = JSON.parse(process.env.HARD_FAILURE_OPTIONS_JSON || '{}')
let result
try {
  const { getScraperCatalog, createCatalogScraper } = await import('../scraper-support/providers/index.js')
  const provider = getScraperCatalog().find(row => row.source === source)
  let scraper
  if (provider) scraper = createCatalogScraper(provider)
  else scraper = await import(`../scraper/${source}/script.js`)
  const jobs = await scraper.run({ ...runOptions, fetchImpl: captureFetch, signal: AbortSignal.timeout(Number(process.env.HARD_FAILURE_BUDGET_MS) || 180000) })
  result = { source, ok: true, startedAt, completedAt: new Date().toISOString(), jobs: jobs.length,
    inventoryEvidence: readInventoryEvidence(jobs), audit: jobs.sourceAudit || jobs.nativeCollectionEvidence || null,
    runOptions, sample: jobs.slice(0, 2) }
} catch (error) {
  result = { source, ok: false, startedAt, completedAt: new Date().toISOString(), error: error.message,
    failureKind: error.failureKind || null, softFailure: error.softFailure === true,
    abortRetries: error.abortRetries === true, stack: error.stack, audit: error.sourceAudit || null }
}
await fs.writeFile(path.join(output, `${source}.receipts.json`), JSON.stringify(receipts, null, 2))
await fs.writeFile(path.join(output, `${source}.result.json`), JSON.stringify(result, null, 2))
console.log(JSON.stringify({ source, ok: result.ok, jobs: result.jobs, error: result.error, requests: receipts.length }))
process.exitCode = result.ok ? 0 : 1
