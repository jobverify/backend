import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

// Explicit read-only diagnostic entry point: never invokes the runner or persistence.
const runStamp = new Date().toISOString().replace(/[:.]/g, '-')
const dir = path.resolve(process.env.PERSISTENT_EVIDENCE_DIR || `../artifacts/scraper-log-review-1b360f27/current-native/persistent-registered-native-${runStamp}`)
await fs.mkdir(dir, { recursive: true })
const captured = [], startedAt = new Date().toISOString()
let sequence = 0
const hash = body => crypto.createHash('sha256').update(body).digest('hex')
const capture = async (url, options = {}) => {
  const method = options.method || 'GET'
  const u = new URL(url)
  const allowedGet = url === 'https://www.persistent.com/careers/' || (u.origin === 'https://careers.persistent.com' && (/^\/main\.[a-f0-9]+\.js$/.test(u.pathname) || u.pathname === '/explore-opportunities'))
    || (u.origin === 'https://public.zwayam.com' && (/^\/data-service\/v2\/company\/\d+\/careersite-configurations$/.test(u.pathname) || /^\/requisition_service\/getReqFieldsForCareersSite\/\d+\/\d+$/.test(u.pathname)))
  if (!(method === 'GET' && allowedGet) && !(method === 'POST' && ['https://public.zwayam.com/jobs/search', 'https://public.zwayam.com/jobs-service/v1/jobs/careersite'].includes(url))) throw new Error(`Blocked unexpected read-only diagnostic route ${method} ${url}`)
  const id = ++sequence
  let requestBody = null
  if (method === 'POST') requestBody = options.body instanceof FormData ? Object.fromEntries(options.body.entries()) : JSON.parse(options.body)
  const response = await fetch(url, { ...options, signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(45000)]) : AbortSignal.timeout(45000) })
  const body = Buffer.from(await response.arrayBuffer())
  const name = `persistent-response-${String(id).padStart(4, '0')}.gz`
  await fs.writeFile(path.join(dir, name), gzipSync(body))
  captured.push({ id, method, url, finalUrl: response.url, status: response.status, bytes: body.length, sha256: hash(body), bodyFile: name, requestBody, capturedAt: new Date().toISOString() })
  if (id % 100 === 0) console.log(`Persistent native responses captured: ${id}`)
  if (!response.ok) { const e = new Error(`HTTP ${response.status} for ${url}`); e.status = response.status; throw e }
  return { body, finalUrl: response.url }
}
try { await fs.access(path.join(dir, 'persistent-responses.json')); throw new Error('Refusing to overwrite existing Persistent capture evidence') } catch (error) { if (error.code !== 'ENOENT') throw error }
const codeSha256 = hash(await fs.readFile(new URL('./script.js', import.meta.url)))
await fs.writeFile(path.join(dir, 'persistent-start.json'), JSON.stringify({ verificationKind: 'live-public-read-only-registered-attempt', startedAt, codeSha256 }, null, 2))
const provider = getScraperCatalog().find(p => p.source === 'persistent')
try {
  const jobs = await createCatalogScraper(provider).run({
    fetchTextImpl: async (url, options) => { const r = await capture(url, options); return { text: r.body.toString('utf8'), finalUrl: r.finalUrl } },
    fetchJsonImpl: async (url, options) => JSON.parse((await capture(url, options)).body),
  })
  await fs.writeFile(path.join(dir, 'persistent-jobs.json.gz'), gzipSync(JSON.stringify(jobs)))
  const evidence = readInventoryEvidence(jobs)
  const summary = { startedAt, finishedAt: new Date().toISOString(), source: provider.source, adapter: provider.adapter, modulePath: provider.modulePath,
    codeSha256, count: jobs.length, inventoryEvidence: evidence, proof: jobs[0]?.sourceNativeInventory,
    fullDetails: jobs.filter(j => j.sourceDetailComplete).length, originalPublicationDates: jobs.filter(j => j.postingDate).length,
    countryValues: [...new Set(jobs.map(j => j.country))],
    sourceCatalog: { companyName: provider.companyName, companyCareerPage: provider.companyCareerPage, atsPlatform: provider.atsPlatform, extractionStrategy: provider.extractionStrategy },
  }
  await fs.writeFile(path.join(dir, 'persistent-summary.json'), JSON.stringify(summary, null, 2))
  console.log(JSON.stringify(summary))
} catch (error) {
  await fs.writeFile(path.join(dir, 'persistent-failed-attempt.json'), JSON.stringify({ startedAt, failedAt: new Date().toISOString(), codeSha256, error: error.message, status: error.status || null, completeInventoryEstablished: false }, null, 2))
  throw error
} finally {
  await fs.writeFile(path.join(dir, 'persistent-responses.json'), JSON.stringify(captured.sort((a, b) => a.id - b.id), null, 2))
}
