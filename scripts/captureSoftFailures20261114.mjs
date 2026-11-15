import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { initializeScraperProxyEnvironment } from '../scraper-support/utils/proxyEnvironment.js'
import { assessSoftFailureAcquisition } from './softFailureAssessment20261113.mjs'
import { serializePublicReadRequest, shouldOmitCredentialBody, redactCaptureUrl, publicReadJsonReplacer } from './publicReadRequest20261114.mjs'
import { classifyScraperError, runScraperWithTimeout } from '../scraper-support/runner.js'

initializeScraperProxyEnvironment()
const source = process.argv[2]
if (!/^[a-z0-9][a-z0-9_-]*$/.test(source || '')) throw Error('Provide one exact catalog source')
const attempt = new Date().toISOString().replace(/[:.]/g, '-')
const output = path.resolve(process.env.SOFT_FAILURE_CAPTURE_DIR
  || `../scraper-log-analysis-20261113/soft-repair-evidence/captures/${source}-${attempt}`)
await fs.mkdir(output, { recursive: true })

const pythonFetch = async (input, options = {}) => {
  const request = await serializePublicReadRequest(input, options)
  const url = request.url
  const packet = await new Promise((resolve, reject) => {
    request.signal.throwIfAborted()
    const child = spawn('python', [fileURLToPath(new URL('./publicReadTransport20261114.py', import.meta.url))],
      { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
    const out = [], errors = []
    const abort = () => { child.kill(); reject(request.signal.reason) }
    request.signal.addEventListener('abort', abort, { once: true })
    child.stdout.on('data', chunk => out.push(chunk))
    child.stderr.on('data', chunk => errors.push(chunk))
    child.on('error', reject)
    child.on('close', code => {
      request.signal.removeEventListener('abort', abort)
      if (code) reject(Error('Public read transport failed: ' + Buffer.concat(errors).toString().slice(-1200)))
      else { try { resolve(JSON.parse(Buffer.concat(out).toString())) } catch (error) { reject(error) } }
    })
    child.stdin.on('error', reject)
    child.stdin.end(JSON.stringify(request))
  })
  const response = new Response([204, 205, 304].includes(packet.status) ? null : Buffer.from(packet.body, 'base64'),
    { status: packet.status, headers: packet.headers })
  Object.defineProperties(response, { url: { value: packet.url }, redirected: { value: packet.url !== url },
    ...(packet.wireBody ? { publicReadWireEvidence: { value: {
      contentEncoding: packet.wireContentEncoding, body: Buffer.from(packet.wireBody, 'base64'),
    } } } : {}) })
  return response
}
const transport = process.argv.includes('--python') ? pythonFetch : globalThis.fetch
const receipts = []
let sequence = 0
globalThis.fetch = async (input, options = {}) => {
  const index = sequence++, requestedUrl = String(input?.url || input), startedAt = new Date().toISOString()
  const method = options.method || input?.method || 'GET'
  try {
    const response = await transport(input, options), body = Buffer.from(await response.arrayBuffer())
    const issuedCredentials = shouldOmitCredentialBody(requestedUrl, body)
    const file = issuedCredentials ? null : `${source}-${index}.body.gz`
    if (file) await fs.writeFile(path.join(output, file), gzipSync(body))
    const wire = response.publicReadWireEvidence
    const wireFile = !issuedCredentials && wire ? `${source}-${index}.wire.bin` : null
    if (wireFile) await fs.writeFile(path.join(output, wireFile), wire.body)
    receipts.push({ requestedUrl: redactCaptureUrl(requestedUrl), method, startedAt, status: response.status, url: redactCaptureUrl(response.url),
      headers: Object.fromEntries([...response.headers].filter(([name]) =>
        ['content-type', 'location', 'last-modified', 'etag', 'content-length'].includes(name)).map(([name, value]) => [name, name === 'location' ? redactCaptureUrl(value) : value])),
      bytes: body.length, sha256: createHash('sha256').update(body).digest('hex'), file,
      ...(wire ? { wire: { contentEncoding: wire.contentEncoding, bytes: wire.body.length,
        sha256: createHash('sha256').update(wire.body).digest('hex'), file: wireFile } } : {}),
      ...(issuedCredentials ? { bodyOmittedReason: 'Issued anonymous credentials are not retained' } : {}) })
    const replay = new Response([204, 205, 304].includes(response.status) ? null : body,
      { status: response.status, statusText: response.statusText, headers: response.headers })
    Object.defineProperties(replay, { url: { value: response.url }, redirected: { value: response.redirected } })
    return replay
  } catch (error) {
    receipts.push({ requestedUrl: redactCaptureUrl(requestedUrl), method, startedAt, error: error.message })
    throw error
  }
}

const startedAt = new Date().toISOString()
const captureBudgetMs = Number(process.env.SOFT_FAILURE_BUDGET_MS) || 360000
const runtimeFiles = new Set(['scraper-support/runner.js', 'scraper-support/providers/index.js',
  'scraper-support/providers/customProviders.json', 'scraper-support/providers/apiPortalProviders.json', 'scraper-support/apiPortal/engine.js',
  'scraper-support/myworkday/engine.js', 'scraper-support/myworkday/companies.json',
  'scraper-support/utils/inventoryEvidence.js', 'scraper-support/utils/sourceObservationEvidence.js',
  'scraper-support/utils/activeNativeHtml.js', 'scraper-support/utils/visibleNativeHtml.js',
  'scraper-support/shared/verifiedEmployerLinkedIn.js',
  'scraper-support/utils/emptyOnlyRecruitmentRecovery.js', 'scraper-support/utils/verifiedRecruitment.js',
  'scraper-support/utils/recruitmentPublisher.js', 'scraper-support/utils/recruitmentDarwinbox.js',
  'scraper-support/utils/scraperOutcome.js', 'scraper-support/utils/publishableJobMetrics.js',
  'scripts/captureSoftFailures20261114.mjs', 'scripts/softFailureAssessment20261113.mjs',
  'scripts/publicReadTransport20261114.py', 'scripts/publicReadRequest20261114.mjs'])
for (const directory of [`scraper/${source}`, `scraper/${source}.workday`, `scraper/${source}.rmk`]) {
  try {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (entry.isFile() && /\.(?:js|json)$/.test(entry.name) && !/\.test\.js$|^jobs(?:\.|$)/.test(entry.name)) {
        runtimeFiles.add(path.posix.join(directory, entry.name))
      }
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error }
}
const codeHashes = async () => {
  const files = new Set(runtimeFiles)
  // Resolve source overrides and shared reader dependencies at both boundaries,
  // including additions or removals during a capture. An override can replace
  // the entire adapter; shared readers may import another native parser.
  for (const [directory, extension] of [
    ['scraper-support/providers/providerExtensions', '.json'],
    ['scraper-support/utils', '.js'],
    ['scraper-support/shared', '.js'],
    ['scraper-support/detailExtractors', '.js'],
  ]) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(extension)) files.add(path.posix.join(directory, entry.name))
    }
  }
  // Several source wrappers delegate to nested native readers and their
  // reviewed JSON profiles. Include these actual runtime contracts too.
  const nativeReaders = async directory => {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const file = path.posix.join(directory, entry.name)
      if (entry.isDirectory() && !/^(?:tests?|fixtures|test-data)(?:-|$)/.test(entry.name)) await nativeReaders(file)
      else if (entry.isFile() && /\.(?:js|json)$/.test(entry.name) && !/\.test\.js$|^jobs(?:\.|$)/.test(entry.name)) files.add(file)
    }
  }
  await nativeReaders('scraper-support/native-sources')
  return Object.fromEntries(await Promise.all([...files].sort().map(async file =>
    [file, createHash('sha256').update(await fs.readFile(file)).digest('hex')])) )
}
const codeAtStart = await codeHashes()
let result, configuredSourceTimeoutMs = null
try {
  const { getScraperCatalog, createCatalogScraper } = await import('../scraper-support/providers/index.js')
  const provider = getScraperCatalog().find(row => row.source === source)
  if (!provider) throw Error('Source is not in the current catalog')
  configuredSourceTimeoutMs = provider.scraperTimeoutMs ?? null
  const scraper = createCatalogScraper(provider), options = JSON.parse(process.env.SOFT_FAILURE_OPTIONS_JSON || '{}')
  const configured = { ...scraper, run: operationOptions => scraper.run({ ...options, ...operationOptions }) }
  // Do not inject a fetchImpl option: it intentionally disables empty-only
  // production recovery. The real global fetch is captured above instead.
  const jobs = await runScraperWithTimeout(configured, undefined,
    { signal: AbortSignal.timeout(captureBudgetMs) })
  const assessment = assessSoftFailureAcquisition(provider, jobs)
  const jobsFile = `${source}.jobs.json.gz`
  await fs.writeFile(path.join(output, jobsFile), gzipSync(JSON.stringify(jobs, publicReadJsonReplacer)), { flag: 'wx' })
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
result.captureTransport = process.argv.includes('--python') ? 'python-byte-preserving-v2' : 'native-fetch'
result.captureBudgetMs = captureBudgetMs
result.configuredSourceTimeoutMs = configuredSourceTimeoutMs
result.codeAtStart = codeAtStart
result.codeAtEnd = await codeHashes()
result.codeUnchangedDuringCapture = JSON.stringify(result.codeAtStart) === JSON.stringify(result.codeAtEnd)
await fs.writeFile(path.join(output, `${source}.receipts.json`), JSON.stringify(receipts, publicReadJsonReplacer, 2) + '\n', { flag: 'wx' })
await fs.writeFile(path.join(output, `${source}.result.json`), JSON.stringify(result, publicReadJsonReplacer, 2) + '\n', { flag: 'wx' })
console.log(JSON.stringify({ source, sourceExecutionSucceeded: result.sourceExecutionSucceeded,
  pipelineRecovered: result.pipelineRecovered, indiaJobs: result.indiaJobs, eligibleJobs: result.eligibleJobs,
  zeroJobEvidence: result.zeroJobEvidence, error: result.error, requests: receipts.length, output }, publicReadJsonReplacer))
process.exitCode = result.pipelineRecovered ? 0 : 2
