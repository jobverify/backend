import { createHash } from 'node:crypto'
import { hashWorkdayProof, workdayInventoryIdentity } from '../../scraper-support/myworkday/countryInventoryProof.js'
import { workdayRequestScheduler } from '../../scraper-support/myworkday/requestScheduler.js'
import { parseRetryAfterHeader } from '../../scraper-support/utils/fetch.js'

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const requireNative = (condition, reason) => { if (!condition) throw new Error(`Solera native raw inventory: ${reason}`) }

export async function auditSoleraRawScope({ apiUrl, boardUrl, schema, signal, requestTimeoutMs = 25000, requestScheduler = workdayRequestScheduler }) {
  const api = new URL(apiUrl), board = new URL(boardUrl), rows = [], details = [], reasons = new Set(), seen = new Set(), pageTotals = [], listingRoleReasons = new Map()
  requireNative(api.origin === board.origin && api.pathname === '/wday/cxs/solera/Global_Career_Site/jobs', 'unexpected explicit native API')
  const request = async (url, init = {}) => {
    signal?.throwIfAborted()
    const release = await requestScheduler.acquire(url, { signal, kind: init.method === 'POST' ? 'listing' : 'detail' })
    try {
    const deadline = signal ? AbortSignal.any([signal, AbortSignal.timeout(requestTimeoutMs)]) : AbortSignal.timeout(requestTimeoutMs)
    const response = await fetch(url, { ...init, redirect: 'error', signal: deadline,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)' } })
    if (response.status === 429) requestScheduler.recordRateLimit(url, parseRetryAfterHeader(response.headers.get('retry-after')) ?? 5000)
    requireNative(response.status === 200 && response.url === url, 'native HTTP status or response URL mismatch')
    const payload = await response.json()
    deadline.throwIfAborted()
    requireNative(payload && typeof payload === 'object' && !Array.isArray(payload), 'native payload unavailable')
    requireNative(!Object.keys(payload).some(key => /^(?:error|errors|errorCode|exception|fault)$/i.test(key))
      && payload.success !== false && (payload.httpStatus == null || payload.httpStatus === 200), 'native failure envelope')
    return payload
    } finally { release() }
  }
  const fields = (value, allowed, id, context, roleReasons) => {
    if (!value || typeof value !== 'object' || Array.isArray(value) || !Array.isArray(allowed)
      || Object.keys(value).some(key => !allowed.includes(key))) {
      const reason = `unreviewed-${context}-schema:${id}`
      reasons.add(reason)
      roleReasons?.push(reason)
    }
  }
  const nested = (value, path, id, roleReasons) => {
    if (Array.isArray(value)) { for (const item of value) nested(item, path + '[]', id, roleReasons); return }
    if (!value || typeof value !== 'object') return
    fields(value, schema.detailNestedFields[path], id, 'detail-nested', roleReasons)
    for (const [key, item] of Object.entries(value)) nested(item, path + '.' + key, id, roleReasons)
  }
  let total
  for (let page = 0; ; page++) {
    requireNative(page < 500, 'inventory safety bound reached; complete scope unavailable')
    const offset = rows.length
    const payload = await request(apiUrl, { method: 'POST', body: JSON.stringify({ appliedFacets: {}, limit: 20, offset, searchText: '' }) })
    fields(payload, schema.listingPayloadFields, 'board', 'listing-envelope')
    requireNative(Number.isSafeInteger(payload.total) && payload.total >= 0 && Array.isArray(payload.jobPostings), 'invalid native total or postings')
    if (total == null) total = payload.total
    // This board emits the observed total:0 placeholder on noninitial pages.
    // It never changes the authoritative opening total or required row count.
    requireNative(payload.total === total || offset > 0 && payload.total === 0, 'native positive total changed')
    requireNative(payload.jobPostings.length === Math.min(20, total - offset), 'short, excessive or incomplete native page')
    pageTotals.push({ offset, reportedTotal: payload.total, rows: payload.jobPostings.length })
    for (const row of payload.jobPostings) {
      requireNative(row && typeof row.title === 'string' && row.title.trim() && typeof row.externalPath === 'string'
        && /^\/job\/[^?#]+$/.test(row.externalPath) && !seen.has(row.externalPath), 'missing or duplicate raw role identity')
      seen.add(row.externalPath)
      const roleReasons = []
      fields(row, schema.listingFields, row.externalPath, 'listing-role', roleReasons)
      if (typeof row.locationsText !== 'string' || !Array.isArray(row.bulletFields)
        || row.bulletFields.some(value => typeof value !== 'string')) {
        const reason = `unreviewed-listing-location-shape:${row.externalPath}`
        reasons.add(reason); roleReasons.push(reason)
      }
      listingRoleReasons.set(row.externalPath, roleReasons)
      rows.push(row)
    }
    if (rows.length === total) break
  }
  let next = 0
  await Promise.all(Array.from({ length: Math.min(8, rows.length) }, async () => {
    while (next < rows.length) {
      const index = next++, row = rows[index], detailUrl = api.origin + api.pathname.replace(/\/jobs$/, '') + row.externalPath
      const payload = await request(detailUrl), info = payload.jobPostingInfo
      const roleReasons = [...listingRoleReasons.get(row.externalPath)]
      fields(payload, schema.detailPayloadFields, row.externalPath, 'detail-envelope', roleReasons)
      requireNative(info && typeof info === 'object' && !Array.isArray(info), 'missing native detail')
      const expected = new URL(board.href.replace(/\/$/, '') + row.externalPath), actual = new URL(info.externalUrl)
      requireNative(actual.origin === expected.origin && actual.pathname.replace(/^\/[a-z]{2}-[A-Z]{2}\//, '/') === expected.pathname
        && !actual.search && !actual.hash && !actual.username && !actual.password && info.title === row.title
        && info.jobPostingSiteId === 'Global_Career_Site' && row.bulletFields.includes(info.jobReqId), 'native detail identity or title mismatch')
      fields(info, schema.detailFields, row.externalPath, 'detail-role', roleReasons)
      nested(info, '$', row.externalPath, roleReasons)
      if (typeof info.location !== 'string' || typeof info.jobRequisitionLocation?.descriptor !== 'string') {
        const reason = `unreviewed-detail-location-shape:${row.externalPath}`
        reasons.add(reason); roleReasons.push(reason)
      }
      if (info.additionalLocations != null) {
        if (!Array.isArray(info.additionalLocations) || info.additionalLocations.some(value => typeof value !== 'string')) {
          const reason = `unreviewed-secondary-location-shape:${info.jobReqId}`
          reasons.add(reason); roleReasons.push(reason)
        }
        if (info.additionalLocations.length) {
          const reason = `unresolved-secondary-location-country:${info.jobReqId}`
          reasons.add(reason); roleReasons.push(reason)
        }
      }
      details[index] = { externalPath: row.externalPath, payload, roleReasons: [...new Set(roleReasons)].sort(),
        nativeDetailSignature: hash({ info, hiringOrganization: payload.hiringOrganization }) }
    }
  }))
  signal?.throwIfAborted()
  const globalRoleReasons = [...reasons].filter(reason => reason.endsWith(':board'))
  if (globalRoleReasons.length) for (const detail of details) detail.roleReasons = [...new Set([...detail.roleReasons, ...globalRoleReasons])].sort()
  return { total, listingSignature: hash(rows), detailSignature: hash(details),
    nativeIdentitySignature: hashWorkdayProof(JSON.stringify(rows.map(workdayInventoryIdentity).sort())),
    pageTotals, reasons: [...reasons].sort(), rolePaths: rows.map(row => row.externalPath),
    roleIds: details.map(row => row.payload.jobPostingInfo.jobReqId), listingRecords: rows, rawDetails: details }
}
