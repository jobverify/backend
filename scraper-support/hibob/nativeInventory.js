import { createHash } from 'node:crypto'
import { readVisibleNativeDocument } from '../utils/visibleNativeHtml.js'
import { decodeNativeEntities, extractActiveDescription } from '../utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../utils/inventoryEvidence.js'

const clean = value => decodeNativeEntities(value).replace(/\s+/g, ' ').trim()
const fold = value => clean(value).toLowerCase()
const digest = value => createHash('sha256').update(value).digest('hex')
const text = html => { const doc = readVisibleNativeDocument(String(html ?? '')); return doc.text(doc.nodes(n => n.tag === 'root')[0]) }
const body = html => extractActiveDescription(text(html))
const sections = ['description', 'responsibilities', 'requirements', 'benefits', 'payTransparencySalaryAdditionalInfo']
const compensation = ['payTransparencyMinSalary', 'payTransparencyMaxSalary', 'payTransparencySalaryCurrency', 'payTransparencySalaryPayPeriod']
const names = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' }), countries = new Map()
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const code = String.fromCharCode(a, b), name = names.of(code)
  if (name && !['ZZ', 'XA', 'XB', 'UN', 'EU', 'EZ', 'QO'].includes(code)) { countries.set(fold(code), code); countries.set(fold(name), code) }
}
for (const [label, code] of [['USA', 'US'], ['United States of America', 'US'], ['UK', 'GB']]) countries.set(fold(label), code)
const country = value => countries.get(fold(value)) || null
class HiBobNativeIdentityError extends Error {
  constructor(message) { super('HiBob native identity: ' + message); this.name = 'HiBobNativeIdentityError'; this.abortRetries = true }
}
const valid = (condition, message) => { if (!condition) throw new HiBobNativeIdentityError(message) }
const parse = value => { try { return JSON.parse(value) } catch { throw new HiBobNativeIdentityError('invalid public JSON') } }
const stable = value => JSON.stringify(value, (_, item) => item && !Array.isArray(item) && typeof item === 'object'
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)
const publicClient = 'https://front.hibob.com/master-f3e47d913007c1af6a44ad77d2d2c799c1f4e112/careers/'
const clients = ['runtime.dcc39325e5189cc8.js', 'polyfills.a7632ba8419ce340.js', 'main.f37edcc582286c3b.js'].map(path => publicClient + path)
const ats = /(?:careers\.hibob\.com|myworkdayjobs\.com|greenhouse\.io|lever\.co|jobs\.ashbyhq\.com|workable\.com|smartrecruiters\.com|successfactors\.|recruitee\.com|bamboohr\.com|careers-page\.com|dayforcehcm\.com|zappyhire\.com|oraclecloud\.com|icims\.com|jobvite\.com)/i
const inspect = (html, config, reasons, board = false, references = new Set()) => {
  const doc = readVisibleNativeDocument(html)
  if (doc.frames().some(frame => Object.hasOwn(frame.attrs, 'srcdoc') || !frame.attrs.src)) reasons.add('additional-unresolved-active-frame')
  for (const anchor of doc.nodes(n => n.tag === 'a' && n.attrs.href && /\b(?:careers?|jobs?|vacancies|openings|open roles)\b/i.test(doc.text(n)))) {
    let target; try { target = new URL(anchor.attrs.href, board ? config.board : config.careers) } catch { reasons.add('additional-unresolved-hiring-link'); continue }
    const withoutHash = url => { const parsed = new URL(url); parsed.hash = ''; return parsed.href }
    if (target.protocol === 'https:' && target.origin === new URL(config.board).origin) continue
    if (withoutHash(target.href) !== withoutHash(config.careers)) reasons.add('additional-active-hiring-link')
  }
  const candidates = [...doc.nodes(n => ['a', 'script'].includes(n.tag)), ...doc.frames()].flatMap(n => {
    const values = [n.attrs.href, n.attrs.src].filter(Boolean)
    if (n.tag === 'script' && !n.attrs.src && !Object.hasOwn(n.attrs, 'nomodule') && /^(?:|(?:text|application)\/(?:javascript|ecmascript)|module)$/i.test(n.attrs.type || '')) {
      values.push(...(n.raw || '').replace(/\\\//g, '/').matchAll(/https?:\/\/[^\s"'<>`\\]+/g).map(m => m[0]))
    }
    return values
  })
  for (const candidate of candidates) {
    let url; try { url = new URL(candidate, board ? config.board : config.careers) } catch { continue }
    if (url.origin === new URL(config.board).origin && !url.search && !url.username && !url.password) {
      const role = url.pathname.match(/^\/jobs\/([a-f0-9-]+)(?:\/(?:overview|apply))?\/?$/i)
      if (role) references.add(role[1])
      else if (!['/', '/jobs', '/jobs/'].includes(url.pathname)) reasons.add('additional-unverified-native-route')
      continue
    }
    if (ats.test(url.hostname) || /\/(?:jobs?|open-positions|vacancies)(?:\/|$)/i.test(url.pathname) && !['front.hibob.com'].includes(url.hostname)) reasons.add('additional-active-careers-scope')
  }
  if (board) {
    const active = doc.nodes(n => n.tag === 'script' && n.attrs.src && !Object.hasOwn(n.attrs, 'nomodule')
      && /^(?:|(?:text|application)\/(?:javascript|ecmascript)|module)$/i.test(n.attrs.type || '')).map(n => n.attrs.src)
    if (!clients.every(url => active.includes(url))) reasons.add('public-client-contract-changed')
  }
  return doc
}
const date = (value, reasons, label) => {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?(?:Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value))) {
    reasons.add('invalid-or-imprecise-native-' + label); return null
  }
  return new Date(value).toISOString()
}
const rowFields = new Set(['id', 'title', 'departmentId', 'department', 'employmentTypeId', 'employmentType', 'siteId', 'site', 'country', 'language',
  ...sections, 'sectionLabels', 'publishedAt', 'workspaceTypeId', 'workspaceType', 'payTransparencyMinSalary', 'payTransparencyMaxSalary',
  'payTransparencySalaryCurrency', 'payTransparencySalaryPayPeriod', 'payTransparencySalaryAdditionalInfo', 'requisitionId', 'validThrough', 'closingDate', 'companyName', 'isActive', 'status'])
