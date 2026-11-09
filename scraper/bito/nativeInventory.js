import { createHash } from 'node:crypto'
import { setTimeout as pause } from 'node:timers/promises'
import { readNativeDocument, extractActiveDescription, decodeNativeEntities } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
const C = 'https://bito.ai/careers/', B = 'https://bito.freshteam.com', F = B + '/hire/widgets/jobs.json'
const W = 'https://s3.amazonaws.com/files.freshteam.com/production/98462/attachments/6016898292/original/6000034511_widget.js?1733908707'
const J = 'https://assets1.freshteam.com/assets/job_widget.js'
// The noscript raw-text fallback is not an active stylesheet with JS enabled.
const hashes = { styles: '8516a81ffa8d9538e67de9cb5de838283406e54d880a64eff21b4e8d26bec470',
  lineage: 'd8ffe1bb8bff04ebbe21c4dfd8a3acbcdac3881bb47283588700ffd26b0283a9',
  stylesheets: 'e55bb76c60b756f0b3b774ff36cfffd5f160a8d7f2c985d64a91e4ca369009cb',
  lazy: '00bd608a083105a0ec3181e439f2975c911aae30c6c2a8e476a10ea9b49bae98',
  bootstrap: '879a225ecf147e803e29530e27bfbcbaf3dbba6f1aa7a15f55035e7ab40e095c',
  client: '28890ffe00c3ef3f51cd40bcdc6bc3b00d6d680db6e19e93a8cc46ac09700980' }
