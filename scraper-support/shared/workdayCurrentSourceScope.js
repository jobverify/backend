import { createHash } from 'node:crypto'
import { readNativeDocument } from '../utils/activeNativeHtml.js'
import { hashWorkdayProof, workdayInventoryIdentity } from '../myworkday/countryInventoryProof.js'

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const requireProof = (value, reason) => { if (!value) throw new Error(`Current Workday raw scope: ${reason}`) }
const ordered = object => Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)))

// This is a change detector for reviewed executable/form surfaces. It does not
// execute scripts, interpret website instructions, or discover another board.
export function workdayCorporateExecutableSignature(html, { normalizeScript = node => node.raw || '' } = {}) {
  const document = readNativeDocument(html)
  return hash({
    scripts: document.nodes(node => node.tag === 'script').map(node => ({ attrs: ordered(node.attrs), body: normalizeScript(node) })),
    activeAttributes: document.nodes(node => Object.keys(node.attrs).length > 0).map(node => ({ tag: node.tag, attrs: ordered(node.attrs) })),
    forms: document.nodes(node => node.tag === 'form').map(node => ({ attrs: ordered(node.attrs), text: document.text(node),
      controls: (() => {
        const rows = []
        const visit = item => {
          if (!item || typeof item === 'string' || item.inert) return
          if (['input', 'button', 'select', 'textarea'].includes(item.tag)) rows.push({ tag: item.tag, attrs: ordered(item.attrs), raw: item.raw || '' })
          for (const child of item.children || []) visit(child)
        }
        visit(node)
        return rows
      })() })),
    handlers: document.nodes(node => Object.keys(node.attrs).some(key => /^on/i.test(key)))
      .map(node => ({ tag: node.tag, handlers: ordered(Object.fromEntries(Object.entries(node.attrs).filter(([key]) => /^on/i.test(key)))) })),
  })
}

