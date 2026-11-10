import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { initializeScraperProxyEnvironment } from '../scraper-support/utils/proxyEnvironment.js'

const source = process.argv[2]
if (!['commonwealthbankofaustralia', 'ciena', 'carelonglobalsolutions', 'chrobinson'].includes(source)) throw Error('Explicit source required')
initializeScraperProxyEnvironment()
const directory = path.resolve('../reports/scraper-2026-11-10T14-19-53-878Z/all-failures/cmegroup/other-workday', source)
fs.mkdirSync(directory, { recursive: true })
const packets = [], originalFetch = globalThis.fetch, attemptedAt = new Date().toISOString()
const rawFile = path.join(directory, 'cme20261110-public-responses.jsonl')
if (fs.existsSync(rawFile)) throw Error('Capture already exists; retain original evidence and choose an explicit new attempt path')
globalThis.fetch = async (url, init = {}) => {
  const response = await originalFetch(url, init)
  const body = await response.clone().text()
  const packet = { id: packets.length + 1, url: String(url), method: init.method || 'GET', requestBody: init.body ?? null,
    status: response.status, finalURL: response.url, observedAt: new Date().toISOString(),
    responseHeaders: Object.fromEntries(response.headers), body,
    bodySha256: createHash('sha256').update(body).digest('hex') }
  packets.push(packet)
  fs.appendFileSync(rawFile, JSON.stringify(packet) + '\n')
  return response
}
try {
  const { run } = await import(`../scraper/${source}.workday/script.js`)
  const jobs = await run({ retainNativeProof: true })
  const completedAt = new Date().toISOString()
  const fixture = { checkedAt: completedAt, capturedTrial: { attemptedAt, completedAt },
    captureTransport: 'ordinary-public-HTTP-system-proxy', source,
    scope: 'registered Workday native inventory; company coverage remains partial', packets }
  const fixtureDirectory = path.resolve('scraper', source + '.workday', 'fixtures')
  fs.mkdirSync(fixtureDirectory, { recursive: true })
  const fixturePath = path.join(fixtureDirectory, 'cme20261110-native.json.gz')
  fs.writeFileSync(fixturePath, gzipSync(JSON.stringify(fixture)))
  fs.writeFileSync(path.join(directory, 'cme20261110-jobs.json'), JSON.stringify(jobs, null, 2) + '\n')
  const result = { source, outcome: 'captured-current-registered-reader', attemptedAt, completedAt,
    jobs: jobs.length, packets: packets.length, fixture: path.relative(path.resolve('.'), fixturePath),
    productionWrites: false, sourceScopeComplete: false }
  fs.writeFileSync(path.join(directory, 'capture-result.json'), JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify(result))
} catch (error) {
  const result = { source, outcome: 'current-registered-reader-failed', attemptedAt, completedAt: new Date().toISOString(),
    name: error.name, message: error.message, stack: error.stack, packets: packets.length, productionWrites: false }
  fs.writeFileSync(path.join(directory, 'capture-result.json'), JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify(result))
  process.exitCode = 1
}