const hash = value => createHash('sha256').update(value).digest('hex')
const clean = value => decodeNativeEntities(value).replace(/\s+/g, ' ').trim(), fold = value => clean(value).toLowerCase()
const children = node => (node?.children || []).filter(child => typeof child !== 'string')
const all = node => node ? [node, ...children(node).flatMap(all)] : []
const cls = (node, value) => (node.attrs.class || '').split(/\s+/).includes(value)
const visibleText = html => { const doc = readVisibleNativeDocument(String(html ?? '')); return doc.text(doc.nodes(n => n.tag === 'root')[0]) }
const body = html => extractActiveDescription(visibleText(html))
// Styles in templates, script strings and raw fallbacks cannot hide the live
// document. Rebuild presentation input from parsed active HTML contexts first.
const presentation = doc => {
  const attribute = value => String(value).replace(/[&"<]/g, char => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;' })[char])
  const render = node => {
    if (typeof node === 'string') return node
    if (['template', 'noscript', 'object', 'iframe', 'script'].includes(node.tag)) return ''
    const content = node.raw ?? node.children.map(render).join('')
    return node.tag === 'root' ? content : '<' + node.tag + Object.entries(node.attrs).map(([key, value]) => ' ' + key + '="' + attribute(value) + '"').join('') + '>' + content + '</' + node.tag + '>'
  }
  return readVisibleNativeDocument(render(doc.nodes(n => n.tag === 'root')[0]))
}
const compact = value => clean(value).replace(/\s/g, '')
const stable = value => JSON.stringify(value, (_, item) => item && !Array.isArray(item) && typeof item === 'object'
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)
class BitoNativeIdentityError extends Error { constructor(message) { super('Bito native: ' + message); this.name = 'BitoNativeIdentityError'; this.abortRetries = true } }
const valid = (condition, message) => { if (!condition) throw new BitoNativeIdentityError(message) }
const one = (nodes, label) => { valid(nodes.length === 1, 'expected one ' + label); return nodes[0] }
const parse = value => { try { return JSON.parse(value) } catch { throw new BitoNativeIdentityError('invalid public JSON') } }
const countries = new Map(), names = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const code = String.fromCharCode(a, b), name = names.of(code)
  if (name && !['ZZ', 'XA', 'XB', 'UN', 'EU', 'EZ', 'QO'].includes(code)) { countries.set(fold(code), code); countries.set(fold(name), code) }
}
for (const [label, code] of [['USA', 'US'], ['United States of America', 'US'], ['UK', 'GB']]) countries.set(fold(label), code)
const country = value => countries.get(fold(value?.name ?? value)) || null
const scopes = value => clean(value).split(/\s*\|\s*/).filter(Boolean).map(label => ({ label, country: country(label.split(',').at(-1)) }))
const structured = doc => doc.nodes(n => n.tag === 'script' && n.attrs.type === 'application/ld+json').flatMap(n => { const value = parse(n.raw); return value['@graph'] || [value] })
const inspect = (html, url, reasons, refs) => {
  const doc = readNativeDocument(html), nodes = all(doc.nodes(n => n.tag === 'root')[0])
  if (nodes.some(n => n.activeFrame)) reasons.add('additional-unresolved-active-frame')
  const ats = /careers-page|ashbyhq|greenhouse|lever\.co|myworkdayjobs|workable|darwinbox|careers\.hibob|freshteam\.com|smartrecruiters/
  for (const node of doc.nodes(n => n.tag === 'a' && n.attrs.href)) {
    let target; try { target = new URL(node.attrs.href, url) } catch { continue }
    if (!['http:', 'https:'].includes(target.protocol)) continue
    if (target.origin === B && /^\/jobs\/[^/]+\/[^/]+\/?$/.test(target.pathname)) refs.add(target.pathname.split('/')[2])
    else if (target.origin === new URL(C).origin && ![new URL(C).pathname.replace(/\/$/, ''), ''].includes(target.pathname.replace(/\/$/, ''))
      && /\b(?:careers?|jobs?|vacancies|openings|open roles|internships?)\b/i.test(doc.text(node))) reasons.add('additional-first-party-careers-scope')
    else if (target.origin !== B && target.origin !== new URL(C).origin && (ats.test(target.hostname)
      || /\b(?:careers?|jobs?|vacancies|openings|open roles)\b/i.test(doc.text(node)))) reasons.add('additional-active-careers-scope')
  }
  const scripts = node => ['template', 'noscript', 'object'].includes(node.tag) ? [] : [ ...(node.tag === 'script' ? [node] : []), ...children(node).flatMap(scripts) ]
  for (const script of scripts(nodes[0]).filter(n => !Object.hasOwn(n.attrs, 'nomodule') && /^(?:|module|text\/rocketlazyloadscript|(?:text|application)\/(?:javascript|ecmascript))$/i.test(n.attrs.type || ''))) {
    const values = [script.attrs.src, script.attrs['data-rocket-src'], ...(script.raw || '').replace(/\\\//g, '/').matchAll(/https?:\/\/[^\s"'<>`\\]+/g).map(m => m[0])].filter(Boolean)
    for (const value of values) { let target; try { target = new URL(value, url) } catch { continue }
      if (![B, new URL(C).origin, 'https://s3.amazonaws.com', 'https://assets1.freshteam.com', 'https://assets.freshteam.com'].includes(target.origin) && ats.test(target.hostname)) reasons.add('additional-active-careers-script') }
  }
  return doc
}
const corporate = (html, reasons, refs) => {
  const doc = inspect(html, C, reasons, refs), root = one(doc.nodes(n => n.tag === 'root'), 'corporate root'), nodes = all(root)
  valid(one(doc.nodes(n => n.tag === 'link' && n.attrs.rel === 'canonical'), 'corporate canonical').attrs.href === C, 'corporate canonical changed')
  const org = one(structured(doc).filter(value => value['@type'] === 'Organization'), 'corporate employer')
  valid(org.name === 'Bito' && org.url === 'https://bito.ai/', 'corporate employer changed')
  const first = nodes.find(n => n.attrs.id === 'freshteam-widget')
  valid(first, 'advertised native widget missing')
  const lineage = (node, target, ancestors = []) => node === target ? [...ancestors, node] : children(node).map(child => lineage(child, target, [...ancestors, node])).find(Boolean)
  const path = lineage(root, first)
  let publisherVerified = true
  const unverified = reason => { publisherVerified = false; reasons.add(reason) }
  if (path.some(n => n.inert || ['desktop', 'laptop', 'tablet', 'mobile'].every(view => cls(n, 'elementor-hidden-' + view)))) unverified('native-widget-target-hidden')
  if (!path.some(n => n.tag === 'main' && n.attrs.id === 'content' && cls(n, 'post-146'))) unverified('native-widget-page-identity-changed')
  const layout = path.map(n => ({ tag: n.tag, attrs: n.attrs })), stylesheetHash = hash(stable(doc.nodes(n => n.tag === 'link' && n.attrs.rel === 'stylesheet').map(n => n.attrs)))
  if (hash(stable(layout)) !== hashes.lineage || stylesheetHash !== hashes.stylesheets) unverified('native-widget-presentation-identity-changed')
  const styleHash = hash(nodes.filter(n => n.tag === 'style').map(n => n.raw || '').join('\n'))
  const lazy = doc.nodes(n => n.tag === 'script' && !n.attrs.src && !Object.hasOwn(n.attrs, 'nomodule')
    && /^(?:|(?:text|application)\/javascript)$/i.test(n.attrs.type || '') && (n.raw || '').includes('class RocketLazyLoadScripts'))
  if (styleHash !== hashes.styles || lazy.length !== 1 || hash(lazy[0].raw) !== hashes.lazy) unverified('corporate-display-or-lazy-client-changed')
  // CSS-hidden sections still execute ordinary JavaScript. The captured Rocket
  // loader activates this declared script after normal user navigation; its
  // known bootstrap mounts into the first DOM ID, which must remain visible.
  valid(doc.nodes(n => n.tag === 'script' && n.attrs.type === 'text/rocketlazyloadscript' && n.attrs['data-rocket-src'] === W).length === 1, 'native employer widget delegation changed')
  return { publisherVerified, state: stable({ org: org.name, styleHash, stylesheetHash, lazy: lazy.map(n => hash(n.raw)), path: layout }) }
}
const roleURL = value => {
  let url; try { url = new URL(value, B) } catch { throw new BitoNativeIdentityError('invalid public role URL') }
  valid(url.origin === B && /^\/jobs\/[a-z0-9]+\/[a-z0-9-]+\/?$/i.test(url.pathname) && !url.search && !url.hash && !url.username && !url.password, 'public role URL changed')
  return url.href
}
const readFeed = (payload, reasons) => {
  valid(payload && ['jobs', 'branches', 'job_roles'].every(key => Array.isArray(payload[key])) && payload.jobs.length <= 2000, 'native feed schema or inventory budget changed')
  if (Object.keys(payload).some(key => !['jobs', 'branches', 'job_roles'].includes(key))) reasons.add('unverified-native-pagination-or-feed-fields')
  const branches = new Map(), roles = new Map(), rows = new Map()
  for (const item of payload.branches) { valid(Number.isSafeInteger(item.id) && item.account_id === 98462 && !branches.has(item.id), 'native employer/branch identity changed'); branches.set(item.id, item) }
  for (const item of payload.job_roles) { valid(Number.isSafeInteger(item.id) && clean(item.name) && !roles.has(item.id), 'native department identity ambiguous'); roles.set(item.id, item) }
  for (const row of payload.jobs) {
    valid(Number.isSafeInteger(row.id) && row.id > 0 && /^[a-z0-9]+$/i.test(row.unique_id || '') && clean(row.title) && !rows.has(row.unique_id), 'native posting identity missing or duplicated')
    const known = new Set(['id', 'title', 'description', 'no_of_openings', 'job_type', 'status', 'position_level', 'ctc_details', 'deleted', 'closing_date', 'created_at',
      'show_position_in_portal', 'url', 'unique_id', 'show_ctc_in_portal', 'remote', 'skip_assign_requisition_for_applicants', 'branch_id', 'jt_job_id', 'custom_field_attributes', 'preferred_remote_job_locations', 'job_role_id'])
    const issues = []
    if (Object.keys(row).some(key => !known.has(key))) issues.push('unverified-native-role-fields')
    if (row.custom_field_attributes != null && (typeof row.custom_field_attributes !== 'object' || Object.keys(row.custom_field_attributes).length)) issues.push('unverified-native-custom-fields')
    const branch = branches.get(row.branch_id), department = roles.get(row.job_role_id)
    if (!branch || !department || branch.deleted || department.deleted) issues.push('native-role-office-or-department-unresolved')
    for (const issue of issues) reasons.add(issue + ':' + row.unique_id)
    const target = new URL(row.url || '', C)
    valid(target.origin === new URL(C).origin && target.pathname === new URL(C).pathname && target.searchParams.get('jobId') === row.unique_id && [...target.searchParams.keys()].every(key => key === 'jobId'), 'native role canonical handoff changed')
    rows.set(row.unique_id, { row, branch, department, issues })
  }
  return rows
}
const readBoard = (html, rows, reasons, refs) => {
  const doc = inspect(html, B + '/jobs', reasons, refs), links = new Map()
  const container = one(doc.nodes(n => n.attrs['data-portal-id'] === 'job-role-list'), 'public native list')
  for (const node of all(container).filter(n => !n.inert && n.tag === 'a' && n.attrs.href && /\/jobs\//.test(n.attrs.href))) {
    const url = roleURL(node.attrs.href), id = new URL(url).pathname.split('/')[2]
    if (links.has(id) && links.get(id) !== url) reasons.add('ambiguous-native-role-path')
    links.set(id, url)
    const title = all(node).find(n => cls(n, 'job-title'))
    if (!rows.has(id) || clean(doc.text(title)) !== clean(rows.get(id).row.title)) reasons.add('native-board-and-feed-role-conflict')
  }
  if (links.size !== rows.size || [...rows.keys()].some(id => !links.has(id))) reasons.add('native-board-and-feed-membership-conflict')
  const groups = new Map()
  for (const node of all(container).filter(n => !n.inert && /^_role_\d+$/.test(n.attrs['data-portal-role'] || ''))) {
    const id = Number(node.attrs['data-portal-role'].slice(6)), counters = all(node).filter(n => !n.inert && ['jobs-count', 'mobile-jobs-count'].includes(n.attrs['data-portal-id']))
    const expected = [...rows.values()].filter(value => value.row.job_role_id === id).length
    // Current SSR counters are blank; the native client computes them from
    // cards. A literal counter, if supplied, must agree rather than being ignored.
    if (counters.length !== 2 || groups.has(id) || counters.some(n => doc.text(n) && (!/^\d+$/.test(doc.text(n)) || Number(doc.text(n)) !== expected))) reasons.add('native-department-count-conflict')
    groups.set(id, expected)
  }
  if ([...rows.values()].some(value => !groups.has(value.row.job_role_id))) reasons.add('native-department-scope-missing')
  return links
}
const date = (value, reasons, label) => {
  if (value == null || value === '') return null
  const explicit = typeof value === 'string' && (/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?(?:Z|[+-]\d\d:\d\d)$/.test(value) || /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d UTC$/.test(value))
  if (!explicit || !Number.isFinite(Date.parse(value))) { reasons.add('unknown-native-' + label + '-precision'); return null }
  return new Date(value).toISOString()
}
const detail = (html, url, native, checkedAt, reasons, refs) => {
  const doc = inspect(html, url, reasons, refs), visible = presentation(doc), { row, branch, department } = native, problems = new Set(native.issues)
  const posting = one(structured(doc).filter(value => value['@type'] === 'JobPosting'), 'native posting schema')
  const title = clean(doc.text(one(doc.nodes(n => n.tag === 'h1'), 'native role title')))
  if (posting.hiringOrganization?.name !== 'Bito' || title !== clean(row.title) || clean(posting.title) !== title
    || new URL(posting.url, B).origin !== B || new URL(posting.url, B).pathname.split('/')[2] !== row.unique_id) problems.add('native-role-employer-or-title-conflict')
  const container = one(doc.nodes(n => cls(n, 'job-details-content')), 'native full role content')
  const displayed = visible.nodes(n => cls(n, 'job-details-content'))[0]
  const parts = children(displayed).filter(n => !cls(n, 'application-form') && !all(n).some(c => c.tag === 'form'))
  const full = clean(parts.map(n => visible.text(n)).join(' ')), feedBody = body(row.description), schemaBody = body(posting.description)
  const completeBody = Boolean(feedBody && schemaBody && compact(full) === compact(feedBody) && compact(full) === compact(schemaBody))
  if (!completeBody) problems.add('native-full-description-incomplete')
  if (/\bthis\s+(?:job|role|position)\s+(?:(?:is|has been)\s+)?(?:no longer accepting applications|closed|filled|expired|no longer available)\b/i.test(visible.text(visible.nodes(n => n.tag === 'root')[0]))) problems.add('visible-native-role-closed')
  const header = one(doc.nodes(n => cls(n, 'stick-hide-in-mobile')), 'native location and work type'), headerText = doc.text(header)
  const location = headerText.match(/(?:Preferable )?Location\(s\):\s*(.*?)\s*Work Type:/i)?.[1]
  const visibleType = headerText.match(/Work Type:\s*(.*)$/i)?.[1], expectedType = ({ 1: 'Contract', 2: 'Full Time', 3: 'Intern', 4: 'Part Time', 5: 'Temporary', 6: 'Seasonal', 8: 'Fixed Term Contract', 9: 'Secondment' })[row.job_type]
  if (!expectedType || clean(visibleType) !== expectedType) problems.add('native-employment-type-conflict')
  if (fold(posting.employmentType).replaceAll('_', ' ').replaceAll('-', ' ') !== fold(expectedType)) problems.add('native-structured-employment-conflict')
  if (![true, false].includes(row.remote) || String(posting.remote) !== String(row.remote)) problems.add('native-remote-mode-conflict')
  const locationText = row.remote === true ? row.preferred_remote_job_locations : branch?.location
  const work = scopes(locationText)
  if (!work.length || work.some(scope => !scope.country) || clean(location) !== clean(locationText)) problems.add('native-work-country-or-location-unresolved')
  if (row.remote !== true && country(branch?.country_code) !== work[0]?.country) problems.add('native-office-country-conflict')
  const addresses = (Array.isArray(posting.jobLocation) ? posting.jobLocation : [posting.jobLocation]).filter(Boolean).map(place => place.address)
  const structuredCountries = [...new Set(addresses.map(address => country(address?.addressCountry)).filter(Boolean))].sort(), workCountries = [...new Set(work.map(scope => scope.country).filter(Boolean))].sort()
  if (addresses.some(address => !country(address?.addressCountry)) || structuredCountries.length && stable(structuredCountries) !== stable(workCountries)) problems.add('native-work-and-structured-country-conflict')
  const posted = date(posting.datePosted, problems, 'publication'), closing = date(row.closing_date ?? posting.validThrough, problems, 'deadline')
  if (row.closing_date && posting.validThrough && date(posting.validThrough, problems, 'deadline') !== closing) problems.add('native-deadline-conflict')
  if (closing && Date.parse(closing) <= Date.parse(checkedAt) || row.deleted !== false || row.status !== 2 || row.show_position_in_portal === false) problems.add('native-role-expired-or-unpublished')
  const apply = one(doc.nodes(n => n.tag === 'a' && n.attrs.href === '#applicant-form'), 'native application entry')
  const form = one(doc.nodes(n => n.tag === 'form' && n.attrs.action?.startsWith('/jobs/')), 'native public application form')
  if (visible.nodes(n => n.tag === 'a' && n.attrs.href === '#applicant-form').length !== 1
    || visible.nodes(n => n.tag === 'form' && n.attrs.action === form.attrs.action).length !== 1) problems.add('native-application-entry-or-form-hidden')
  if (form.attrs.action !== '/jobs/' + row.unique_id + '/applicants' || form.attrs.method?.toLowerCase() !== 'post') problems.add('native-application-identity-conflict')
  for (const problem of problems) reasons.add(problem + ':' + row.unique_id)
  const india = work.filter(scope => scope.country === 'IN')
  return { source: 'bito', company: 'Bito', jobId: row.unique_id, requisitionId: null, title, department: department?.name || null,
    country: india.length ? 'India' : null, location: india.map(scope => scope.label).join(' | ') || clean(locationText), locations: india.map(scope => scope.label),
    city: india.length === 1 && india[0].label.includes(',') ? india[0].label.split(',')[0].trim() : null, state: null,
    remoteStatus: row.remote === true ? 'Remote' : row.remote === false ? 'On-site' : null, employmentType: expectedType || null, experienceRequired: null, requiredSkills: [],
    sourceUrl: url, applyUrl: new URL(apply.attrs.href, url).href, link: new URL(apply.attrs.href, url).href, postingDate: posted, closingDate: closing,
    sourcePublicationDateUnavailable: !posted, jobDescription: completeBody ? full : null, sourceDescription: completeBody ? full : null,
    sourceDetailComplete: completeBody, sourceDetailFailureKind: completeBody ? null : 'missing-content', nativeDescriptionSHA256: completeBody ? hash(full) : null,
    sourceNativeDates: { datePosted: posting.datePosted ?? null, createdAt: row.created_at ?? null, validThrough: posting.validThrough ?? null, closingDate: row.closing_date ?? null },
    sourceNativeIdentity: { internalJobId: row.id, publicPostingId: row.unique_id, accountId: branch?.account_id ?? null, branchId: row.branch_id },
    sourceNativeCountryEvidence: { workScopes: work, workCountries, structuredCountries, officeCountry: branch?.country_code ?? null, preferredRemoteJobLocations: row.preferred_remote_job_locations ?? null },
    sourceNativeApplicationEvidence: { formAction: new URL(form.attrs.action, B).href, formMethod: 'post', submitted: false, declaredPublicJobUrl: row.url },
    safe: problems.size === 0 }
}
const defaultFetchPage = async (url, init) => { const response = await fetch(url, { ...init, redirect: 'follow' }); return { status: response.status, url: response.url, contentType: response.headers.get('content-type'), body: await response.text() } }
export const createBitoNativeInventory = (defaults = {}) => ({ async run(options = {}) {
  const settings = { ...defaults, ...options }, load = settings.fetchPage || defaultFetchPage, signal = settings.signal, reasons = new Set(), refs = new Set(), maxJobs = settings.maxJobs ?? 0
  valid(!settings.fetchText || settings.fetchPage, 'current transport requires fetchPage'); valid(Number.isSafeInteger(maxJobs) && maxJobs >= 0, 'invalid output budget')
  const interval = settings.requestIntervalMs ?? 1000, lastRequest = new Map()
  valid(Number.isFinite(interval) && interval >= 0 && interval <= 60000, 'invalid public request interval')
  const now = () => new Date((settings.now || (() => new Date().toISOString()))()).toISOString(); let requests = 0
  const pageAt = async (url, kind) => {
    signal?.throwIfAborted()
    const origin = new URL(url).origin, wait = Math.max(0, interval - (Date.now() - (lastRequest.get(origin) || 0)))
    if (wait) await pause(wait, undefined, { signal })
    signal?.throwIfAborted(); lastRequest.set(origin, Date.now())
    const response = await load(url, { method: 'GET', headers: { Accept: kind === 'json' ? 'application/json' : kind === 'js' ? 'application/javascript' : 'text/html' },
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000) })
    signal?.throwIfAborted(); requests++
    if (response?.status !== 200) { const error = new Error('Bito public HTTP ' + response?.status); error.status = response?.status; error.abortRetries = true; throw error }
    valid(response.url === url && typeof response.body === 'string' && Buffer.byteLength(response.body) <= 8 * 1024 * 1024, 'public response identity or size changed')
    const knownClassicPlainScript = kind === 'js' && url === W && /^text\/plain\b/i.test(response.contentType || '')
    valid(knownClassicPlainScript || (kind === 'json' ? /^application\/json\b/i : kind === 'js' ? /^(?:application|text)\/(?:javascript|ecmascript)\b/i : /^text\/html\b/i).test(response.contentType || ''), 'public response content type changed')
    return kind === 'json' ? parse(response.body) : response.body
  }
  const readScope = async () => {
    const identity = corporate(await pageAt(C), reasons, refs)
    const bootstrapHash = hash(await pageAt(W, 'js')), clientHash = hash(await pageAt(J, 'js'))
    if (bootstrapHash !== hashes.bootstrap || clientHash !== hashes.client) { identity.publisherVerified = false; reasons.add('native-widget-client-contract-changed') }
    const rows = readFeed(await pageAt(F, 'json'), reasons), links = readBoard(await pageAt(B + '/jobs'), rows, reasons, refs), details = new Map()
    for (const [id, row] of rows) if (links.has(id)) details.set(id, detail(await pageAt(links.get(id)), links.get(id), row, now(), reasons, refs))
    return { identity, rows, links, details }
  }
  const initial = await readScope(), closing = await readScope()
  const state = value => stable(value && { row: value.row, branch: value.branch, department: value.department })
  if (initial.identity.state !== closing.identity.state) reasons.add('closing-corporate-widget-identity-changed')
  if (initial.rows.size !== closing.rows.size || [...initial.rows].some(([id, row]) => state(row) !== state(closing.rows.get(id)))) reasons.add('closing-native-inventory-changed')
  if ([...initial.details].some(([id, value]) => stable(value) !== stable(closing.details.get(id)))) reasons.add('closing-native-role-document-changed')
  if ([...refs].some(id => !initial.rows.has(id) || !closing.rows.has(id))) reasons.add('unreconciled-native-role-reference')
  const healthy = [...initial.details].filter(([id, row]) => initial.identity.publisherVerified && closing.identity.publisherVerified && row.safe && row.country === 'India'
    && state(initial.rows.get(id)) === state(closing.rows.get(id)) && stable(row) === stable(closing.details.get(id))).map(([, row]) => row)
  const selected = maxJobs ? healthy.slice(0, maxJobs) : healthy
  if (selected.length !== healthy.length) reasons.add('source-job-limit')
  const complete = reasons.size === 0, at = now()
  for (const row of selected) { delete row.safe; Object.assign(row, { scrapedAt: at, companyCareerPage: C, companyDomain: 'bito.ai', atsPlatform: 'freshteam', sourceListingComplete: complete, sourceScopeComplete: complete, lifecycleCleanupAllowed: complete }) }
  await settings.onAudit?.({ nativeTotal: initial.rows.size, closingNativeTotal: closing.rows.size, complete, requests, reasons: [...reasons],
    roleDocuments: [...initial.details.values()].map(row => ({ id: row.jobId, title: row.title, fullDescription: row.sourceDetailComplete, descriptionCharacters: row.jobDescription?.length || 0,
      workCountries: row.sourceNativeCountryEvidence.workCountries, structuredCountries: row.sourceNativeCountryEvidence.structuredCountries, nativeDates: row.sourceNativeDates, sourceUrl: row.sourceUrl })) })
  return attachInventoryEvidence(selected, { status: complete ? initial.rows.size ? 'complete-inventory' : 'verified-empty' : 'discovery-only', firstParty: true, surface: C,
    listingComplete: complete, pagesFetched: requests, reportedTotal: complete ? initial.rows.size : null, indiaFacetCount: complete ? healthy.length : null, verifiedAt: at,
    reason: complete ? 'bito-complete-native-feed-and-role-documents-reconciled' : 'bito-native-incomplete:' + [...reasons].join(';') })
} })
