import fs from 'node:fs/promises'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'
import { assessSoftFailureAcquisition } from './softFailureAssessment20261113.mjs'

const source = process.argv[2], folder = path.resolve(process.argv[3] || '')
if (!/^[a-z0-9][a-z0-9_-]*$/.test(source || '')) throw Error('Provide one catalog source and its capture directory')
const receipts = JSON.parse(await fs.readFile(path.join(folder, source + '.receipts.json'), 'utf8'))
const remaining = [...receipts].sort((a, b) => a.startedAt.localeCompare(b.startedAt))
let reads = 0
globalThis.fetch = async (input, init = {}) => {
  init.signal?.throwIfAborted()
  const url = String(input?.url || input), method = init.method || 'GET'
  const index = remaining.findIndex(row => row.requestedUrl === url && row.method === method)
  if (index < 0) throw Error('No original captured response for ' + method + ' ' + url)
  const row = remaining.splice(index, 1)[0]
  reads++
  if (row.error) throw Object.assign(new Error(row.error), {
    name: /timeout|aborted/i.test(row.error) ? 'TimeoutError' : 'Error',
  })
  if (!row.file) throw Error('Captured credential body is intentionally unavailable for replay')
  const body = gunzipSync(await fs.readFile(path.join(folder, row.file)))
  const response = new Response([204, 205, 304].includes(row.status) ? null : body,
    { status: row.status, headers: row.headers })
  Object.defineProperties(response, { url: { value: row.url }, redirected: { value: row.url !== url } })
  return response
}
const { getScraperCatalog, createCatalogScraper } = await import('../scraper-support/providers/index.js')
const provider = getScraperCatalog().find(row => row.source === source)
if (!provider) throw Error('Unknown source')
let result
let sourceAudit = null
try {
  const jobs = await createCatalogScraper(provider).run({ signal: AbortSignal.timeout(90000),
    onAudit: value => { sourceAudit = structuredClone(value) } })
  result = { source, transport: 'offline original response replay; not live recovery proof', reads,
    ...assessSoftFailureAcquisition(provider, jobs),
    sourceAudit: jobs.sourceAudit || sourceAudit,
    observations: jobs[Symbol.for('jobverify.verified-recruitment-observations')] || null,
    nativeCollectionEvidence: jobs.nativeCollectionEvidence || null }
} catch (error) {
  result = { source, transport: 'offline original response replay; not live recovery proof', reads,
    error: error.message, sourceAudit, observations: error.recruitmentObservations || null }
}
await fs.writeFile(path.join(folder, source + '.replay.json'), JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify({ source, reads, unconsumedOriginalReceipts: remaining.length,
  error: result.error, indiaJobs: result.indiaJobs, pipelineRecovered: result.runnerOutcome?.success,
  unresolved: result.observations?.unresolved, failures: result.observations?.failures }))
