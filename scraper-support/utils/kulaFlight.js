const REFERENCE = /^\$([0-9a-f]+)$/i
const FRAME_PREFIX = 'self.__next_f.push('
const MAX_FLIGHT_BYTES = 10 * 1024 * 1024

export class KulaFlightContractError extends Error {
  constructor(message) {
    super(`Kula Flight content: ${message}`)
    this.name = 'KulaFlightContractError'
    this.abortRetries = true
    this.failureKind = 'parser_or_contract_error'
  }
}

const fail = message => { throw new KulaFlightContractError(message) }

const readFlightRecords = html => {
  const chunks = []
  for (const match of String(html ?? '').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const script = match[1].trim()
    if (!script.startsWith(FRAME_PREFIX)) continue
    const call = script.match(/^self\.__next_f\.push\(([\s\S]*)\);?$/)
    if (!call) fail('malformed data frame')
    let value
    try { value = JSON.parse(call[1]) } catch { fail('data frame must contain a JSON literal') }
    if (!Array.isArray(value)) fail('data frame is not an array')
    if (value[0] !== 1) continue
    if (value.length !== 2 || typeof value[1] !== 'string') fail('text data frame is malformed')
    chunks.push(value[1])
  }
  if (!chunks.length) return null
  // Length-prefixed text can span frames. React counts UTF8 bytes, including
  // multibyte punctuation, rather than JavaScript UTF16 string positions.
  const bytes = Buffer.from(chunks.join(''), 'utf8')
  if (bytes.length > MAX_FLIGHT_BYTES) fail('data exceeds the bounded parser size')
  const records = new Map()
  const decode = value => {
    try { return new TextDecoder('utf8', { fatal: true }).decode(value) }
    catch { fail('text record has an invalid UTF8 boundary') }
  }
  const add = (id, record) => {
    const existing = records.get(id)
    if (existing && (existing.kind !== record.kind || existing.raw !== record.raw)) fail(`conflicting record ${id}`)
    records.set(id, record)
  }
  let offset = 0
  while (offset < bytes.length) {
    if (bytes[offset] === 10) { offset += 1; continue }
    const colon = bytes.indexOf(58, offset)
    if (colon < 0) fail('record header is incomplete')
    const id = decode(bytes.subarray(offset, colon))
    offset = colon + 1
    if (!/^[0-9a-f]+$/i.test(id) && id !== '') fail('record identity is malformed')
    if (bytes[offset] === 84) {
      if (!id) fail('text record identity is missing')
      const comma = bytes.indexOf(44, offset)
      const hex = comma < 0 ? '' : decode(bytes.subarray(offset + 1, comma))
      if (!/^[0-9a-f]+$/i.test(hex)) fail('text record byte length is malformed')
      const length = Number.parseInt(hex, 16)
      const start = comma + 1
      if (!Number.isSafeInteger(length) || length < 0 || length > bytes.length - start) fail('text record is truncated')
      const text = decode(bytes.subarray(start, start + length))
      add(id, { kind: 'text', value: text, raw: text })
      offset = start + length
      continue
    }
    const newline = bytes.indexOf(10, offset)
    const end = newline < 0 ? bytes.length : newline
    const raw = decode(bytes.subarray(offset, end))
    // Unnumbered rows are resource hints, never job description targets.
    if (id) {
      let value
      if (/^[\[{"]/.test(raw)) {
        try { value = JSON.parse(raw) } catch { fail(`model record ${id} is malformed`) }
      }
      add(id, { kind: 'model', value, raw })
    }
    offset = end + 1
  }
  return records
}

// Expose the same literal-only decoder for non-Kula pages using React Flight.
// This does not select, transform or manufacture any account or job records.
export { readFlightRecords as readLiteralFlightRecords }

export const extractKulaNativeJobs = (html, { accountName } = {}) => {
  if (typeof accountName !== 'string' || !accountName.trim()) fail('expected account name is required')
  const records = readFlightRecords(html)
  if (!records) fail('native Flight model is unavailable')
  const scopes = []
  const walk = value => {
    if (!value || typeof value !== 'object') return
    if (Object.hasOwn(value, 'jobs') && Object.hasOwn(value, 'departments')) {
      if (value.accountName !== accountName || !Array.isArray(value.jobs)
        || !Array.isArray(value.departments) || !Array.isArray(value.locations)) fail('native job model account or shape mismatch')
      scopes.push(value)
    }
    for (const child of Object.values(value)) walk(child)
  }
  for (const record of records.values()) if (record.kind === 'model') walk(record.value)
  if (!scopes.length) fail('account-scoped native job model is unavailable')
  const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)
  if (new Set(scopes.map(canonical)).size !== 1) fail('conflicting native job models')
  const jobs = scopes[0].jobs
  const seen = new Set()
  for (const job of jobs) {
    const id = ['string', 'number'].includes(typeof job?.id) ? String(job.id).trim() : ''
    if (!id || seen.has(id)) fail('missing or duplicate native job identity')
    seen.add(id)
  }
  return jobs
}

// Resolve only the employer description field. Native identity, offices,
// publication flags and each source's existing India filters stay untouched.
export const resolveKulaJobDescriptions = (html, jobs) => {
  const records = readFlightRecords(html)
  if (!records) return jobs
  const resolve = (reference, seen = new Set()) => {
    const match = reference.match(REFERENCE)
    if (!match) return reference
    const id = match[1]
    if (seen.has(id)) fail(`cyclic description reference ${id}`)
    seen.add(id)
    const record = records.get(id)
    if (!record) fail(`unknown description reference ${id}`)
    if (typeof record.value !== 'string') fail(`description reference ${id} is not text`)
    if (record.kind === 'model' && record.value.startsWith('$') && !REFERENCE.test(record.value)) fail(`description reference ${id} is a control token`)
    return record.kind === 'text' ? record.value : resolve(record.value, seen)
  }
  return jobs.map(job => {
    const value = job?.ats_job?.job_description
    if (typeof value !== 'string' || !REFERENCE.test(value)) return job
    return { ...job, ats_job: { ...job.ats_job, job_description: resolve(value) } }
  })
}
