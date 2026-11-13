import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { initializeScraperProxyEnvironment } from '../scraper-support/utils/proxyEnvironment.js'
import { assessSoftFailureAcquisition } from './softFailureAssessment20261113.mjs'
import { classifyScraperError, runScraperWithTimeout } from '../scraper-support/runner.js'

initializeScraperProxyEnvironment()
const source = process.argv[2]
if (!/^[a-z0-9][a-z0-9_-]*$/.test(source || '')) throw Error('Provide one exact catalog source')
const attempt = new Date().toISOString().replace(/[:.]/g, '-')
const output = path.resolve(process.env.SOFT_FAILURE_CAPTURE_DIR
  || `../scraper-log-analysis-20261113/soft-repair-evidence/captures/${source}-${attempt}`)
await fs.mkdir(output, { recursive: true })

const pythonFetch = async (input, options = {}) => {
  const url = String(input?.url || input), headers = Object.fromEntries(new Headers(options.headers || {}))
  if (!headers['user-agent']) headers['user-agent'] = 'node'
  headers['accept-encoding'] = 'identity'
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
    child.stdin.end(JSON.stringify({ url, headers, method: options.method || 'GET', body: options.body ?? null,
      redirect: options.redirect || 'follow' }))
  })
  const response = new Response([204, 205, 304].includes(packet.status) ? null : Buffer.from(packet.body, 'base64'),
    { status: packet.status, headers: packet.headers })
  Object.defineProperties(response, { url: { value: packet.url }, redirected: { value: packet.url !== url } })
  return response
}
const transport = process.argv.includes('--python') ? pythonFetch : globalThis.fetch
const receipts = []
let sequence = 0
globalThis.fetch = async (input, options = {}) => {
  const index = sequence++, requestedUrl = String(input?.url || input), startedAt = new Date().toISOString()
  try {
    const response = await transport(input, options), body = Buffer.from(await response.arrayBuffer())
    const issuedCredentials = /\/(?:token|csrf-token)(?:\/noauth)?\/?$/i.test(new URL(requestedUrl).pathname)
    const file = issuedCredentials ? null : `${source}-${index}.body.gz`
    if (file) await fs.writeFile(path.join(output, file), gzipSync(body))
    receipts.push({ requestedUrl, method: options.method || 'GET', startedAt, status: response.status, url: response.url,
      headers: Object.fromEntries([...response.headers].filter(([name]) =>
        ['content-type', 'location', 'last-modified', 'etag', 'content-length'].includes(name))),
      bytes: body.length, sha256: createHash('sha256').update(body).digest('hex'), file,
      ...(issuedCredentials ? { bodyOmittedReason: 'Issued anonymous credentials are not retained' } : {}) })
    const replay = new Response([204, 205, 304].includes(response.status) ? null : body,
      { status: response.status, statusText: response.statusText, headers: response.headers })
    Object.defineProperties(replay, { url: { value: response.url }, redirected: { value: response.redirected } })
    return replay
  } catch (error) {
    receipts.push({ requestedUrl, method: options.method || 'GET', startedAt, error: error.message })
    throw error
  }
}

const startedAt = new Date().toISOString()
const runtimeFiles = new Set(['scraper-support/runner.js', 'scraper-support/providers/index.js',
  'scraper-support/utils/inventoryEvidence.js', 'scraper-support/utils/sourceObservationEvidence.js',
  'scraper-support/utils/activeNativeHtml.js', 'scraper-support/utils/visibleNativeHtml.js',
  'scraper-support/shared/verifiedEmployerLinkedIn.js',
  'scraper-support/utils/emptyOnlyRecruitmentRecovery.js', 'scraper-support/utils/verifiedRecruitment.js',
  'scraper-support/utils/scraperOutcome.js', 'scraper-support/utils/publishableJobMetrics.js',
  'scripts/captureSoftFailures20261113.mjs', 'scripts/softFailureAssessment20261113.mjs',
  'scripts/publicReadTransport20261113.py'])
for (const directory of [`scraper/${source}`, `scraper/${source}.workday`]) {
  try {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (entry.isFile() && /\.(?:js|json)$/.test(entry.name) && !/\.test\.js$|^jobs(?:\.|$)/.test(entry.name)) {
        runtimeFiles.add(path.posix.join(directory, entry.name))
      }
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error }
}
const codeHashes = async () => Object.fromEntries(await Promise.all([...runtimeFiles].sort().map(async file =>
  [file, createHash('sha256').update(await fs.readFile(file)).digest('hex')])) )
const codeAtStart = await codeHashes()
let result
try {
  const { getScraperCatalog, createCatalogScraper } = await import('../scraper-support/providers/index.js')
  const provider = getScraperCatalog().find(row => row.source === source)
  if (!provider) throw Error('Source is not in the current catalog')
  const scraper = createCatalogScraper(provider), options = JSON.parse(process.env.SOFT_FAILURE_OPTIONS_JSON || '{}')
  const configured = { ...scraper, run: operationOptions => scraper.run({ ...options, ...operationOptions }) }
  // Do not inject a fetchImpl option: it intentionally disables empty-only
  // production recovery. The real global fetch is captured above instead.
  const jobs = await runScraperWithTimeout(configured, undefined,
    { signal: AbortSignal.timeout(Number(process.env.SOFT_FAILURE_BUDGET_MS) || 360000) })
  const assessment = assessSoftFailureAcquisition(provider, jobs)
  const jobsFile = `${source}.jobs.json.gz`
  await fs.writeFile(path.join(output, jobsFile), gzipSync(JSON.stringify(jobs)), { flag: 'wx' })
  result = { source, startedAt, completedAt: new Date().toISOString(), sourceExecutionSucceeded: true,
    pipelineRecovered: assessment.runnerOutcome.success === true, ...assessment,
    jobsFile,
    audit: jobs.nativeCollectionEvidence || jobs.sourceAudit || jobs[Symbol.for('jobverify.verified-recruitment-observations')] || null,
    sourceAudit: jobs.sourceAudit || null,
    nativeCollectionEvidence: jobs.nativeCollectionEvidence || null,
    recruitmentObservations: jobs[Symbol.for('jobverify.verified-recruitment-observations')] || null,
    runOptions: options, captureScope: 'Public global fetch; source-native alternative transports are not intercepted', sample: jobs.slice(0, 2) }
} catch (error) {
  result = { source, startedAt, completedAt: new Date().toISOString(), sourceExecutionSucceeded: false,
    pipelineRecovered: false, error: error.message, ...classifyScraperError(error),
    audit: error.recruitmentObservations || error.sourceAudit || null, stack: error.stack }
}
result.codeAtStart = codeAtStart
result.codeAtEnd = await codeHashes()
result.codeUnchangedDuringCapture = JSON.stringify(result.codeAtStart) === JSON.stringify(result.codeAtEnd)
await fs.writeFile(path.join(output, `${source}.receipts.json`), JSON.stringify(receipts, null, 2) + '\n', { flag: 'wx' })
await fs.writeFile(path.join(output, `${source}.result.json`), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' })
console.log(JSON.stringify({ source, sourceExecutionSucceeded: result.sourceExecutionSucceeded,
  pipelineRecovered: result.pipelineRecovered, indiaJobs: result.indiaJobs, eligibleJobs: result.eligibleJobs,
  zeroJobEvidence: result.zeroJobEvidence, error: result.error, requests: receipts.length, output }))
process.exitCode = result.pipelineRecovered ? 0 : 2