const readFeed = (payload, config, reasons, now) => {
  valid(payload && Array.isArray(payload.jobAdDetails) && payload.filterGroups && typeof payload.filterGroups === 'object', 'public job feed schema changed')
  if (Object.keys(payload).some(k => !['jobAdDetails', 'filterGroups', 'jobOpeningMetadata'].includes(k))
    || payload.jobOpeningMetadata != null && (!Array.isArray(payload.jobOpeningMetadata) || payload.jobOpeningMetadata.length)) reasons.add('unverified-public-feed-scope-or-pagination')
  valid(payload.jobAdDetails.length <= 2000, 'public inventory budget exceeded')
  const fields = [['departments', 'departmentId', 'department'], ['sites', 'siteId', 'site'], ['jobTypes', 'employmentTypeId', 'employmentType'], ['workspaceTypes', 'workspaceTypeId', 'workspaceType']]
  const groups = new Map(fields.map(([group]) => {
    valid(Array.isArray(payload.filterGroups[group]), 'public filter group missing')
    const map = new Map()
    for (const item of payload.filterGroups[group]) { valid(item && item.serverId != null && clean(item.value) && !map.has(String(item.serverId)), 'public filter identity ambiguous'); map.set(String(item.serverId), clean(item.value)) }
    return [group, map]
  }))
  if (Object.keys(payload.filterGroups).some(k => !groups.has(k))) reasons.add('additional-public-filter-scope')
  const rows = new Map()
  for (const raw of payload.jobAdDetails) {
    valid(raw && typeof raw.id === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(raw.id) && clean(raw.title), 'public posting identity missing')
    valid(!rows.has(raw.id), 'duplicate public posting identity')
    const problems = new Set()
    if (Object.keys(raw).some(k => !rowFields.has(k))) problems.add('unverified-native-role-fields')
    if (raw.companyName != null && fold(raw.companyName) !== fold(config.company)) problems.add('native-employer-conflict')
    for (const [group, id, label] of fields) if (groups.get(group).get(String(raw[id])) !== clean(raw[label])) problems.add('native-filter-identity-conflict')
    const code = country(raw.country), siteCountry = country(raw.site)
    if (!code) problems.add('unresolved-native-country')
    if (siteCountry && siteCountry !== code) problems.add('native-site-country-conflict')
    const nativeSections = Object.fromEntries(sections.map(k => [k, body(raw[k])]))
    if (!nativeSections.description || sections.some(k => raw[k] != null && clean(raw[k]) && !nativeSections[k])) problems.add('native-full-description-incomplete')
    const posted = date(raw.publishedAt, problems, 'publication-date'), deadline = date(raw.validThrough ?? raw.closingDate, problems, 'deadline')
    if (raw.validThrough && raw.closingDate && date(raw.closingDate, problems, 'deadline') !== deadline) problems.add('native-deadline-conflict')
    const expired = Boolean(deadline && Date.parse(deadline) <= Date.parse(now))
    if (expired || raw.isActive === false || raw.status && !/^(?:active|published|open)$/i.test(raw.status)) problems.add('native-role-expired-or-closed')
    for (const problem of problems) reasons.add(problem + ':' + raw.id)
    rows.set(raw.id, { raw, code, posted, deadline, nativeSections, safe: !problems.size, expired })
  }
  return rows
}
const readForm = (payload, row, reasons) => {
  const job = payload?.data?.jobAd, raw = row.raw, fail = () => { reasons.add('native-public-role-or-application-mismatch:' + raw.id); return null }
  const fields = new Set(['applicationForm', 'jobDescription', 'type', 'title', 'site', 'languageCode', 'employmentType', 'workspaceType'])
  if (!job || Object.keys(job).some(k => !fields.has(k)) || job.type !== 'api' || clean(job.title) !== clean(raw.title) || clean(job.site) !== clean(`${raw.site}, ${raw.country}`)
    || clean(job.employmentType) !== clean(raw.employmentType) || clean(job.workspaceType) !== clean(raw.workspaceType)
    || job.languageCode !== raw.language || !Number.isSafeInteger(job.applicationForm?.id) || job.applicationForm.id <= 0
    || !['fields', 'documents', 'questions'].every(k => job.applicationForm['/applicationForm/' + k] && Array.isArray(job.applicationForm['/applicationForm/' + k].value))) return fail()
  const description = job.jobDescription
  if (!description || typeof description !== 'object') return fail()
  const allowed = new Set([...sections, ...compensation, 'sectionLabels'].map(k => '/jobAd/descriptionId./jobDescription/' + k))
  if (Object.keys(description).some(k => !allowed.has(k))) return fail()
  for (const key of sections) if (body(description['/jobAd/descriptionId./jobDescription/' + key]?.value) !== row.nativeSections[key]) return fail()
  for (const key of compensation) if ((description['/jobAd/descriptionId./jobDescription/' + key]?.value ?? null) !== (raw[key] ?? null)) return fail()
  if (stable(description['/jobAd/descriptionId./jobDescription/sectionLabels']?.value || {}) !== stable(raw.sectionLabels || {})) return fail()
  return { id: job.applicationForm.id, description: row.nativeSections }
}
const defaultFetchPage = async (url, init) => {
  const response = await fetch(url, { ...init, redirect: 'follow' })
  return { status: response.status, url: response.url, contentType: response.headers.get('content-type'), body: await response.text() }
}
export const createHiBobNativeInventory = (config, defaults = {}) => {
  valid(new URL(config.board).hostname === config.source + '.careers.hibob.com' && new URL(config.board).pathname === '/' && !new URL(config.board).search, 'bound public tenant changed')
  return { async run(options = {}) {
    const settings = { ...defaults, ...options }, signal = settings.signal, load = settings.fetchPage || defaultFetchPage, maxJobs = settings.maxJobs ?? 0
    valid(!settings.fetchText && !settings.fetchJson, 'current public transport requires fetchPage with response identity')
    valid(Number.isSafeInteger(maxJobs) && maxJobs >= 0, 'invalid output budget')
    const now = () => new Date((settings.now || (() => new Date().toISOString()))()).toISOString(), reasons = new Set(), references = new Set()
    let requests = 0
    const pageAt = async (url, json = false) => {
      signal?.throwIfAborted()
      const response = await load(url, { method: 'GET', headers: { Accept: json ? 'application/json' : 'text/html', ...(json ? { companyIdentifier: config.source } : {}) },
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000) })
      signal?.throwIfAborted(); requests++
      if (response?.status !== 200) { const error = new Error('HiBob public HTTP ' + response?.status); error.status = response?.status; error.abortRetries = true; throw error }
      valid(config.redirectHandoff && url === config.careers ? response.url === config.board : response.url === url, 'public response employer redirect changed')
      valid(typeof response.body === 'string' && Buffer.byteLength(response.body) <= 8 * 1024 * 1024
        && (json ? /^application\/json\b/i : /^text\/html\b/i).test(response.contentType || ''), 'public response format changed')
      return json ? parse(response.body) : response.body
    }
    const readScope = async () => {
      const html = await pageAt(config.careers), doc = inspect(html, config, reasons, config.redirectHandoff, references)
      if (!config.redirectHandoff) valid(doc.nodes(n => n.tag === 'a' && n.attrs.href === config.board && doc.text(n)).length > 0, 'first-party employer handoff missing')
      inspect(await pageAt(config.board), config, reasons, true, references)
      const site = await pageAt(config.board + 'api/career-site', true)
      valid(site.companyName === config.company && site.isPublished === true && site.isBobCareerSite === true && Array.isArray(site.sections), 'public employer site binding changed')
      if (!site.sections.some(section => section.type === 'job_listing')) reasons.add('native-job-listing-section-missing')
      const inspectConfig = value => {
        if (Array.isArray(value)) return value.forEach(inspectConfig)
        if (value && typeof value === 'object') return Object.values(value).forEach(inspectConfig)
        if (typeof value === 'string') inspect(/^https?:\/\//.test(value) ? '<a href="' + value.replaceAll('"', '&quot;') + '">Native configuration link</a>' : value, config, reasons, false, references)
      }
      inspectConfig(site.sections)
      return { site: { companyName: site.companyName, isPublished: site.isPublished, isBobCareerSite: site.isBobCareerSite, language: site.language,
        sections: site.sections }, rows: readFeed(await pageAt(config.board + 'api/job-ad', true), config, reasons, now()) }
    }
    const formsFor = async rows => {
      const forms = new Map()
      for (const [id, row] of rows) if (row.code === 'IN' && row.safe) forms.set(id, readForm(await pageAt(config.board + 'api/job-ad/' + id + '/application-form', true), row, reasons))
      return forms
    }
    const initial = await readScope(), forms = await formsFor(initial.rows), closing = await readScope(), closingForms = await formsFor(closing.rows)
    if (stable(initial.site) !== stable(closing.site)) reasons.add('closing-native-employer-site-changed')
    if (initial.rows.size !== closing.rows.size || [...initial.rows].some(([id, row]) => stable(row.raw) !== stable(closing.rows.get(id)?.raw))) reasons.add('closing-native-inventory-changed')
    if ([...forms].some(([id, form]) => stable(form) !== stable(closingForms.get(id)))) reasons.add('closing-native-application-changed')
    if ([...references].some(id => !initial.rows.has(id) || !closing.rows.has(id))) reasons.add('unreconciled-native-role-reference')
    const jobs = []
    for (const [id, row] of initial.rows) {
      if (row.code !== 'IN' || !row.safe || !forms.get(id) || stable(row.raw) !== stable(closing.rows.get(id)?.raw)
        || stable(forms.get(id)) !== stable(closingForms.get(id))) continue
      const raw = row.raw, chunks = sections.filter(k => row.nativeSections[k]).map(k => (clean(raw.sectionLabels?.[k]) || ({ description: 'Job description', responsibilities: 'Responsibilities', requirements: 'Requirements', benefits: 'Benefits', payTransparencySalaryAdditionalInfo: 'Salary range' })[k]) + '\n' + row.nativeSections[k])
      const description = chunks.join('\n\n'), location = fold(raw.site) === fold(raw.country) ? clean(raw.country) : clean(raw.site) + ', ' + clean(raw.country)
      jobs.push({ source: config.source, company: config.company, jobId: id, requisitionId: clean(raw.requisitionId) || null, title: clean(raw.title), department: clean(raw.department) || null,
        country: 'India', location, city: null, state: null, employmentType: clean(raw.employmentType) || null, experienceRequired: null, requiredSkills: [],
        remoteStatus: ({ remote: 'Remote', hybrid: 'Hybrid', on_site: 'On-site' })[raw.workspaceTypeId] || null,
        sourceUrl: config.board + 'jobs/' + id + '/overview', applyUrl: config.board + 'jobs/' + id + '/apply', link: config.board + 'jobs/' + id + '/apply',
        postingDate: row.posted, closingDate: row.deadline, sourcePublicationDateUnavailable: !row.posted, jobDescription: description, sourceDescription: description,
        sourceDetailComplete: true, sourceDetailFailureKind: null, nativeDescriptionSHA256: digest(description),
        sourceNativeDates: { publishedAt: raw.publishedAt ?? null, validThrough: raw.validThrough ?? raw.closingDate ?? null },
        sourceNativeSections: row.nativeSections, sourceNativeCountryEvidence: { country: raw.country, site: raw.site, siteId: raw.siteId, countryCode: row.code },
        sourceNativeCompensationEvidence: Object.fromEntries(compensation.map(key => [key, raw[key] ?? null])),
        sourceNativeEmployerEvidence: { companyName: config.company, publicTenant: config.source, firstPartyCareers: config.careers },
        sourceNativeApplicationEvidence: { publicFormId: forms.get(id).id, route: 'public-job-ad-application-form', submitted: false } })
    }
    const selected = maxJobs ? jobs.slice(0, maxJobs) : jobs
    if (selected.length !== jobs.length) reasons.add('source-job-limit')
    const complete = reasons.size === 0, at = now()
    for (const job of selected) Object.assign(job, { scrapedAt: at, companyCareerPage: config.careers, companyDomain: config.domain, atsPlatform: 'hibob',
      sourceListingComplete: complete, sourceScopeComplete: complete, lifecycleCleanupAllowed: complete })
    return attachInventoryEvidence(selected, { status: complete ? initial.rows.size ? 'complete-inventory' : 'verified-empty' : 'discovery-only', surface: config.board,
      firstParty: true, listingComplete: complete, reportedTotal: complete ? initial.rows.size : null, indiaFacetCount: complete ? jobs.length : null,
      pagesFetched: requests, verifiedAt: at, reason: complete ? 'hibob-complete-public-feed-and-India-role-documents-reconciled' : 'hibob-native-incomplete:' + [...reasons].join(';') })
  } }
}
