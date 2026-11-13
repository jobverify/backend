import { createHash } from 'node:crypto'
import { decodeHTML } from 'entities'
import { activeHead, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { nativeCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import authorityReview from './currentAuthority20261113.json' with { type: 'json' }

const CAREERS = 'https://www.dialpad.com/careers/', OPENINGS = CAREERS + 'open-opportunities/'
const API = 'https://boards-api.greenhouse.io/v1/boards/dialpad/', JOBS = API + 'jobs?content=true', OFFICES = API + 'offices'
const hash = value => createHash('sha256').update(value).digest('hex')
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value
const equal = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b))
const need = (ok, why) => { if (!ok) throw Object.assign(Error('Dialpad current native: ' + why), { softFailure: true, abortRetries: true, failureKind: 'source_identity_unverified' }) }
const nativeUrl = row => {
  const url = new URL(row.absolute_url)
  return url.protocol === 'https:' && ['boards.greenhouse.io', 'job-boards.greenhouse.io'].includes(url.hostname)
    && !url.username && !url.password && !url.port && !url.search && !url.hash && url.pathname === `/dialpad/jobs/${row.id}`
}
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const keys = (value, allowed) => record(value) && Object.keys(value).length === allowed.length && Object.keys(value).every(key => allowed.includes(key))
const ids = value => Array.isArray(value) && value.every(id => Number.isSafeInteger(id) && id >= 0) && new Set(value).size === value.length
const department = (value, withJobs = false) => keys(value, ['id', 'name', 'parent_id', 'child_ids', ...(withJobs ? ['jobs'] : [])])
  && Number.isSafeInteger(value.id) && value.id >= 0 && typeof value.name === 'string' && value.name.trim()
  && (value.parent_id === null || Number.isSafeInteger(value.parent_id) && value.parent_id >= 0) && ids(value.child_ids)
  && (!withJobs || Array.isArray(value.jobs))
const reviewedRoleShape = row => Array.isArray(row.departments) && row.departments.length > 0 && row.departments.every(value => department(value))
  && row.metadata.length === 1 && row.metadata.every(value => keys(value, ['id', 'name', 'value', 'value_type'])
    && value.id === 119834217002 && value.name === 'High Priority Requisition' && value.value_type === 'yes_no'
    && (value.value === null || typeof value.value === 'boolean'))
  && Array.isArray(row.data_compliance) && row.data_compliance.length === 1 && row.data_compliance.every(value => keys(value,
    ['type', 'requires_consent', 'requires_processing_consent', 'requires_retention_consent', 'retention_period', 'demographic_data_consent_applies'])
    && value.type === 'gdpr' && ['requires_consent', 'requires_processing_consent', 'requires_retention_consent', 'demographic_data_consent_applies'].every(key => typeof value[key] === 'boolean')
    && (value.retention_period === null || Number.isSafeInteger(value.retention_period) && value.retention_period >= 0))
  && [row.ai_disclaimer, row.include_ai_disclaimer, row.ai_opt_out_request_url].every(value => value === null)
const fields = new Set(['absolute_url', 'ai_disclaimer', 'ai_opt_out_request_url', 'application_deadline', 'company_name', 'content', 'data_compliance',
  'departments', 'education', 'first_published', 'id', 'include_ai_disclaimer', 'internal_job_id', 'language', 'location', 'metadata', 'offices', 'requisition_id', 'title', 'updated_at'])
