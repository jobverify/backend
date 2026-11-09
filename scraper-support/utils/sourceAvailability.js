import { createHash } from 'node:crypto'
import { decodeHTML } from 'entities'
import { extractActiveDescription } from './activeNativeHtml.js'
import { readVisibleNativeDocument, readNativeStatusLayout } from './visibleNativeHtml.js'

const PROVENANCE = 'source-validated-native-role-availability-v1'
const CONFIG = {
  enphaseenergy: { brand: 'Enphase Energy', employers: ['Enphase Energy'] },
  disney: { brand: 'Disney', employers: ['Disney (India) Private Limited', 'Lucasfilm Visual Effects (India) Private Limited', 'Disney HR Strategies & Services, LLC'] },
  datahub: { brand: 'DataHub', employers: ['DataHub'] },
}
const norm = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const need = (ok, message) => { if (!ok) throw Error('Native source availability: ' + message) }
const hash = value => createHash('sha256').update(value).digest('hex')
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
export const supportsNativeRoleAvailability = source => Object.hasOwn(CONFIG, source)

// A role-specific declarative notice is different from instructions about what
// to do if a vacancy closes. Callers supply only the already-bound role scope.
export function findExplicitNativeClosure(blocks) {
  const role = String.raw`(?:this|the)\s+(?:job|role|position|vacancy)`
  const accepting = String.raw`(?:not|no longer)\s+accepting applications`
  const stopped = String.raw`(?:closed|filled|expired|removed|no longer (?:available|open|active)|not available)`
  // A leading declaration can carry a reason or further instructions. Its
  // immediate qualifier must not turn it into conditional process copy.
  const closed = new RegExp(String.raw`^(?:${role}\s+(?:(?:is|has been|has)\s+)?(?:${stopped}|${accepting})(?:\s+for applications)?|(?:we are\s+)?${accepting}(?:\s+for\s+${role})?|applications\s+(?:are\s+|have been\s+)?closed(?:\s+for\s+${role})?)(?=$|[\s.!?,;:\u2013\u2014-])`, 'i')
  for (const block of Array.isArray(blocks) ? blocks : [blocks]) {
    for (const statement of norm(block).replace(/^Job Summary:\s*/i, '').split(/(?<=[.!?])\s+/)) {
      const match = closed.exec(statement)
      if (!match) continue
      const tail = statement.slice(match[0].length).trimStart()
      // Questions about the leading status cannot establish closure. Later
      // semicolon clauses and explanatory URL queries do not erase it.
      const leadingClause = statement.split(';', 1)[0].replace(/\bhttps?:\/\/[^\s;]+/gi, '[reference]')
      if (tail.startsWith('?') || /\?[.!'")\]]*\s*$/.test(leadingClause)) continue
      const qualifier = tail.replace(/^[,\u2013\u2014-]\s*/, '')
      if (/^(?:automatically|only|if|when(?:ever)?|unless|once|after|until|means|as soon as)\b/i.test(qualifier)) continue
      return statement
    }
  }
  return null
}

// Consume raw active DOM nodes only; plain matcher strings and attributes
// retain their existing semantics. Decode each source fragment once, never
// a recursively assembled result.
export function readNativeStatusTextBlocks(node) {
  need(node && typeof node === 'object' && !Array.isArray(node)
    && typeof node.tag === 'string' && Array.isArray(node.children), 'raw active DOM status scope required')
  const blockTags = new Set(['address', 'article', 'aside', 'blockquote', 'dd', 'details', 'dialog', 'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'li', 'main', 'menu', 'nav', 'ol', 'p', 'pre', 'section', 'summary', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul'])
  const qualifiedLayout = ok => {
    if (!ok) throw Object.assign(Error('Native source availability: status layout is unqualified'),
      { code: 'NATIVE_STATUS_LAYOUT_UNQUALIFIED' })
  }
  const visit = n => {
    if (typeof n === 'string') return decodeHTML(n).replace(/\s+/g, ' ')
    const layout = readNativeStatusLayout(n)
    qualifiedLayout(!(n.inert && layout?.visibility === 'uncertain'))
    if (layout?.visibility === 'excluded' || n.inert || n.tag === 'script') return ''
    if (n.tag === 'br') return ' '
    const content = n.children.map(visit).join('')
    if (!content.trim()) return content
    qualifiedLayout(layout?.qualified !== false)
    return (layout ? layout.boundary === 'block' : blockTags.has(n.tag)) ? '\n' + content + '\n' : content
  }
  return visit(node).split(/\n+/).map(norm).filter(Boolean)
}

function identity(job) {
  const config = CONFIG[job?.source]
  need(config && job.company === config.brand && typeof job.jobId === 'string' && norm(job.title), 'source/native role/title/brand is unqualified')
  const title = norm(job.originalTitle || job.title), employer = job.nativeLegalEmployer || config.brand
  need(CONFIG[job.source].employers.includes(employer), 'native employer is outside the validated source scope')
  let url; try { url = new URL(job.sourceUrl) } catch { need(false, 'native canonical URL is malformed') }
  need(url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.search && !url.hash, 'native canonical URL is unsafe or filtered')
  let canonicalRoleId = job.jobId
  if (job.source === 'enphaseenergy') need(/^[a-zA-Z0-9_-]{1,80}$/.test(job.jobId) && url.href === `https://enphase.com/job/${job.jobId}`, 'Enphase canonical/native ID mismatch')
  if (job.source === 'datahub') need(/^\d+$/.test(job.jobId) && url.href === `https://job-boards.greenhouse.io/acryldata/jobs/${job.jobId}`, 'DataHub canonical/native ID mismatch')
  if (job.source === 'disney') {
    canonicalRoleId = String(job.nativeJobId || '')
    need(/^\d+$/.test(job.jobId) && /^\d+$/.test(canonicalRoleId) && url.origin === 'https://www.disneycareers.com'
      && new RegExp('^/en/job/[^/]+/[^/]+/391/' + canonicalRoleId + '$').test(url.pathname), 'Disney canonical/native role mismatch')
  }
  const role = { source: job.source, jobId: job.jobId, canonicalRoleId, title, brand: config.brand, employer, canonicalUrl: url.href }
  if (job.source === 'disney') {
    need((job.nativeRequisitionId == null || job.nativeRequisitionId === job.jobId)
      && typeof job.nativePostingBrand === 'string' && norm(job.nativePostingBrand)
      && ['Bengaluru, India', 'Mumbai, India'].includes(norm(job.nativeListingLocation)), 'Disney typed native role metadata is unqualified')
    role.nativePostingBrand = norm(job.nativePostingBrand)
    role.nativeListingLocation = norm(job.nativeListingLocation)
  }
  return role
}

function scopes(html, role) {
  need(typeof html === 'string' && html.length > 0 && Buffer.byteLength(html) <= 3000000, 'complete native evidence snapshot is missing or oversized')
  const d = readVisibleNativeDocument(html, { strict: true, statusLayout: true }), canonical = d.nodes(n => n.tag === 'link' && n.attrs.rel === 'canonical')
  const statusNodes = predicate => {
    const nodes = d.statusNodes(predicate)
    // Preserve specific layout uncertainty before generic scope cardinality
    // errors can be handled as ordinary native shape drift by a caller.
    if (nodes.some(node => readNativeStatusLayout(node)?.qualified === false)) {
      throw Object.assign(Error('Native source availability: status layout is unqualified'),
        { code: 'NATIVE_STATUS_LAYOUT_UNQUALIFIED' })
    }
    return nodes
  }
  need(canonical.length === 1 && (canonical[0].attrs.href === role.canonicalUrl || role.source === 'datahub'
    && canonical[0].attrs.href === role.canonicalUrl.replace(/^https:/, 'http:')), 'snapshot canonical identity differs')
  const within = (n, target) => n === target || n.children?.some(c => typeof c !== 'string' && within(c, target))
  let header, descriptions
  if (role.source === 'enphaseenergy') {
    header = statusNodes(n => d.hasClass(n, 'jobvite-detail__intro'))
    descriptions = statusNodes(n => d.hasClass(n, 'jobvite-detail__content'))
  } else if (role.source === 'disney') {
    header = statusNodes(n => n.attrs.id === 'job-details-1')
    const root = statusNodes(n => n.attrs.id === 'job-details-3')
    need(header.length === 1 && root.length === 1, 'Disney native role/description identity scope is missing or ambiguous')
    const expected = { 'data-org-id': '391', 'data-job-id': role.canonicalRoleId,
      'data-tm-job-id': role.jobId, 'data-tm-job-name': role.title,
      'data-tm-job-business': role.employer, 'data-tm-job-posting-brand': role.nativePostingBrand,
      'data-tm-job-location': role.nativeListingLocation }
    for (const node of [header[0], root[0]]) {
      for (const [field, value] of Object.entries(expected)) need(norm(node.attrs[field]) === value,
        'Disney native header/description metadata differs: ' + field)
    }
    const meta = name => {
      const fields = d.nodes(n => n.tag === 'meta' && n.attrs.name === name)
      need(fields.length === 1, 'Disney native identity metadata is missing or ambiguous: ' + name)
      return fields[0].attrs.content
    }
    need(meta('job-ats-req-id') === role.jobId && norm(meta('job-tbcn-job-title')) === role.title
      && ['391,', '391,' + role.employer].includes(meta('gtm_tbcn_division')), 'Disney native requisition/title/employer metadata differs')
    need(meta('gtm_tbcn_location') === (role.nativeListingLocation === 'Mumbai, India'
      ? 'Mumbai~Maharashtra~India' : 'Bengaluru~Karnataka~India'), 'Disney typed native country metadata differs')
    descriptions = statusNodes(n => d.hasClass(n, 'ats-description') && root.some(r => within(r, n)))
  } else {
    header = statusNodes(n => d.hasClass(n, 'job__header'))
    descriptions = statusNodes(n => d.hasClass(n, 'job__description'))
    const models = d.nodes(n => n.tag === 'script' && !n.attrs.src && n.raw?.includes('window.__remixContext'))
    need(models.length === 1, 'DataHub native role model is missing or ambiguous')
    const match = /^\s*window\.__remixContext\s*=\s*([\s\S]+);\s*$/.exec(models[0].raw)
    need(match, 'DataHub native role model is malformed')
    const payload = JSON.parse(match[1]), model = payload.state?.loaderData?.['routes/$url_token_.jobs_.$job_post_id']
    need(payload.state?.errors === null && model?.jobPostId === role.jobId && model.jobPost?.public_url === role.canonicalUrl
      && norm(model.jobPost.title) === role.title && model.jobPost.company_name === role.employer, 'DataHub model role identity differs')
    if (typeof model.jobPost.content === 'string') {
      const content = readVisibleNativeDocument(model.jobPost.content, { strict: true, statusLayout: true })
      descriptions = [...descriptions, ...content.statusNodes(n => n.tag === 'root')]
    }
  }
  need(header.length === 1, 'native role header scope is missing or ambiguous')
  const headings = d.nodes(n => n.tag === 'h1' && within(header[0], n))
  need(headings.length === 1 && d.text(headings[0]) === role.title, 'snapshot visible native role title differs')
  return { blocks: [...header, ...descriptions].flatMap(readNativeStatusTextBlocks), descriptionText: descriptions.map(n => d.text(n)).join(' ') }
}

function explicitOpen(status) {
  return status?.kind === 'workday-cxs-jobPostingInfo' && status.posted === true && status.canApply === true
}

export function nativeRoleClosureNotice(job, evidenceHtml) {
  return findExplicitNativeClosure(scopes(evidenceHtml, identity(job)).blocks)
}

export function createNativeRoleAvailability(job, { state, observedAt, evidenceHtml, nativeStatus = null }) {
  need(state === 'open' || state === 'closed', 'only positively validated open/closed states can be emitted')
  const role = identity(job), native = scopes(evidenceHtml, role), notice = findExplicitNativeClosure(native.blocks)
  const time = new Date(observedAt)
  need(Number.isFinite(time.getTime()), 'observation clock is invalid')
  if (state === 'closed') need(notice, 'no active declarative closure notice in the bound native role')
  else need(!notice && job.sourceDetailComplete === true && (extractActiveDescription(job.sourceDescription || job.jobDescription)?.length || 0) >= 100
    && norm(native.descriptionText).includes(norm(job.sourceDescription || job.jobDescription)), 'positive complete native open detail is unavailable')
  if (nativeStatus != null) need(nativeStatus.kind === 'workday-cxs-jobPostingInfo'
    && typeof nativeStatus.posted === 'boolean' && typeof nativeStatus.canApply === 'boolean', 'typed native status evidence is malformed')
  const contradictory = state === 'closed' && explicitOpen(nativeStatus)
    || state === 'open' && nativeStatus && (!nativeStatus.posted || !nativeStatus.canApply)
  return { version: 1, provenance: PROVENANCE, ...role, requestedState: state,
    state: contradictory ? 'unavailable' : state, observedAt: time.toISOString(), notice,
    nativeStatus, evidenceHtml, evidenceSha256: hash(evidenceHtml) }
}

export function readNativeRoleAvailability(job) {
  const evidence = job?.sourceAvailabilityEvidence
  if (evidence == null) return null
  try {
    need(evidence.version === 1 && evidence.provenance === PROVENANCE, 'unrecognized availability provenance')
    const rebuilt = createNativeRoleAvailability(job, { state: evidence.requestedState, observedAt: evidence.observedAt,
      evidenceHtml: evidence.evidenceHtml, nativeStatus: evidence.nativeStatus })
    need(same(rebuilt, evidence), 'native availability identity, clock or snapshot changed')
    const status = job.sourceNativeStatusEvidence
    const contradiction = rebuilt.state === 'closed' && status?.workdayPosted === true && status.workdayCanApply === true
    return { ...rebuilt, state: contradiction ? 'unavailable' : rebuilt.state, validated: true }
  } catch { return { state: 'unavailable', validated: false, reason: 'invalid-native-role-availability-proof' } }
}

export function isFreshNativeAvailability(evidence, now = new Date()) {
  if (!evidence?.validated || !['open', 'closed'].includes(evidence.state)) return false
  const observed = Date.parse(evidence.observedAt), current = +new Date(now)
  return Number.isFinite(observed) && Number.isFinite(current) && observed <= current && current - observed <= 48 * 3600000
}

export function storedAvailabilityMarker(evidence) {
  return { version: 1, provenance: PROVENANCE, state: evidence.state, source: evidence.source, jobId: evidence.jobId,
    canonicalRoleId: evidence.canonicalRoleId, title: evidence.title, brand: evidence.brand, employer: evidence.employer,
    canonicalUrl: evidence.canonicalUrl, observedAt: new Date(evidence.observedAt), evidenceSha256: evidence.evidenceSha256 }
}
