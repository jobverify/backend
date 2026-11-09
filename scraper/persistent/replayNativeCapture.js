import fs from 'node:fs/promises'
import path from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const directory = path.resolve(process.env.PERSISTENT_CAPTURE_DIR || '../artifacts/scraper-log-review-1b360f27/current-native/persistent-registered-native')
const output = path.resolve(process.env.PERSISTENT_REPLAY_DIR || '../artifacts/scraper-log-review-1b360f27/current-native/persistent-registered-replay-final-platform')
await fs.mkdir(output, { recursive: true })
const metadata = JSON.parse(await fs.readFile(path.join(directory, 'persistent-responses.json'), 'utf8'))
const sha = data => createHash('sha256').update(data).digest('hex')
const calls = [], occurrence = new Map()
const bodyObject = body => !body ? null : body instanceof FormData ? Object.fromEntries(body.entries()) : JSON.parse(body)
const key = (url, method, body) => JSON.stringify([url, method, body])
const grouped = new Map()
for (const item of metadata) { const k = key(item.url, item.method, item.requestBody); grouped.set(k, [...(grouped.get(k) || []), item]) }
// No network API is available to this verification path.
globalThis.fetch = () => { throw new Error('Offline Persistent replay attempted network access') }
const load = async (url, options = {}) => {
  const k = key(url, options.method || 'GET', bodyObject(options.body)), n = occurrence.get(k) || 0
  occurrence.set(k, n + 1)
  const entry = grouped.get(k)?.[n]
  if (!entry) throw new Error(`Captured request unavailable: ${url}`)
  const raw = gunzipSync(await fs.readFile(path.join(directory, entry.bodyFile)))
  if (sha(raw) !== entry.sha256 || raw.length !== entry.bytes) throw new Error(`Capture hash mismatch: ${entry.bodyFile}`)
  calls.push(entry.id)
  if (entry.status !== 200) { const error = new Error(`HTTP ${entry.status} for ${url}`); error.status = entry.status; throw error }
  return { raw, entry }
}
const provider = getScraperCatalog().find(p => p.source === 'persistent')
const jobs = await createCatalogScraper(provider).run({
  requestIntervalMs: 0,
  fetchTextImpl: async (url, options) => { const r = await load(url, options); return { text: r.raw.toString('utf8'), finalUrl: r.entry.finalUrl } },
  fetchJsonImpl: async (url, options) => JSON.parse((await load(url, options)).raw),
})
const summary = { verificationKind: 'offline-replay-of-real-registered-live-HTTP-captures', replayedAt: new Date().toISOString(),
  codeSha256: sha(await fs.readFile(new URL('./script.js', import.meta.url))),
  providerOverrideSha256: sha(await fs.readFile(new URL('../../scraper-support/providers/providerExtensions/zzzz-persistent-native-20261026.json', import.meta.url))),
  atsPlatform: provider.atsPlatform, runtimePlatformValues: [...new Set(jobs.map(job => job.atsPlatform))], source: provider.source, adapter: provider.adapter,
  modulePath: provider.modulePath, records: jobs.length, fullDetails: jobs.filter(j => j.sourceDetailComplete).length,
  originalPublicationDates: jobs.filter(j => j.postingDate).length, inventoryEvidence: readInventoryEvidence(jobs),
  proof: jobs[0]?.sourceNativeInventory, requestCaptureIds: calls.sort((a, b) => a - b), networkRequests: 0,
  liveCaptureStartedAt: metadata[0].capturedAt, liveCaptureEndedAt: metadata.at(-1).capturedAt }
await fs.writeFile(path.join(output, 'persistent-jobs.json.gz'), gzipSync(JSON.stringify(jobs)))
await fs.writeFile(path.join(output, 'persistent-summary.json'), JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary))