const inventory = html => {
  const payload = JSON.parse(html), ids = new Set()
  need(payload && Array.isArray(payload.jobs) && payload.jobs.length <= 500 && Object.keys(payload).every(key => ['jobs', 'meta'].includes(key))
    && payload.meta && Object.keys(payload.meta).length === 1 && payload.meta.total === payload.jobs.length, 'native total or continuation unavailable')
  for (const row of payload.jobs) {
    need(Number.isSafeInteger(row.id) && row.id > 0 && !ids.has(row.id) && row.company_name === 'Dialpad'
      && typeof row.title === 'string' && row.title.trim() && nativeUrl(row) && Object.keys(row).every(key => fields.has(key))
      && row.location && Object.keys(row.location).every(key => key === 'name') && typeof row.location.name === 'string'
      && Array.isArray(row.offices) && row.offices.length && Array.isArray(row.metadata)
      && row.metadata.every(value => value.id === 119834217002 && value.name === 'High Priority Requisition' && value.value_type === 'yes_no')
      && [undefined, 'education_required'].includes(row.education) && row.application_deadline === null, 'native employer, role identity or schema changed')
    ids.add(row.id)
  }
  return payload
}
const alpha3 = { USA: 'United States', JPN: 'Japan', AUS: 'Australia', PHL: 'Philippines', ARG: 'Argentina', IND: 'India', CAN: 'Canada', GBR: 'United Kingdom' }
const writtenCountries = label => typeof label === 'string' && label.trim()
  ? label.split(';').map(value => nativeCountryName(value.split(',').at(-1).trim())) : [null]
const reference = office => Object.fromEntries(['id', 'name', 'location', 'parent_id', 'child_ids'].map(key => [key, office[key]]))
const countries = (row, offices) => {
  const primary = writtenCountries(row.location.name), assigned = [], issues = []
  for (const supplied of row.offices) {
    const office = offices.find(office => office.id === supplied.id)
    if (!office || !equal(reference(office), supplied) || office.parent_id !== null || office.child_ids.length) { issues.push('unreconciled-role-assigned-office'); continue }
    const coded = office.name.match(/^([A-Z]{3})-/)?.[1], byName = coded ? alpha3[coded] : writtenCountries(office.name)[0]
    const byAddress = office.location ? writtenCountries(office.location) : []
    if (!byName || byAddress.some(value => !value || value !== byName)) { issues.push('unknown-or-conflicting-assigned-office-country'); continue }
    assigned.push(byName)
  }
  if (primary.some(value => !value) || !assigned.length || primary.some(value => !assigned.includes(value))
    || assigned.some(value => !primary.includes(value))) issues.push('native-workplace-country-alternative-unresolved')
  return { jobId: String(row.id), qualified: issues.length === 0, countries: [...new Set([...primary, ...assigned].filter(Boolean))],
    nativePrimaryLocation: row.location, nativeAssignedOffices: row.offices, issues }
}
const typography = new Map([
  ['font-size', new Set(['12pt', '14px'])], ['font-weight', new Set(['400'])], ['text-align', new Set(['left', 'center'])],
  ['font-family', new Set(['helvetica, arial, sans-serif', "-apple-system, blinkmacsystemfont, 'segoe ui', roboto, oxygen, ubuntu, cantarell, 'open sans', 'helvetica neue', sans-serif"])],
])
const criteriaAttributes = new Map([
  ['root', []], ['div', ['class']], ['p', ['style']], ['span', ['class', 'style']], ['strong', []], ['br', []],
  ['em', ['style']], ['ul', []], ['li', ['style']], ['a', ['href']],
])
const criteriaClasses = new Map([
  ['div', new Set(['', 'content-conclusion', 'content-pay-transparency', 'description', 'pay-input', 'pay-range', 'title', 'content-intro'])],
  ['span', new Set(['', 'divider'])],
])
const criteria = raw => {
  const document = readNativeDocument(decodeHTML(raw)), root = document.nodes(node => node.tag === 'root')[0]
  const visible = node => {
    if (typeof node === 'string') return true
    const attributes = criteriaAttributes.get(node.tag)
    if (node.inert || Object.hasOwn(node, 'raw') || !attributes || Object.keys(node.attrs).some(key => !attributes.includes(key))
      || node.attrs.class && !criteriaClasses.get(node.tag)?.has(node.attrs.class)) return false
    for (const rule of (node.attrs.style || '').split(';').filter(value => value.trim())) {
      const colon = rule.indexOf(':'), property = rule.slice(0, colon).trim().toLowerCase(), value = rule.slice(colon + 1).trim().toLowerCase()
      if (colon === -1 || !typography.get(property)?.has(value)) return false
    }
    return node.children.every(visible)
  }
  return visible(root) && document.text(root).length > 250
}
const authorityPath = (document, node, card = false) => {
  const parents = new Map()
  const index = at => { for (const child of at.children) if (typeof child !== 'string') { parents.set(child, at); index(child) } }
  document.nodes(at => at.tag === 'root').forEach(index)
  for (let at = node; at; at = parents.get(at)) {
    const nativeCardStyle = card && at === node && at.tag === 'a'
      && at.attrs.style === 'text-decoration:none !important;position:relative;display:inline-flex;align-items:center'
    need(!at.inert && !Object.hasOwn(at.attrs, 'popover') && authorityReview.classesByTag[at.tag]?.includes(at.attrs.class || '')
      && Object.entries(at.attrs).every(([key, value]) => ['class', 'style', 'href'].includes(key)
        || authorityReview.attributeValuesByTag[at.tag]?.[key]?.includes(value))
      && (!(at.attrs.style || '').trim() || nativeCardStyle), 'current authority handoff ancestor styling or visibility changed')
  }
}
const officeMembership = (payload, offices) => {
  const ids = new Set(), members = new Map(), issues = []
  need(offices && Object.keys(offices).length === 1 && Array.isArray(offices.offices) && offices.offices.length <= 2000, 'native office envelope changed')
  for (const office of offices.offices) {
    need(Number.isSafeInteger(office.id) && !ids.has(office.id) && Array.isArray(office.child_ids) && Array.isArray(office.departments)
      && Object.keys(office).every(key => ['id', 'name', 'location', 'parent_id', 'child_ids', 'departments'].includes(key)), 'native office definitions changed')
    ids.add(office.id)
    for (const group of office.departments) {
      if (!department(group, true)) issues.push('unreviewed-native-office-department-schema-or-criteria')
      for (const brief of Array.isArray(group.jobs) ? group.jobs : []) {
      const row = payload.jobs.find(row => row.id === brief.id)
      if (!row || Object.keys(brief).some(key => !equal(brief[key], row[key]))) { issues.push('office-native-role-membership-or-fields-disagree'); continue }
      if (!members.has(row.id)) members.set(row.id, new Set())
      members.get(row.id).add(office.id)
      }
    }
  }
  for (const row of payload.jobs) if (!equal([...new Set(row.offices.map(office => office.id))].sort(), [...(members.get(row.id) || [])].sort())) issues.push('office-native-role-membership-incomplete')
  return issues
}

