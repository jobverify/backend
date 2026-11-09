import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

// Opt-in audit transport only. It never follows role/application links and does
// not replace the production adapter's normal transport or response limits.
export function createPublicAtsAuditCapture(provider, {
  outputDirectory, fetchImpl = globalThis.fetch, maxBytes = 8 * 1024 * 1024,
} = {}) {
  if (provider.adapter !== 'publicAts') throw new Error('Capture requires a publicAts provider')
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/i.test(provider.source || '')) throw new Error('Invalid capture source')
  if (!/^[a-z0-9][a-z0-9._-]{0,255}$/i.test(provider.boardToken || '')) throw new Error('Invalid board token')
  if (!outputDirectory || !path.isAbsolute(outputDirectory)) throw new Error('Absolute audit output directory required')
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 8 * 1024 * 1024) throw new Error('Invalid capture byte limit')
  const token = encodeURIComponent(provider.boardToken)
  const endpoints = {
    greenhouse: `https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`,
    ashby: `https://api.ashbyhq.com/posting-api/job-board/${token}`,
    lever: `https://api.lever.co/v0/postings/${token}?mode=json`,
  }
  const endpoint = endpoints[provider.atsPlatform]
  if (!endpoint) throw new Error('Unsupported public ATS capture platform')
  const evidence = []
  return { evidence, async fetchJson(url, { signal } = {}) {
    if (url !== endpoint) throw new Error('Audit capture endpoint is not the configured public inventory')
    if (evidence.length >= 10) throw new Error('Audit capture request limit exceeded')
    const stem = `public-ats-response-${String(evidence.length + 1).padStart(3, '0')}`
    const receipt = { source: provider.source, url, method: 'GET', requestedAt: new Date().toISOString(),
      status: null, body: `${stem}.body`, receipt: `${stem}.json`, bodyComplete: false,
      verifiedZeroInventory: false }
    const chunks = []
    let bytes = 0
    try {
      const timeout = AbortSignal.timeout(30000)
      const response = await fetchImpl(url, { method: 'GET', redirect: 'error', signal: signal ? AbortSignal.any([signal, timeout]) : timeout })
      receipt.status = response.status
      receipt.contentType = response.headers.get('content-type')
      const reader = response.body?.getReader()
      if (!reader) throw new Error('Public ATS response body unavailable')
      try {
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          const chunk = Buffer.from(value)
          const available = maxBytes - bytes
          if (chunk.length > available) {
            if (available > 0) { chunks.push(chunk.subarray(0, available)); bytes += available }
            await reader.cancel()
            throw new Error('Public ATS response exceeded capture byte limit')
          }
          chunks.push(chunk)
          bytes += chunk.length
        }
      } finally { reader.releaseLock() }
      receipt.bodyComplete = true
      if (!response.ok) throw new Error(`Public ATS inventory HTTP ${response.status}`)
      const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      receipt.jsonParsed = true
      return payload
    } catch (error) {
      receipt.failure = { name: String(error?.name || 'Error').slice(0, 80), message: String(error?.message || 'Capture failed').slice(0, 240) }
      throw error
    } finally {
      receipt.completedAt = new Date().toISOString()
      const body = Buffer.concat(chunks)
      receipt.bodyBytes = body.length
      receipt.bodySHA256 = createHash('sha256').update(body).digest('hex')
      fs.mkdirSync(outputDirectory, { recursive: true })
      fs.writeFileSync(path.join(outputDirectory, receipt.body), body)
      fs.writeFileSync(path.join(outputDirectory, receipt.receipt), JSON.stringify(receipt, null, 2) + '\n')
      evidence.push(receipt)
    }
  } }
}
