import { createHash } from 'node:crypto'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { nativeCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'
import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'

const HOME = 'https://softprodigy.com/'
const BOARD = 'https://softprodigy.keka.com/careers/'
const CLIENT = 'https://cdn.keka.com/careers/v/2026/scripts/app/app.min.js'
const CLIENT_SHA256 = 'e2585ba1c4a259792330b7524042e3376994836454234a6da414eb1eeaaf315f'
const ACCOUNT = BOARD + 'api/organization/default/careerportalinfo'
const ACTIVE = BOARD + 'api/jobs/default/active'
const EMPLOYER = 'SoftProdigy System Solutions Pvt. Ltd.'
const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim()
const sha = value => createHash('sha256').update(value).digest('hex')
const need = (condition, reason) => {
  if (!condition) throw Object.assign(Error('SoftProdigy current Keka inventory: ' + reason), {
    softFailure: true, abortRetries: true, failureKind: 'coverage_gap',
  })
}
const one = (nodes, reason) => { need(nodes.length === 1, reason); return nodes[0] }
const nativeText = html => { const doc = readNativeDocument(html); return doc.text(doc.nodes(n => n.tag === 'root')[0]) }

function officialBinding(html) {
  const doc = readNativeDocument(html)
  need(doc.nodes(n => n.tag === 'title' && /^SoftProdigy\s*\|/.test(n.raw || '')).length === 1,
    'official publisher identity changed')
  need(doc.nodes(n => n.tag === 'a' && n.attrs.href === BOARD && /^Careers$/i.test(doc.text(n))).length > 0,
    'current active employer handoff missing')
}

function portalBinding(html) {
  const doc = readNativeDocument(html)
  const base = one(doc.nodes(n => n.tag === 'base'), 'native portal base identity missing')
  const portal = one(doc.nodes(n => n.tag === 'meta' && n.attrs.name === 'portalName'), 'native portal name missing')
  need(base.attrs.id === 'baseHref' && base.attrs.href === '/careers/'
    && (!Object.hasOwn(portal.attrs, 'content') || portal.attrs.content === ''), 'native default portal identity changed')
  need(doc.nodes(n => n.tag === 'script' && n.attrs.src === CLIENT && !Object.hasOwn(n.attrs, 'nomodule')
    && /^(?:|(?:text|application)\/javascript)$/i.test(n.attrs.type || '')).length === 1,
  'current legacy Keka client is not declared')
  need(doc.nodes(n => n.tag === 'p' && doc.text(n) === EMPLOYER).length === 1,
    'native portal employer identity changed')
}

function validateAccount(account) {
  need(account && !Array.isArray(account) && account.name === EMPLOYER && account.shortName === EMPLOYER
    && account.careersPortalDomain === 'softprodigy.keka.com', 'native employer account publisher changed')
  const website = new URL(account.companyWebsite)
  need(website.protocol === 'https:' && ['softprodigy.com', 'www.softprodigy.com'].includes(website.hostname)
    && website.pathname === '/' && !website.search && !website.hash && !website.username && !website.password && !website.port,
  'native account reciprocal employer website changed')
}

function locationFor(row) {
  need(Array.isArray(row.jobLocations), 'native job location envelope changed')
  const doc = readNativeDocument(row.description)
  const explicit = doc.nodes(n => ['div', 'p', 'li'].includes(n.tag))
    .map(n => /^Location:\s*([^,]{1,80}),\s*India$/.exec(doc.text(n)))
    .filter(Boolean).map(match => clean(match[1]))
  need(new Set(explicit).size <= 1, 'contradictory native description country/location')
  const countries = row.jobLocations.map(location => {
    const code = nativeCountryName(location.countryCode), name = nativeCountryName(location.countryName)
    need(!code || !name || code === name, 'contradictory native structured country')
    return name || code
  })
  if (explicit.length) need(countries.every(country => country === 'India'), 'native country conflicts with the role-owned India location')
  if (!explicit.length) return null
  return { city: explicit[0], location: explicit[0] + ', India', country: 'India' }
}

function hostedRole(html, row) {
  const doc = readNativeDocument(html)
  need(clean(doc.text(one(doc.nodes(n => n.tag === 'h1'), 'native full-role title missing'))) === row.title,
    'native full-role title identity changed')
  const description = one(doc.nodes(n => n.tag === 'div' && doc.hasClass(n, 'job-description-container')),
    'native full-role description content missing')
  need(doc.text(description) === nativeText(row.description), 'native full-role criteria/description disagrees with original inventory')
  const apply = one(doc.nodes(n => n.tag === 'button' && n.attrs.id === 'apply-job'), 'native application action missing')
  need(doc.text(apply) === 'Apply for this job' && !Object.hasOwn(apply.attrs, 'disabled'), 'native application action unavailable')
  need(doc.nodes(n => n.attrs.selectedjobid === String(row.id) && n.attrs.selectedjobtitle === row.title).length === 1,
    'native hosted role ID/title identity changed')
  if (clean(row.experience)) need(doc.nodes(n => n.tag === 'span' && doc.text(n) === clean(row.experience)).length === 1,
    'native hosted experience criteria changed')
}

// This employer uses the published legacy renderer, whose AJAX beforeSend joins
// /careers/ to /api routes. Its current complete executable must authorize those
// routes; the newer document/embed portal uses a different contract.
export async function runCurrentSoftProdigyKeka({ fetchImpl = globalThis.fetch, signal,
  now = () => new Date().toISOString(), onAudit } = {}) {
  signal?.throwIfAborted()
  const checkedAt = now(), receipts = [], unresolved = []
  const deadline = signal ? AbortSignal.any([signal, AbortSignal.timeout(120000)]) : AbortSignal.timeout(120000)
  const read = async (url, format = 'html') => {
    deadline.throwIfAborted()
    need(receipts.length < 30, 'native source request budget exceeded')
    const response = await fetchImpl(url, { method: 'GET', credentials: 'omit', redirect: 'error',
      signal: AbortSignal.any([deadline, AbortSignal.timeout(20000)]),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify careers inventory check)',
        Accept: format === 'json' ? 'application/json' : format === 'js' ? 'application/javascript' : 'text/html' } })
    deadline.throwIfAborted()
    if (response.status !== 200) throw Object.assign(Error('SoftProdigy current native HTTP ' + response.status), {
      status: response.status, softFailure: true, abortRetries: true,
      failureKind: [401, 403, 429, 451].includes(response.status) ? 'blocked_or_access_denied' : 'coverage_gap',
    })
    need(response.url === url, 'native HTTP response identity changed')
    const mime = response.headers.get('content-type') || ''
    need((format === 'json' ? /^(?:application|text)\/json\b/i : format === 'js'
      ? /^(?:application|text)\/(?:x-)?(?:java|ecma)script\b/i : /^text\/html\b/i).test(mime), 'native HTTP content type changed')
    need(Number(response.headers.get('content-length') || 0) <= 3000000, 'native HTTP response budget exceeded')
    const body = await response.text()
    need(Buffer.byteLength(body) <= 3000000, 'native HTTP response budget exceeded')
    receipts.push({ url, status: response.status, contentType: mime, sha256: sha(body) })
    if (format !== 'json') return body
    try { return JSON.parse(body) } catch { need(false, 'invalid native JSON') }
  }
  async function context() {
    officialBinding(await read(HOME))
    portalBinding(await read(BOARD))
    const client = await read(CLIENT, 'js')
    need(sha(client) === CLIENT_SHA256, 'current complete Keka renderer/client contract changed')
    const account = await read(ACCOUNT, 'json')
    validateAccount(account)
    const rows = await read(ACTIVE, 'json')
    need(Array.isArray(rows) && rows.length > 0 && rows.length <= 1000, 'empty or malformed active native inventory')
    const seen = new Set()
    for (const row of rows) {
      need(row && Number.isSafeInteger(row.id) && row.id > 0 && !seen.has(row.id) && clean(row.title)
        && typeof row.description === 'string' && hasSourceDescription({ sourceDescription: row.description }), 'invalid or duplicate full native role content')
      seen.add(row.id)
    }
    return { account, rows }
  }
  const opening = await context(), selected = []
  for (const row of opening.rows) {
    const location = locationFor(row)
    if (!location) { unresolved.push({ id: String(row.id), reason: 'explicit-role-owned-country-unavailable' }); continue }
    const url = BOARD + 'jobdetails/' + row.id, html = await read(url)
    hostedRole(html, row)
    selected.push({ row, location, url, detailSHA256: sha(html) })
    need(selected.length <= 10, 'native full-detail review budget exceeded')
  }
  need(selected.length > 0, 'no qualified explicit India native roles; incomplete country scope retained')
  const closing = await context()
  need(JSON.stringify(opening) === JSON.stringify(closing), 'closing native account/inventory criteria changed')
  for (const { row, url, detailSHA256 } of selected) {
    const html = await read(url)
    hostedRole(html, row)
    need(sha(html) === detailSHA256, 'closing full native role content changed')
  }
  const jobs = selected.map(({ row, location, url, detailSHA256 }) => {
    const publication = new Date(row.publishedOn)
    const nativeDate = typeof row.publishedOn === 'string'
      && /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?Z$/.exec(row.publishedOn)
    const calendar = nativeDate && new Date(nativeDate[1] + 'T00:00:00.000Z')
    need(nativeDate && Number.isFinite(+calendar) && calendar.toISOString().startsWith(nativeDate[1]) && Number.isFinite(+publication)
      && +publication <= Date.parse(checkedAt), 'invalid or future native original publication date')
    const sidebarExperience = clean(row.experience), fullDescription = nativeText(row.description)
    const sidebarProfile = extractJobFilterSignals({ experienceRequired: sidebarExperience }).experienceProfile
    const descriptionProfile = extractJobFilterSignals({ jobDescription: fullDescription }).experienceProfile
    const experienceConflict = sidebarProfile.confidence === 'high' && descriptionProfile.confidence === 'high'
      && (sidebarProfile.minimumYears !== descriptionProfile.minimumYears
        || sidebarProfile.maximumYears !== descriptionProfile.maximumYears
        || sidebarProfile.isOpenEnded !== descriptionProfile.isOpenEnded)
    const description = fullDescription + (sidebarExperience ? '\n\nExperience listed in job summary: ' + sidebarExperience : '')
    return { source: 'softprodigysystemsolutions', company: opening.account.name, nativeEmployerName: opening.account.name,
      jobId: String(row.id), requisitionId: String(row.id), title: row.title, ...location,
      sourceUrl: url, applyUrl: url, link: url, department: row.departmentName || null,
      employmentType: row.jobType === 2 ? 'Full-Time' : null,
      experienceRequired: experienceConflict ? null : sidebarExperience || null,
      sourceExperienceRequired: experienceConflict ? null : sidebarExperience || null,
      sourceRecordKind: 'api-role-observation', sourceExperienceScopeUnresolved: experienceConflict,
      skipPublicExperienceEnrichment: experienceConflict,
      sourceExperienceEvidenceKind: experienceConflict ? 'conflicting-native-sidebar-and-own-role-description' : 'native-sidebar-and-full-role',
      sourceNativeExperienceConflict: experienceConflict ? { kind: 'native-sidebar-and-own-role-description', sidebar: sidebarExperience,
        ownRoleRequirement: descriptionProfile.evidence } : null,
      minimumQualification: null, preferredQualification: null, requiredSkills: row.skillNames || [],
      jobDescription: description, sourceDescription: description,
      sourceNativeDescriptionHtml: row.description, sourceNativeRecord: structuredClone(row),
      sourceNativePublishedOn: row.publishedOn, postingDate: publication.toISOString(), closingDate: null,
      publicationDateProvenance: 'native Keka publishedOn', originalPublicationDateQualified: true,
      sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
      sourceDetailComplete: true, publicExperienceChecked: !experienceConflict, sourceNativeDetailSha256: detailSHA256,
      employerBindingEvidence: { officialURL: HOME, nativeURL: BOARD, nativeEmployer: opening.account.name,
        reciprocalWebsite: opening.account.companyWebsite, currentHandoffRechecked: true },
      scrapedAt: checkedAt }
  })
  const audit = { source: 'softprodigysystemsolutions', checkedAt, receipts,
    nativeRecords: opening.rows, observedNativeRecordCount: opening.rows.length, qualifiedIndiaRows: jobs.length,
    unresolved, closingNativeInventoryAndDetailsReconciled: true, sourceScopeComplete: false, lifecycleCleanupAllowed: false }
  Object.defineProperty(jobs, 'nativeCollectionEvidence', { value: audit, configurable: true })
  if (onAudit) await onAudit(structuredClone(audit))
  deadline.throwIfAborted()
  return attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: ACTIVE, firstParty: true,
    listingComplete: false, lifecycleCleanupAllowed: false, pagesFetched: receipts.length,
    reportedTotal: null, indiaFacetCount: jobs.length, verifiedAt: checkedAt,
    reason: 'Current corporate handoff, complete declared legacy Keka client, exact native employer account, original active rows and full selected India details reconciled at opening/closing; other native role country and whole-company scope remain unqualified.' })
}