export async function runCurrentDialpad(options = {}) {
  const signal = AbortSignal.any([AbortSignal.timeout(240000), ...(options.signal ? [options.signal] : [])])
  const wait = promise => new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(signal.reason) }
    signal.addEventListener('abort', abort, { once: true })
    Promise.resolve(promise).then(value => { signal.removeEventListener('abort', abort); resolve(value) }, error => { signal.removeEventListener('abort', abort); reject(error) })
    if (signal.aborted) abort()
  })
  const responses = [], failures = []
  const read = async url => {
    signal.throwIfAborted()
    const response = await wait((options.fetchImpl || fetch)(url, { method: 'GET', redirect: 'manual', credentials: 'omit',
      signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]), headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html,application/json' } }))
    need(response.status === 200 && response.url === url, 'public HTTP or final URL identity changed: ' + url)
    const body = await wait(response.text())
    need(Buffer.byteLength(body) < 3000000, 'public native response exceeds byte bound')
    responses.push({ url, status: response.status, sha256: hash(body), bytes: Buffer.byteLength(body) })
    signal.throwIfAborted(); return body
  }
  const authorityStyling = async (html, surface, cache) => {
    const document = readNativeDocument(html), roots = document.nodes(node => node.tag === 'root')
    const walk = node => typeof node === 'string' ? [] : [node, ...node.children.flatMap(walk)]
    const inline = roots.flatMap(walk).filter(node => node.tag === 'style').map(node => ({ attributes: node.attrs, sha256: hash(node.raw || '') }))
    // Stylesheet loading is independent of the link element's own visibility.
    // Inspect the original tree, including hidden/inert metadata declarations;
    // HTML relation keywords are case-insensitive and may contain references.
    const declared = roots.flatMap(walk).filter(node => node.tag === 'link'
      && (decodeHTML(node.attrs.rel || '').toLowerCase().split(/\s+/).includes('stylesheet')
        || decodeHTML(node.attrs.as || '').trim().toLowerCase() === 'style')).map(node => node.attrs)
    const expected = authorityReview.stylingBySurface[surface]
    // The native publisher repeats this same complete button style per button.
    // Repetition count carries no rendering semantics; every body/attribute
    // contract must still be one of the exact reviewed original declarations.
    need(expected && inline.length > 0 && inline.every(row => expected.inlineStyles.some(known => equal(row, known)))
      && expected.inlineStyles.every(known => inline.some(row => equal(row, known)))
      && equal(declared, expected.stylesheets.map(row => row.attributes)),
      'current authority stylesheet declaration or inline styling changed')
    for (const row of expected.stylesheets) {
      if (!cache.has(row.url)) cache.set(row.url, await read(row.url))
      need(hash(cache.get(row.url)) === row.sha256, 'current authority stylesheet bytes changed')
    }
  }
  const context = async () => {
    const styleCache = new Map()
    const home = await read(CAREERS), document = readVisibleNativeDocument(home, { strict: true })
    await authorityStyling(home, 'careers', styleCache)
    const handoffs = document.nodes(node => node.tag === 'a' && new URL(node.attrs.href || '', CAREERS).href === OPENINGS && document.text(node) === 'See all jobs')
    for (const node of handoffs) authorityPath(document, node)
    need(activeHead(home).titles.includes("We're Hiring! Join Dialpad's UCaaS, CCaaS, and AI-focused… | Dialpad")
      && handoffs.length > 0, 'corporate careers handoff changed')
    const html = await read(OPENINGS), board = readVisibleNativeDocument(html, { strict: true })
    await authorityStyling(html, 'openings', styleCache)
    need(activeHead(html).titles.includes('Career Opportunities at Dialpad | Dialpad'), 'current openings identity changed')
    const roles = new Map()
    for (const node of board.nodes(node => node.tag === 'a' && node.attrs.href?.startsWith('/careers/open-opportunities/apply/'))) {
      authorityPath(board, node, true)
      const url = new URL(node.attrs.href, CAREERS), id = url.searchParams.get('id')
      need(/^\d+$/.test(id || '') && url.origin === 'https://www.dialpad.com' && !url.hash
        && board.text(node) === 'Apply' && !Object.hasOwn(node.attrs, 'disabled') && !node.attrs['aria-disabled'], 'current native employer role handoff changed')
      roles.set(id, url.href)
    }
    need(roles.size > 0 && roles.size <= 500, 'current corporate role inventory unavailable')
    const [id, url] = roles.entries().next().value, roleHtml = await read(url), detail = readVisibleNativeDocument(roleHtml, { strict: true })
    await authorityStyling(roleHtml, 'role', styleCache)
    const native = detail.nodes(node => node.tag === 'a' && node.attrs.href && (() => {
      try { const target = new URL(node.attrs.href); return ['boards.greenhouse.io', 'job-boards.greenhouse.io'].includes(target.hostname) && target.pathname === `/dialpad/jobs/${id}` && target.protocol === 'https:' && !target.search && !target.hash && !target.port && !target.username && !target.password } catch { return false }
    })())
    need(native.length === 1 && detail.text(native[0]) === 'Apply for this position' && !Object.hasOwn(native[0].attrs, 'disabled')
      && !native[0].attrs['aria-disabled'], 'current first-party native tenant declaration unavailable')
    authorityPath(detail, native[0])
    return [...roles.keys()].sort()
  }
  const employerOpening = await context(), opening = inventory(await read(JOBS)), openingOffices = JSON.parse(await read(OFFICES))
  need(equal(employerOpening, opening.jobs.map(row => String(row.id)).sort()), 'current corporate/native posting identities differ')
  const inspect = async (payload, phase) => {
    const details = []
    for (const row of payload.jobs) {
      const detail = JSON.parse(await read(API + `jobs/${row.id}?content=true`))
      if (!equal(detail, row)) failures.push({ id: row.id, phase, reason: 'full native detail identity/criteria changed' })
      if (!reviewedRoleShape(row)) failures.push({ id: row.id, phase, reason: 'unreviewed native nested schema or authored criteria' })
      if (!criteria(row.content)) failures.push({ id: row.id, phase, reason: 'full original visible criteria unreviewed' })
      details.push(detail)
    }
    return details
  }
  const details = await inspect(opening, 'opening')
  const employerClosing = await context(), closingBefore = inventory(await read(JOBS)), closingOffices = JSON.parse(await read(OFFICES))
  const closingDetails = await inspect(closingBefore, 'closing'), closing = inventory(await read(JOBS))
  const countryProofs = opening.jobs.map(row => countries(row, openingOffices.offices))
  for (const proof of countryProofs) if (!proof.qualified) failures.push({ id: proof.jobId, reason: proof.issues.join(';') })
  for (const reason of officeMembership(opening, openingOffices)) failures.push({ phase: 'opening-office-membership', reason })
  for (const reason of officeMembership(closingBefore, closingOffices)) failures.push({ phase: 'closing-office-membership', reason })
  const stable = equal(opening, closingBefore) && equal(opening, closing) && equal(openingOffices, closingOffices)
    && equal(employerOpening, employerClosing) && equal(details, closingDetails)
  if (!stable) failures.push({ phase: 'final-closing', reason: 'native inventory/full criteria/office assignments changed after closing details' })
  // Current original representations contain only foreign roles. A future India
  // posting must receive its own reviewed public application binding; it cannot
  // be omitted and converted into a zero while that contract is unavailable.
  for (const proof of countryProofs) if (proof.countries.includes('India')) failures.push({ id: proof.jobId, reason: 'India public role/application binding requires current native qualification' })
  const jobs = [], complete = stable && failures.length === 0
  attachInventoryEvidence(jobs, { status: complete ? 'complete-inventory' : 'coverage-gap', surface: JOBS, firstParty: true,
    listingComplete: complete, lifecycleCleanupAllowed: false, pagesFetched: responses.length, reportedTotal: opening.jobs.length,
    indiaFacetCount: complete ? 0 : null, verifiedAt: new Date().toISOString(),
    reason: complete ? 'Current corporate-declared Dialpad tenant; complete native array, every full original visible detail, role-assigned office countries and memberships, final inventory after full closing details; foreign declared-board scope only, company cleanup forbidden.' : failures.map(row => row.reason).join(';') })
  attachSourceObservationEvidence(jobs, { source: 'dialpad', recordKind: 'vacancy-rows', observedRecordCount: opening.jobs.length, observedVacancyCount: opening.jobs.length, sourceScopeComplete: false })
  const audit = { source: 'dialpad', opening, closing, openingOffices, closingOffices, details, closingDetails, countryProofs, failures, responses,
    sourceScopeComplete: false, lifecycleCleanupAllowed: false, sourceCompanyWideScopeComplete: false, currentIndiaApplicationContractUnreviewed: true }
  Object.defineProperty(jobs, 'nativeCollectionEvidence', { value: audit, configurable: true })
  Object.defineProperty(jobs, 'sourceAudit', { value: audit, configurable: true })
  options.onAudit?.(audit); signal.throwIfAborted(); return jobs
}
