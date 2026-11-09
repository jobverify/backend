import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

const MAX_BYTES = 10 * 1024 * 1024
const REFERENCE = /^\$([0-9a-f]+)$/i
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

export class GojekCoverageGapError extends Error {
  constructor(message) {
    super('[gojek] ' + message)
    this.name = 'GojekCoverageGapError'
    this.code = 'GOJEK_COVERAGE_GAP'
    this.abortRetries = true
    this.failureKind = 'parser_or_contract_error'
  }
}

const requireData = (condition, message) => {
  if (!condition) throw new GojekCoverageGapError(message)
}
const walkNodes = node => [node, ...(node.children || []).filter(child => typeof child !== 'string').flatMap(walkNodes)]
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const decode = bytes => {
  try { return new TextDecoder('utf8', { fatal: true }).decode(bytes) }
  catch { throw new GojekCoverageGapError('Invalid UTF8 boundary in serialized data') }
}

// This page repeats opaque control frame IDs. Keep every occurrence, and never
// select an ambiguous frame as a role/criteria target. No shared decoder policy
// is weakened and no JavaScript, module hint or renderer is executed.
const readDeclaredFrames = scripts => {
  const chunks = []
  for (const script of scripts) {
    const body = (script.raw || '').trim()
    if (!body.includes('self.__next_f.push(')) continue
    const match = body.match(/^self\.__next_f\.push\(([\s\S]*)\);?$/)
    requireData(match, 'Unreviewed executable text surrounding serialized data')
    let value
    try { value = JSON.parse(match[1]) }
    catch { throw new GojekCoverageGapError('Serialized carrier is not a JSON literal') }
    requireData(Array.isArray(value), 'Serialized carrier is not an array')
    if (value.length === 1 && value[0] === 0) continue
    requireData(value.length === 2 && value[0] === 1 && typeof value[1] === 'string', 'Unreviewed serialized carrier contract')
    chunks.push(value[1])
  }
  requireData(chunks.length > 0, 'Declared serialized data is unavailable')
  const bytes = Buffer.from(chunks.join(''), 'utf8')
  requireData(bytes.length <= MAX_BYTES, 'Serialized data exceeds the bounded reader size')
  const occurrences = [], byId = new Map()
  let offset = 0
  while (offset < bytes.length) {
    if (bytes[offset] === 10) { offset++; continue }
    const colon = bytes.indexOf(58, offset)
    requireData(colon >= 0, 'Incomplete serialized frame header')
    const id = decode(bytes.subarray(offset, colon))
    requireData(id === '' || /^[0-9a-f]+$/i.test(id), 'Invalid serialized frame identity')
    offset = colon + 1
    let frame
    if (bytes[offset] === 84) {
      const comma = bytes.indexOf(44, offset)
      const lengthText = comma < 0 ? '' : decode(bytes.subarray(offset + 1, comma))
      requireData(id && /^[0-9a-f]+$/i.test(lengthText), 'Invalid serialized text length')
      const length = Number.parseInt(lengthText, 16), start = comma + 1
      requireData(Number.isSafeInteger(length) && length <= bytes.length - start, 'Truncated serialized text')
      const raw = decode(bytes.subarray(start, start + length))
      frame = { id, kind: 'text', raw, value: raw }
      offset = start + length
    } else {
      const newline = bytes.indexOf(10, offset), end = newline < 0 ? bytes.length : newline
      const raw = decode(bytes.subarray(offset, end))
      let value, kind = 'opaque'
      try { value = JSON.parse(raw); kind = 'model' }
      catch { requireData(!/^[\[{\"]/.test(raw), 'Malformed serialized model') }
      frame = { id, kind, raw, ...(kind === 'model' ? { value } : {}) }
      offset = end + 1
    }
    frame.occurrenceIndex = occurrences.length
    occurrences.push(frame)
    if (id) byId.set(id, [...(byId.get(id) || []), frame])
  }
  const ambiguous = new Set([...byId].filter(([, frames]) => new Set(frames.map(frame => frame.kind + ':' + frame.raw)).size > 1).map(([id]) => id))
  return { occurrences, byId, ambiguous }
}

const resolveRecord = (record, frames) => {
  const issues = []
  const resolve = (value, path = '', seen = new Set(), depth = 0) => {
    requireData(depth < 128, 'Serialized reference nesting exceeds the reader limit')
    if (typeof value === 'string' && value.startsWith('$')) {
      const match = value.match(REFERENCE)
      if (!match) { issues.push({ code: 'unreviewed-control-token', path, reference: value }); return value }
      const id = match[1], targets = frames.byId.get(id)
      let code = null
      if (seen.has(id)) code = 'cyclic-reference'
      else if (!targets) code = 'missing-frame'
      else if (frames.ambiguous.has(id)) code = 'ambiguous-frame'
      else if (!['text', 'model'].includes(targets[0].kind)) code = 'opaque-frame'
      if (code) { issues.push({ code, path, reference: value }); return value }
      const target = targets[0]
      // Text frame contents are terminal raw employer text, even if they begin
      // with a dollar sign. Model strings can be another explicit reference.
      return target.kind === 'text' ? target.value : resolve(target.value, path, new Set([...seen, id]), depth + 1)
    }
    if (Array.isArray(value)) return value.map((child, index) => resolve(child, path + '/' + index, seen, depth + 1))
    if (plain(value)) return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, resolve(child, path + '/' + key, seen, depth + 1)]))
    return value
  }
  return { value: resolve(record), issues }
}

const identityIssues = row => {
  const issues = []
  if (typeof row.id !== 'string' || !UUID.test(row.id)) issues.push('unreviewed-native-id')
  for (const [key, suffix] of [['hostedUrl', ''], ['applyUrl', '/apply']]) {
    if (typeof row[key] !== 'string' || row[key] !== `https://jobs.lever.co/GoToGroup/${row.id}${suffix}`) issues.push('unreviewed-native-' + key)
  }
  return issues
}

export const inspectGojekCareersPage = html => {
  requireData(typeof html === 'string' && Buffer.byteLength(html, 'utf8') <= MAX_BYTES, 'Careers document is unavailable or too large')
  const document = readNativeDocument(html)
  const root = document.nodes(node => node.tag === 'root')[0]
  const nodes = walkNodes(root)
  const scripts = nodes.filter(node => node.tag === 'script')
  const frames = readDeclaredFrames(scripts)
  const observations = []
  const visit = (value, frame, modelPath = '', depth = 0) => {
    requireData(depth < 128, 'Serialized model nesting exceeds the reader limit')
    if (plain(value)) {
      if ((Object.hasOwn(value, 'applyUrl') || Object.hasOwn(value, 'hostedUrl'))
        && (Object.hasOwn(value, 'id') || Object.hasOwn(value, 'text'))) {
        const resolved = resolveRecord(value, frames)
        observations.push({
          observationIndex: observations.length, // Audit position, never a new job ID.
          frameId: frame.id, frameOccurrenceIndex: frame.occurrenceIndex, modelPath,
          nativeId: value.id ?? null, title: value.text ?? null,
          rawNativeRecord: structuredClone(value), resolvedNativeRecord: resolved.value,
          referenceIssues: resolved.issues, identityIssues: identityIssues(value),
          declaredCountry: value.country ?? null, country: null,
          sourcePublisher: 'Gojek', legalHiringEmployer: null,
          sourceNativeCreatedAt: value.createdAt ?? null, postingDate: null, closingDate: null,
          status: 'unresolved', sourceIdentityVerified: false, sourceVisibilityVerified: false,
          sourceDetailComplete: false, sourceScopeComplete: false, sourceListingComplete: false,
          lifecycleCleanupAllowed: false,
        })
      }
      for (const [key, child] of Object.entries(value)) visit(child, frame, modelPath + '/' + key, depth + 1)
    } else if (Array.isArray(value)) {
      value.forEach((child, index) => visit(child, frame, modelPath + '/' + index, depth + 1))
    }
  }
  for (const frame of frames.occurrences) if (frame.kind === 'model') visit(frame.value, frame)
  const titles = nodes.filter(node => node.tag === 'head').flatMap(head => head.children.filter(node => typeof node !== 'string' && node.tag === 'title')).map(node => node.raw || '')
  return {
    source: 'gojek', originalCareersHTML: html, observations,
    literalFrameOccurrences: frames.occurrences,
    ambiguousFrameIds: [...frames.ambiguous],
    declaredRoleAnchors: nodes.filter(node => node.tag === 'a' && /^\/careers\/view\//.test(node.attrs.href || '')).map(node => ({ href: node.attrs.href, attrs: node.attrs, declaredNode: node })),
    declaredResources: scripts.map(node => ({ attrs: node.attrs, inert: Boolean(node.inert) })),
    expectedPageTitleObserved: titles.includes('Gojek Careers | Check out the current job openings at Gojek Tech'),
    sourceScopeComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false,
    authoritativeSourceTotal: null, authoritativeIndiaFacetCount: null,
    currentLiveQualification: false, noClosingProof: true,
    reasons: ['Corporate serialized records are declared observations, not current native detail or rendering proof',
      'GoToGroup tenant does not establish the legal employer or complete Gojek hiring scope',
      'Role country alternatives, all advertised channels, pagination and a closing cohort remain unqualified'],
  }
}