// Supplement the existing native engine: inspect every raw role, including
// foreign rows the engine may exclude before detail enrichment. Unknown fields
// retain uncertainty; they never change native country values or job output.
export async function auditCurrentWorkdayRawScope({ apiUrl, boardUrl, schema, signal, requestTimeoutMs = 20000 }) {
  const api = new URL(apiUrl), board = new URL(boardUrl), rows = [], details = [], reasons = new Set(), seen = new Set()
  requireProof(api.origin === board.origin && /\/wday\/cxs\/[^/]+\/[^/]+\/jobs$/.test(api.pathname), 'invalid explicit board API')
  const request = async (url, init = {}) => {
    signal?.throwIfAborted()
    const deadline = signal ? AbortSignal.any([signal, AbortSignal.timeout(requestTimeoutMs)]) : AbortSignal.timeout(requestTimeoutMs)
    const response = await fetch(url, { ...init, redirect: 'error', signal: deadline,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)' } })
    requireProof(response.status === 200 && response.url === url, 'native HTTP status or observed response URL mismatch')
    const payload = await response.json()
    deadline.throwIfAborted()
    requireProof(payload && typeof payload === 'object' && !Array.isArray(payload), 'native payload unavailable')
    requireProof(!Object.keys(payload).some(key => /^(?:error|errors|errorCode|exception|fault)$/i.test(key))
      && payload.success !== false && (payload.httpStatus == null || payload.httpStatus === 200), 'native failure envelope')
    return payload
  }
  const fields = (value, allowed, id, context) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).some(key => !allowed.includes(key))) reasons.add(`unreviewed-${context}-schema:${id}`)
  }
  const nestedFields = (value, path, id) => {
    if (Array.isArray(value)) { for (const row of value) nestedFields(row, `${path}[]`, id); return }
    if (!value || typeof value !== 'object') return
    const reviewed = schema.detailNestedFields?.[path]
    if (!reviewed || Object.keys(value).some(key => !reviewed.includes(key))) reasons.add(`unreviewed-detail-nested-schema:${id}:${path}`)
    for (const [key, field] of Object.entries(value)) nestedFields(field, `${path}.${key}`, id)
  }
  let total
  for (let page = 0; ; page++) {
    requireProof(page < 500, 'raw inventory safety bound reached; coverage remains unverified')
    const payload = await request(apiUrl, { method: 'POST', body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: rows.length, searchText: '' }) })
    fields(payload, schema.listingPayloadFields, 'board', 'listing-envelope')
    requireProof(Number.isSafeInteger(payload.total) && payload.total >= 0 && Array.isArray(payload.jobPostings), 'invalid native total or postings')
    if (total == null) total = payload.total
    requireProof(payload.total === total && payload.jobPostings.length === Math.min(20, total - rows.length), 'native pagination or total changed')
    for (const row of payload.jobPostings) {
      requireProof(row && typeof row.title === 'string' && row.title.trim() && typeof row.externalPath === 'string'
        && /^\/job\/[^?#]+$/.test(row.externalPath) && !seen.has(row.externalPath), 'missing or duplicate raw role identity')
      seen.add(row.externalPath)
      fields(row, schema.listingFields, row.externalPath, 'listing-role')
      if (typeof row.locationsText !== 'string' || row.bulletFields != null && (!Array.isArray(row.bulletFields)
        || row.bulletFields.some(value => typeof value !== 'string'))) reasons.add(`unreviewed-listing-location-shape:${row.externalPath}`)
      rows.push(row)
    }
    if (rows.length === total) break
  }
  for (const row of rows) {
    const detailUrl = api.origin + api.pathname.replace(/\/jobs$/, '') + row.externalPath
    const payload = await request(detailUrl), info = payload.jobPostingInfo
    fields(payload, schema.detailPayloadFields, row.externalPath, 'detail-envelope')
    requireProof(info && typeof info === 'object' && !Array.isArray(info), 'native detail missing')
    const expectedUrl = new URL(board.pathname.replace(/\/$/, '') + row.externalPath, board.origin)
    let actualUrl
    try { actualUrl = new URL(info.externalUrl) } catch { /* Invalid native identity is rejected below. */ }
    requireProof(actualUrl && actualUrl.origin === expectedUrl.origin
      && actualUrl.pathname.replace(/^\/[a-z]{2}-[A-Z]{2}\//, '/') === expectedUrl.pathname
      && !actualUrl.search && !actualUrl.hash && info.title === row.title, 'native detail identity or title mismatch')
    fields(info, schema.detailFields, row.externalPath, 'detail-role')
    nestedFields(info, '$', row.externalPath)
    fields(info.country, ['descriptor', 'id', 'alpha2Code'], row.externalPath, 'detail-country')
    fields(info.jobRequisitionLocation, ['descriptor', 'country'], row.externalPath, 'detail-worksite')
    fields(info.jobRequisitionLocation?.country, ['descriptor', 'id', 'alpha2Code'], row.externalPath, 'detail-worksite-country')
    if (typeof info.location !== 'string' || typeof info.jobRequisitionLocation?.descriptor !== 'string') reasons.add(`unreviewed-detail-location-shape:${row.externalPath}`)
    details.push({ externalPath: row.externalPath, info, hiringOrganization: payload.hiringOrganization })
  }
  signal?.throwIfAborted()
  const roleSnapshots = details.map(row => ({ ...row, jobId: row.info.jobReqId,
    listing: rows.find(listing => listing.externalPath === row.externalPath) }))
  const globalSchemaUnreviewed = [...reasons].some(reason => reason.endsWith(':board'))
  const unreviewedRoles = roleSnapshots.filter(row => globalSchemaUnreviewed || [...reasons].some(reason => reason.includes(`:${row.externalPath}`)))
  return { total, listingSignature: hash(rows), detailSignature: hash(details),
    nativeIdentitySignature: hashWorkdayProof(JSON.stringify(rows.map(workdayInventoryIdentity).sort())),
    reasons: [...reasons], rolePaths: rows.map(row => row.externalPath),
    roleIds: details.map(row => row.info.jobReqId), unknownSchemaRecords: [...reasons], roleSnapshots, unreviewedRoles }
}

export function reconcileCurrentWorkdayRoleDetail(job, opening, closing) {
  const original = opening.roleSnapshots.find(row => row.jobId === job.requisitionId)
  const final = closing.roleSnapshots.find(row => row.jobId === job.requisitionId)
  const unknownSchema = [...opening.unreviewedRoles, ...closing.unreviewedRoles].some(row => row.jobId === job.requisitionId)
  const complete = !unknownSchema && original && final && hash(original) === hash(final)
    && job.sourceDescription === original.info.jobDescription && job.sourceDescription === final.info.jobDescription
  return { ...job, sourceDetailComplete: job.sourceDetailComplete === true && Boolean(complete),
    ...(!complete ? { sourceDetailStatus: 'unreviewed-native-schema-or-unreconciled-closing-criteria',
      sourceUnreviewedNativeRole: { opening: original || null, closing: final || null } } : {}) }
}
