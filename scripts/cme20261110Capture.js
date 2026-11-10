import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { initializeScraperProxyEnvironment } from '../scraper-support/utils/proxyEnvironment.js'
import { run } from '../scraper/cmegroup.workday/script.js'

const directory = path.resolve('../reports/scraper-2026-11-10T14-19-53-878Z/all-failures/cmegroup')
fs.mkdirSync(directory, { recursive: true })
initializeScraperProxyEnvironment()
const packets = [], nativeFetch = globalThis.fetch
globalThis.fetch = async (url, init = {}) => {
  const response = await nativeFetch(url, init)
  const body = await response.clone().text()
  packets.push({ url: String(url), method: init.method || 'GET', requestBody: init.body || null,
    status: response.status, finalURL: response.url, observedAt: new Date().toISOString(),
    responseHeaders: Object.fromEntries(response.headers), body,
    bodySha256: createHash('sha256').update(body).digest('hex') })
  fs.writeFileSync(path.join(directory, 'cme20261110-public-responses.json'), JSON.stringify({ packets }, null, 2))
  return response
}
try {
  await fetch('https://www.cmegroup.com/careers.html')
  const jobs = await run({ retainNativeProof: true })
  fs.writeFileSync(path.join(directory, 'cme20261110-captured-jobs.json'), JSON.stringify(jobs, null, 2))
  const fixtureDirectory = path.resolve('scraper/cmegroup.workday/fixtures')
  fs.mkdirSync(fixtureDirectory, { recursive: true })
  fs.writeFileSync(path.join(fixtureDirectory, 'cme20261110-native.json.gz'), gzipSync(JSON.stringify({
    checkedAt: new Date().toISOString(), captureTransport: 'ordinary-public-HTTP-system-proxy',
    scope: 'Bangalore native location facet; whole-company inventory unknown', packets,
  })))
  console.log(JSON.stringify({ status: 'success', jobs: jobs.length, packets: packets.length }))
} catch (error) {
  const result = { status: 'failed', name: error.name, message: error.message, stack: error.stack, packets: packets.length }
  fs.writeFileSync(path.join(directory, 'cme20261110-capture-result.json'), JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result))
  process.exitCode = 1
}
