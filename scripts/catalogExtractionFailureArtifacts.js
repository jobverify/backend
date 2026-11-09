import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024
const MAX_BATCH_BYTES = 64 * 1024 * 1024
const MAX_RESPONSES = 512
const field = (value, key) => {
  if (!value || typeof value !== 'object') return undefined
  try { return Object.getOwnPropertyDescriptor(value, key)?.value } catch { return undefined }
}
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const date = value => typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value)) ? value : null
const HEADER_NAMES = ['content-type', 'content-encoding', 'date', 'last-modified', 'server']

// Raw public responses belong in the isolated audit directory. The worker row
// carries only this artifact reference; diagnostic summaries remain bounded.
export function retainNativeFailureArtifact(error, { outputDirectory, source, attemptedAt, completedAt } = {}) {
  const native = field(error, 'nativeEvidence'), responses = field(native, 'retainedResponses')
  let length
  try {
    if (!outputDirectory || !Array.isArray(responses)) return null
    length = field(responses, 'length')
    if (!Number.isSafeInteger(length) || length < 1) return null
  } catch { return null }
  const retained = [], rejected = []
  let totalBytes = 0
  for (let index = 0; index < Math.min(length, MAX_RESPONSES); index++) {
    const response = field(responses, String(index))
    try {
      const urlText = field(response, 'url'), status = field(response, 'status'), encoded = field(response, 'rawBodyBase64')
      if (typeof urlText !== 'string' || urlText.length > 8192) throw Error('invalid-response-url')
      const url = new URL(urlText)
      if (url.href !== urlText || url.protocol !== 'https:' || url.username || url.password || url.hash) throw Error('invalid-response-url')
      if (!Number.isInteger(status) || status < 100 || status > 599) throw Error('invalid-response-status')
      if (typeof encoded !== 'string' || encoded.length > 4 * Math.ceil(MAX_RESPONSE_BYTES / 3)) throw Error('response-body-unavailable-or-oversized')
      const body = Buffer.from(encoded, 'base64')
      if (body.length > MAX_RESPONSE_BYTES || body.toString('base64') !== encoded || field(response, 'bodyBytes') !== body.length || field(response, 'bodySHA256') !== sha(body)) throw Error('response-body-integrity-mismatch')
      if (totalBytes + body.length > MAX_BATCH_BYTES) throw Error('aggregate-response-body-limit')
      const originalHeaders = field(response, 'headers'), headers = {}
      for (const name of HEADER_NAMES) {
        const value = field(originalHeaders, name)
        if (typeof value === 'string' && value.length <= 4096) headers[name] = value
      }
      retained.push({ url: urlText, status, headers, headerStorage: 'selected diagnostic headers only; cookies and authorization omitted',
        bodyBytes: body.length, bodySHA256: sha(body), rawBodyBase64: encoded,
        bodyRepresentation: 'Original scraper-retained decoded response bytes; completeness is not independently established by this artifact.',
        requestedAt: date(field(response, 'requestedAt')), completedAt: date(field(response, 'completedAt')) })
      totalBytes += body.length
    } catch (error) {
      rejected.push({ responseIndex: index, reason: error.message })
    }
  }
  const document = { source: typeof source === 'string' ? source : null, attemptedAt: date(attemptedAt), completedAt: date(completedAt),
    mode: 'isolated-native-failure-response-evidence', observedResponseEntries: length,
    retainedResponses: retained, rejectedResponses: rejected, responseScanTruncated: length > MAX_RESPONSES,
    retainedBodyBytes: totalBytes, qualifiedJobCounts: null, inventoryComplete: false, verifiedZeroInventory: false, cleanupAllowed: false }
  try {
    if (!path.isAbsolute(outputDirectory)) throw Error('absolute-output-directory-required')
    const filename = 'native-failure-evidence.json', bytes = Buffer.from(JSON.stringify(document, null, 2) + '\n')
    fs.writeFileSync(path.join(outputDirectory, filename), bytes, { flag: 'wx' })
    return { filename, sha256: sha(bytes), retainedResponses: retained.length, rejectedResponses: rejected.length,
      responseScanTruncated: document.responseScanTruncated, retainedBodyBytes: totalBytes }
  } catch (error) {
    return { filename: null, sha256: null, retentionFailure: error.code === 'EEXIST' ? 'existing-artifact-preserved' : 'artifact-write-failed' }
  }
}
