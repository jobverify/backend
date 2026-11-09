import { parse } from 'acorn'
import { createHash } from 'node:crypto'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { nativeCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { projectBirlaCriteria, createBirlaRendererContext } from './nativeCriteria.js'
import { withCallerSignal } from './callerSignal.js'
export { createBirlaRendererContext } from './nativeCriteria.js'

const ORIGIN = 'https://careers.adityabirla.com'
const proof = (condition, message) => { if (!condition) throw new Error('Aditya Birla native: ' + message) }
const norm = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const validCount = value => Number.isSafeInteger(value) && value >= 0 && value <= 100000
const pageUrl = page => ORIGIN + '/api/v3/jobs?offset=' + page + '&limit=20'

// Read only literal top-level React flight pushes. Downloaded JavaScript is
// parsed as syntax; neither page code nor expressions are executed.
export function publicPayloads(html) {
  const doc = document(html), payloads = []
  for (const node of doc.nodes(node => node.tag === 'script' && !node.attrs.src)) {
    let program
    try { program = parse(node.raw || '', { ecmaVersion: 'latest' }) } catch { continue }
    for (const statement of program.body) {
      const call = statement.type === 'ExpressionStatement' ? statement.expression : null
      const member = call?.type === 'CallExpression' ? call.callee : null
      if (member?.type !== 'MemberExpression' || member.computed || member.property.name !== 'push'
        || member.object?.type !== 'MemberExpression' || member.object.computed || member.object.property.name !== '__next_f'
        || member.object.object?.name !== 'self') continue
      const value = call.arguments[0]
      if (call.arguments.length === 1 && value?.type === 'ArrayExpression' && value.elements.length === 2
        && value.elements[0]?.value === 1 && value.elements[1]?.type === 'Literal' && typeof value.elements[1].value === 'string') payloads.push(value.elements[1].value)
    }
  }
  return payloads
}

function publicToken(html) {
  const tokens = new Set(publicPayloads(html).flatMap(payload => [...payload.matchAll(/"token":"([\w.-]{32,4096})"/g)].map(match => match[1])))
  proof(tokens.size === 1, 'current anonymous public-page token unavailable or ambiguous')
  return [...tokens][0]
}

function clientUrl(html, pattern) {
  const doc = document(html)
  const scripts = doc.nodes(node => node.tag === 'script' && pattern.test(node.attrs.src || '')).map(node => new URL(node.attrs.src, ORIGIN))
  proof(scripts.length === 1 && scripts[0].origin === ORIGIN, 'current first-party client unavailable or ambiguous')
  return scripts[0].href
}

function roleIdentity(row) {
  return digest([row.id, row.jobCode, row.jobTitle, row.organizationUnit, row.organizationUnitComplete,
    row.locationHierarchyComplete, row.jobPostedDate, row.jobClosureDate, row.jobDescription, row.jobDetailUrl,
    row.expRange, row.minExp, row.maxExp, row.designation, row.skills, row.requisitionId, row.requisitionCode, row.functionalArea, row.role])
}

export function mapBirlaRole(row, { rendererContext } = {}) {
  proof(Number.isSafeInteger(row.id) && row.id > 0 && /^ABG\d+$/.test(row.jobCode || '') && norm(row.jobTitle), 'invalid native role identity')
  proof(norm(row.organizationUnit) && norm(row.organizationUnitComplete), 'native group organisation hierarchy absent')
  const apply = new URL(row.jobDetailUrl)
  proof(apply.origin === 'https://abgcareers.peoplestrong.com' && apply.pathname === '/job/detail/' + row.jobCode && !apply.search && !apply.hash, 'native role application identity changed')
  const hierarchy = norm(row.locationHierarchyComplete), country = nativeCountryName(hierarchy.split('>')[0])
  const projected = projectBirlaCriteria(row.jobDescription, rendererContext)
  const { transformations, ...projection } = projected
  const transformationCounts = {}
  for (const value of transformations) transformationCounts[value.reason] = (transformationCounts[value.reason] || 0) + 1
  const skills = row.skills || []
  proof(Array.isArray(skills) && skills.every(skill => typeof skill.value === 'string' && (!skill.jobId || skill.jobId === row.id)), 'native skill identity changed')
  const mandatory = skills.filter(skill => skill.type === 'musthave').map(skill => norm(skill.value))
  const preferred = skills.filter(skill => skill.type === 'goodtohave').map(skill => norm(skill.value))
  const other = skills.filter(skill => !['musthave', 'goodtohave'].includes(skill.type)).map(skill => norm(skill.value))
  const description = [projection.text, norm(row.expRange) ? 'Experience: ' + norm(row.expRange) : null,
    mandatory.length ? 'Required skills: ' + mandatory.join('; ') : null,
    preferred.length ? 'Preferred skills: ' + preferred.join('; ') : null,
    other.length ? 'Native skills: ' + other.join('; ') : null].filter(Boolean).join('\n\n')
  const contentComplete = projection.complete && hasSourceDescription({ jobDescription: projection.text })
  proof(typeof row.jobPostedDate === 'string' && Number.isFinite(Date.parse(row.jobPostedDate)), 'native publication date missing')
  proof(row.jobClosureDate == null || /^\d{4}-\d{2}-\d{2}$/.test(row.jobClosureDate) && Number.isFinite(Date.parse(row.jobClosureDate)), 'native closure date changed')
  const sourceUrl = ORIGIN + '/job-search/job-details/' + row.jobCode
  return { source: 'adityabirlagroup', company: 'Aditya Birla Group', companyDomain: 'adityabirla.com',
    companyCareerPage: ORIGIN + '/', atsPlatform: 'official-aditya-birla-native-api', title: norm(row.jobTitle),
    jobId: row.jobCode, postingId: row.jobCode, nativeJobCode: row.jobCode, requisitionCode: norm(row.requisitionCode) || null,
    requisitionId: Number.isSafeInteger(row.requisitionId) && row.requisitionId > 0 ? String(row.requisitionId) : null,
    sourceUrl, applyUrl: sourceUrl, link: sourceUrl, nativeApplyUrl: apply.href,
    nativeRecordId: row.id, nativeOrganizationHierarchy: row.organizationUnitComplete, nativeBusiness: row.organizationUnit,
    legalEmployer: null, department: norm(row.functionalArea) || null,
    location: hierarchy.replace(/>/g, ', '), city: null, country,
    sourceCountryEvidence: country ? { field: 'locationHierarchyComplete', raw: hierarchy, country, inference: false } : null,
    postingDate: row.jobPostedDate, postedAt: row.jobPostedDate, closingDate: row.jobClosureDate || null,
    nativePublicationPrecision: 'day', sourceClosingDateIsExact: false, experienceRequired: norm(row.expRange) || null,
    employmentType: null, minimumQualification: null, preferredQualification: null, requiredSkills: mandatory,
    nativeSkills: skills, jobDescription: description, sourceDescription: description,
    sourceAdditionalCriteria: { designation: row.designation, role: row.role, minExp: row.minExp, maxExp: row.maxExp,
      organisation: row.organizationUnit, functionalArea: row.functionalArea, nativeApplicationUrl: row.jobDetailUrl },
    nativeDescriptionHtml: row.jobDescription, sourceDetailComplete: contentComplete, sourceScopeComplete: false,
    sourceNativeDescriptionProjection: { ...projection, transformationCounts },
    sourceListingComplete: false, lifecycleCleanupAllowed: false }
}

async function verifyDetailModel(read, row) {
  const html = await read(ORIGIN + '/job-search/job-details/' + row.jobCode)
  const content = [], payloads = publicPayloads(html), bytes = Buffer.from(payloads.join('')), texts = new Map()
  let cursor = 0
  while (cursor < bytes.length) {
    const colon = bytes.indexOf(58, cursor)
    const resourceHint = colon === cursor && bytes.subarray(colon + 1, colon + 3).toString() === 'HL'
    proof(colon >= 0 && (resourceHint || /^[\da-f]+$/.test(bytes.subarray(cursor, colon).toString())), 'invalid native renderer wire record')
    const id = bytes.subarray(cursor, colon).toString()
    if (bytes[colon + 1] === 84) {
      const comma = bytes.indexOf(44, colon + 2), rawLength = bytes.subarray(colon + 2, comma).toString()
      proof(comma > colon && /^[\da-f]+$/.test(rawLength), 'invalid native renderer text length')
      const length = Number.parseInt(rawLength, 16), end = comma + 1 + length
      proof(length <= 8000000 && end <= bytes.length && !texts.has(id), 'truncated or duplicate native renderer text')
      texts.set(id, bytes.subarray(comma + 1, end).toString()); cursor = end
    } else {
      const end = bytes.indexOf(10, colon)
      proof(end >= 0, 'unterminated native renderer record'); cursor = end + 1
    }
  }
  const scan = value => {
    if (!value || typeof value !== 'object') return
    if (value.content?.jobCode === row.jobCode) content.push(value.content)
    for (const child of Object.values(value)) if (child && typeof child === 'object') scan(child)
  }
  for (const payload of payloads) for (const line of payload.split('\n')) {
    const json = line.match(/^[\da-f]+:(\[.*|\{.*)$/)?.[1]
    if (json) { try { scan(JSON.parse(json)) } catch { /* Other flight wire records are not role models. */ } }
  }
  const native = content[0], reference = native?.jobDescription?.match(/^\$([\da-f]+)$/)?.[1]
  if (reference) { proof(texts.has(reference), 'missing native criteria text reference'); native.jobDescription = texts.get(reference) }
  proof(content.length === 1 && roleIdentity({ ...native, skills: undefined }) === roleIdentity({ ...row, skills: undefined }), 'native full role renderer identity or criteria changed')
  if (Object.hasOwn(native, 'skills')) proof(digest(native.skills) === digest(row.skills), 'native role skills changed')
  const js = await read(clientUrl(html, /^\/_next\/static\/chunks\/app\/job-search\/job-details\/(?:%5Bslug%5D|\[slug\])\/page-[\w-]+\.js$/))
  proof(js.includes('jobDescription') && js.includes('dangerouslySetInnerHTML')
    && js.includes('https://abgcareers.peoplestrong.com/job/detail/'), 'full native role criteria renderer changed')
  const doc = document(html), stylesheets = []
  for (const node of doc.nodes(node => node.tag === 'link' && node.attrs.rel === 'stylesheet')) {
    const url = new URL(node.attrs.href, ORIGIN)
    proof(url.origin === ORIGIN && /^\/_next\/static\/css\/[a-f\d]+\.css$/.test(url.pathname) && !url.search && !url.hash, 'unreviewed native detail stylesheet origin')
    stylesheets.push({ url:url.href, body:await read(url.href) })
  }
  return createBirlaRendererContext({ stylesheets, client:js })
}

export async function readBirlaNativeJobs({ read, searchHtml, signal, maxPages = Infinity, maxJobs = Infinity, now = () => new Date().toISOString(), onAudit }) {
  const token = publicToken(searchHtml), auth = { headers: { Authorization: 'Bearer ' + token } }
  const js = await read(clientUrl(searchHtml, /^\/_next\/static\/chunks\/app\/job-search\/page-[\w-]+\.js$/))
  proof(['/api/v3/jobs?', '/api/v3/organisations', 'totalJobs', 'append("offset"', 'append("limit"', 'Authorization:"Bearer "'].every(value => js.includes(value)), 'current anonymous public recruiting protocol changed')
  const json = async url => JSON.parse(await read(url, auth))
  const organisations = await json(ORIGIN + '/api/v3/organisations')
  proof(organisations.status === 200 && Array.isArray(organisations.data), 'native organisation inventory absent')
  const counts = new Map()
  for (const row of organisations.data) {
    proof(norm(row.organisation) && validCount(row.jobs) && !counts.has(row.organisation), 'invalid native organisation count')
    counts.set(row.organisation, row.jobs)
  }
  const advertised = [...counts.values()].reduce((a, b) => a + b, 0)
  const traverse = async limitPages => {
    const first = await json(pageUrl(0)), rows = [], identities = new Map()
    proof(first.status === 200 && validCount(first.totalJobs), 'native inventory total unavailable')
    const total = first.totalJobs, finalPage = Math.ceil(total / 20), requested = Math.min(finalPage + 1, limitPages)
    const responses = new Map([[0, first]])
    let next = 1
    await Promise.all(Array.from({ length: Math.min(6, Math.max(0, requested - 1)) }, async () => {
      while (next < requested) { const page = next++; responses.set(page, await json(pageUrl(page))) }
    }))
    for (let page = 0; page < requested; page++) {
      const body = responses.get(page), expected = Math.max(0, Math.min(20, total - page * 20))
      proof(body?.status === 200 && body.totalJobs === total && Array.isArray(body.data)
        && body.count === body.data.length && body.data.length === expected, 'native page count, total or terminal inventory changed')
      for (const row of body.data) {
        proof(!identities.has(row.jobCode), 'duplicate native posting across inventory pages')
        identities.set(row.jobCode, roleIdentity(row)); rows.push(row)
      }
    }
    return { rows, identities, total, pagesFetched: requested, complete: requested === finalPage + 1 && rows.length === total }
  }
  const initial = await traverse(maxPages)
  proof(initial.total === advertised, 'native organisation and whole-inventory counts disagree')
  const actual = new Map()
  for (const row of initial.rows) actual.set(row.organizationUnit, (actual.get(row.organizationUnit) || 0) + 1)
  if (initial.complete) proof(actual.size === counts.size && [...counts].every(([name, total]) => actual.get(name) === total), 'native per-organisation inventory does not reconcile')
  const rendererContext = initial.rows.length ? await verifyDetailModel(read, initial.rows[0]) : null
  const mapped = initial.rows.map(row => mapBirlaRole(row,{ rendererContext })), partial = mapped.filter(job => !job.sourceDetailComplete), unknown = mapped.filter(job => !job.country)
  const candidates = mapped.filter(job => job.country === 'India' && job.sourceDetailComplete)
  const reasons = []
  if (!initial.complete) reasons.push('caller-page-cap')
  if (partial.length) reasons.push('native-empty-or-rendering-incomplete-criteria')
  if (unknown.length) reasons.push('native-country-unresolved')
  if (initial.rows.length && !rendererContext?.verified) reasons.push('native-renderer-style-context-unverified')
  let pagesFetched = initial.pagesFetched, closingMatches = false
  if (initial.complete) {
    const closing = await traverse(Infinity); pagesFetched += closing.pagesFetched
    closingMatches = closing.total === initial.total && closing.identities.size === initial.identities.size
      && [...initial.identities].every(([id, identity]) => closing.identities.get(id) === identity)
    if (!closingMatches) reasons.push('closing-native-records-or-criteria-changed')
  }
  const jobs = candidates.slice(0, maxJobs), capped = jobs.length !== candidates.length
  if (capped) reasons.push('caller-job-cap')
  const complete = reasons.length === 0, stamp = now()
  for (const job of jobs) { job.sourceScopeComplete = complete; job.sourceListingComplete = complete; job.scrapedAt = stamp }
  const evidence = { status: complete ? (initial.total ? 'complete-inventory' : 'verified-empty') : 'coverage-gap',
    surface: ORIGIN + '/job-search', firstParty: true, listingComplete: complete, reportedTotal: initial.total,
    indiaFacetCount: initial.complete ? mapped.filter(job => job.country === 'India').length : null,
    pagesFetched, verifiedAt: stamp, reason: complete ? 'current-native-whole-inventory-organisation-counts-full-criteria-and-closing-comparison' : reasons.join(';') }
  attachInventoryEvidence(jobs, evidence)
  attachSourceObservationEvidence(jobs, { source: 'adityabirlagroup', recordKind: 'vacancy-rows', observedRecordCount: initial.rows.length,
    observedVacancyCount: initial.rows.length, sourceScopeComplete: complete })
  await withCallerSignal(()=>onAudit?.({ source: 'adityabirlagroup', nativeRecords: initial.rows, qualifiedCount: candidates.length,
    rendererContext, descriptionProjectionEvidence: mapped.map(job => ({ jobCode:job.jobId, ...job.sourceNativeDescriptionProjection })),
    partialCriteriaIds: partial.map(job => job.jobId), unknownCountryIds: unknown.map(job => job.jobId), closingMatches,
    inventoryEvidence: evidence, productionWrites: false }),signal)
  signal?.throwIfAborted()
  return jobs
}
