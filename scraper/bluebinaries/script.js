import { createHash } from 'node:crypto'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { analyzePublishableJobs } from '../../scraper-support/utils/publishableJobMetrics.js'
import { visibleDocument, decodeLeaf, normalizeText } from './nativeVisibility.js'
import {publicRead,structure} from '../alkemlaboratories/publicRead.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {verifyBlueRendering} from './currentRendering.js'

export const SOURCE = 'bluebinaries'
export const HOMEPAGE_URL = 'https://www.bluebinaries.com/'
export const CAREER_PAGE_URL = 'https://www.bluebinaries.com/become-a-bluebee/'
export const WORKSITES_URL = 'https://www.bluebinaries.com/connect-to-us/'
const cls = (n, c) => (n.attrs.class || '').split(/\s+/).includes(c)
const clean = v => normalizeText(v) || null
const descendants = (n, p) => typeof n === 'string' || n.inert ? [] : [...(p(n) ? [n] : []), ...n.children.flatMap(c => descendants(c, p))]
const absolute = (value, base = CAREER_PAGE_URL) => { try { return new URL(value, base).href } catch { return null } }
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export class BlueBinariesNativeError extends Error { constructor(message) { super('Blue Binaries native: ' + message); this.abortRetries = true } }
const valid = (value, message) => { if (!value) throw new BlueBinariesNativeError(message) }
const countryFromLocation = value => {
  const countries = new Set()
  for (const part of String(value || '').split(/[,;|]/).map(v => v.trim())) for (const [pattern, country] of [[/^India$/i, 'India'], [/^(?:UK|United Kingdom)$/i, 'United Kingdom'], [/^Austria$/i, 'Austria'], [/^(?:USA|United States(?: of America)?)$/i, 'United States']]) if (pattern.test(part)) countries.add(country)
  return countries.size === 1 ? [...countries][0] : null
}
export const isIndiaLocation = value => countryFromLocation(value) === 'India'
const publicationDate = value => {
  const match = /^Posted on\s+(\d{2})-([A-Za-z]{3})-(\d{4})$/i.exec(value || '')
  if (!match) return null
  const month = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(match[2].toLowerCase()) + 1
  if (!month) return null
  const date = `${match[3]}-${String(month).padStart(2, '0')}-${match[1]}`
  return Number.isFinite(Date.parse(date)) && new Date(date).toISOString().startsWith(date) ? date : null
}
const labelValue = (lines, label) => lines.map(value => new RegExp('^' + label + '\\s*:\\s*(.+)$', 'i').exec(value)?.[1]).find(Boolean) || null
export const extractOfficialWorksites = html => {
  const doc = visibleDocument(html, n => cls(n, 'accordion-item')), parents = new WeakMap()
  const walk = (node, parent) => { if (typeof node === 'string') return; if (parent) parents.set(node,parent); node.children.forEach(c => walk(c,node)) }
  walk(doc.nodes(n => n.tag === 'root')[0])
  const sites = []
  for (const item of doc.nodes(n => cls(n,'accordion-item'))) {
    let nested = false
    for (let p = parents.get(item); p; p = parents.get(p)) if (cls(p,'accordion-item')) nested = true
    if (nested) continue
    const heading = item.children.find(n => typeof n !== 'string' && ['h2','h3'].includes(n.tag)), buttons = heading ? descendants(heading,n => n.tag === 'button') : []
    if (buttons.length !== 1 || !/\bTroy,\s*MI\s+48084\b/i.test(doc.text(item))) continue
    sites.push({ city: 'Troy', state: 'MI', country: countryFromLocation(doc.text(buttons[0])), sourceUrl: WORKSITES_URL })
  }
  const employerBound = doc.nodes(n => n.tag === 'title' && /BlueBinaries/i.test(decodeLeaf(n.raw))).length === 1
  return employerBound && !doc.unresolved ? sites : []
}
export const extractNativeInventory = (html, { worksites = [], renderingVerified } = {}) => {
  const externalStyles = structure(html).nodes.some(n => n.tag === 'link' && n.attrs.rel === 'stylesheet' && n.attrs.media !== 'print')
  const rendererVerified = !externalStyles || renderingVerified === true
  const doc = visibleDocument(html, n => cls(n, 'acc-job-post'))
  const cards = doc.nodes(n => cls(n, 'acc-job-post'))
  const rows = cards.map(card => {
    const find = p => descendants(card, p), details = find(n => cls(n, 'job-details')), roots = find(n => cls(n, 'job-requirements'))
    const id = details.length === 1 ? clean(details[0].attrs['data-attribute']) : null
    const titleNodes = find(n => n.tag === 'h3'), title = titleNodes.length === 1 ? clean(doc.text(titleNodes[0])) : null
    const locations = find(n => cls(n, 'job-location')), location = locations.length === 1 ? clean(doc.text(locations[0])) : null
    const root = roots.length === 1 ? roots[0] : null
    const identity = Boolean(id && /^[\w:-]+$/.test(id) && root?.attrs.id === id && title)
    const lines = root ? descendants(root, n => ['p','li','h4','h5','h6'].includes(n.tag)).map(n => doc.text(n)).filter(Boolean) : []
    const description = root ? clean(doc.text(root)) : null
    const unsupportedCriteriaStyle = externalStyles && root && descendants(root,n => n !== root && ((n.attrs.class || '').trim() || /(?:^|;)\s*(?:overflow(?:-x|-y)?|(?:max-|min-)?(?:width|height)|position|text-indent|margin-left|white-space)\s*:/i.test(n.attrs.style || ''))).length > 0
    const full = Boolean(identity && description && !doc.unresolved && rendererVerified && !unsupportedCriteriaStyle)
    const role = find(n => cls(n, 'job-role'))[0], dateNodes = role ? descendants(role, n => n.tag === 'span') : []
    const rawDate = dateNodes.length === 1 ? doc.text(dateNodes[0]) : null, date = publicationDate(rawDate)
    const explicitCountry = countryFromLocation(location), worksiteMatches = /^BlueBinaries Engineering and Solutions Inc\., Troy, MI$/i.test(location || '') ? worksites.filter(s => s.city === 'Troy' && s.state === 'MI') : []
    const worksiteCountries = worksiteMatches.map(s => s.country), worksiteCountry = worksiteCountries.length && worksiteCountries.every(Boolean) && new Set(worksiteCountries).size === 1 ? worksiteCountries[0] : null
    const country = explicitCountry || worksiteCountry
    const applies = root ? descendants(root, n => n.tag === 'a' && /apply/i.test(doc.text(n))).map(n => ({ href: absolute(n.attrs.href), text: doc.text(n) })).filter(a => a.href && /^(?:https?:|mailto:)/.test(a.href) && !a.href.endsWith('#')) : []
    const apply = applies.length === 1 ? applies[0].href : null
    return { source: SOURCE, company: 'Blue Binaries', title, jobId: id, id, sourceJobId: id, requisitionId: null,
      location, country, countryCode: ({ India: 'IN', 'United States': 'US', 'United Kingdom': 'GB', Austria: 'AT' })[country] || null,
      city: worksiteCountry ? 'Troy' : country ? clean(location?.split(',').map(s => s.trim()).filter(s => s && !/^BlueBinaries\b/.test(s) && !countryFromLocation(s))[0]) : null, state: worksiteCountry ? 'MI' : null,
      sourceUrl: id ? CAREER_PAGE_URL + '#' + encodeURIComponent(id) : CAREER_PAGE_URL, applyUrl: apply,
      link: apply || (id ? CAREER_PAGE_URL + '#' + encodeURIComponent(id) : CAREER_PAGE_URL),
      applicationUrlIsGeneric: apply ? apply === CAREER_PAGE_URL : null, applicationUrlScope: apply ? 'published-native-application' : 'unavailable',
      applicationPostingContext: { nativePostingId: id, title, formalRequisitionId: null }, applicationPublicContextValidated: Boolean(apply), applicationSubmitted: false, candidateActionsTaken: false,
      department: labelValue(lines, 'Department'), employmentType: labelValue(lines, 'Employment Type'), remoteStatus: labelValue(lines, '(?:Work arrangement|Work mode)'),
      experienceRequired: labelValue(lines, '(?:Experience|Work Experience required)'), minimumQualification: labelValue(lines, '(?:Qualification|Education)'), preferredQualification: labelValue(lines, 'Preferred Qualification'), requiredSkills: labelValue(lines, '(?:Skills|Required Skills)') ? [labelValue(lines, '(?:Skills|Required Skills)')] : null,
      compensation: labelValue(lines, '(?:Salary|Compensation)'), postingDate: date, postedAt: date, nativePublicationDate: date,
      nativePublicationSource: date ? 'visible job-role Posted on label' : null, sourcePublicationDateUnavailable: !date, sourceClosingDateIsExact: false, closingDate: null,
      jobDescription: full ? description : null, sourceDescription: full ? description : null, sourceDetailComplete: full, sourceIdentityComplete: identity,
      sourceDetailFailureKind: full ? null : identity ? 'native-visible-criteria-unresolved' : 'native-posting-identity-unresolved',
      sourceNativeCriteria: { fullObservedText: description, lines, visibilityIssues: [...doc.visibilityIssues, ...(!rendererVerified ? ['external-rendering-context-unreviewed'] : []), ...(unsupportedCriteriaStyle ? ['unreviewed-criteria-class-or-layout-style'] : [])], rendererVerified }, sourceNativeCountryEvidence: { location, country, basis: explicitCountry ? 'explicit-role-location-country' : worksiteCountry ? 'current-employer-exact-worksite' : null, matchedWorksites: worksiteMatches },
      sourceNativeDates: { publicationLabel: rawDate, publication: date }, sourceNativeEmployerEvidence: { homepage: HOMEPAGE_URL, careerPage: CAREER_PAGE_URL, nativePostingId: id } }
  })
  const ids = rows.map(r => r.jobId).filter(Boolean), duplicates = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))]
  for (const row of rows) if (duplicates.includes(row.jobId)) { row.sourceIdentityComplete = false; row.sourceDetailComplete = false; row.jobDescription = null; row.sourceDescription = null; row.sourceDetailFailureKind = 'ambiguous-native-posting-id' }
  const containers = doc.nodes(n => n.attrs.id === 'job-posts-container' && cls(n, 'job-posts'))
  const pagination = containers.flatMap(n => descendants(n, x => ['a','button'].includes(x.tag) && (/\bnext\b/i.test(x.attrs.rel || '') || /load more|next page/i.test(doc.text(x)) || /[?&](?:page|paged|offset|cursor)=|\/page\/\d+/i.test(x.attrs.href || '') || Object.hasOwn(x.attrs, 'data-page'))))
  const accordionProven = structure(html).scripts.some(n => n.executable && !n.attrs.src && /\.job-details/.test(n.body) && /data-attribute/.test(n.body) && /\.toggle\(/.test(n.body))
  const advertised = doc.nodes(n => n.tag === 'a' && /career|job opening|vacanc|apply now/i.test(doc.text(n))).map(n => absolute(n.attrs.href)).filter(u => u && !u.startsWith(CAREER_PAGE_URL) && !rows.some(r => r.applyUrl === u))
  return { rows, observedCount: rows.length, uniqueNativeIdCount: new Set(ids).size, duplicateIds: duplicates, terminal: containers.length === 1 && !pagination.length && accordionProven, visibilityUnresolved: doc.unresolved, additionalRecruitmentChannels: [...new Set(advertised)] }
}
export const extractJobEntries = (html, options) => extractNativeInventory(html, options).rows.filter(r => r.jobId && r.title)
export const defaultFetchPage = async (url, { fetchImpl = fetch, timeoutMs = 30000, signal, ...init } = {}) => {
  const response = await fetchImpl(url, { ...init, redirect: 'follow', signal: signal || AbortSignal.timeout(timeoutMs) })
  return { status: response.status, url: response.url, contentType: response.headers.get('content-type'), body: await response.text() }
}
export const run = async (options = {}) => {
 return publicRead({source:SOURCE,company:'BlueBinaries'},options,async scope=>{
  const maxJobs = options.maxJobs ?? 0
  valid(Number.isSafeInteger(maxJobs) && maxJobs >= 0, 'invalid output budget')
  valid(!options.fetchJson && !options.fetchText || options.fetchPage, 'use native fetchPage transport')
  let requests = 0
  const page = async (url,phase='initial') => {const body=await scope.read(url,{phase});requests++;return body}
  const home = async (phase='initial') => { const html = await page(HOMEPAGE_URL,phase), doc = visibleDocument(html, n => n.tag === 'a'); valid(doc.nodes(n => n.tag === 'title' && /BlueBinaries/i.test(decodeLeaf(n.raw))).length === 1 && doc.nodes(n => n.tag === 'a' && absolute(n.attrs.href, HOMEPAGE_URL) === CAREER_PAGE_URL).length > 0, 'official homepage career handoff changed'); return doc.nodes(n => n.tag === 'a' && absolute(n.attrs.href,HOMEPAGE_URL) === WORKSITES_URL).length > 0 }
  const openingContactAdvertised = await home(), openingWorksites = openingContactAdvertised ? extractOfficialWorksites(await page(WORKSITES_URL)) : []
  const openingHTML=await page(CAREER_PAGE_URL),openingRendering=await verifyBlueRendering(openingHTML,scope,'initial')
  const opening = extractNativeInventory(openingHTML, { worksites: openingWorksites,renderingVerified:openingRendering.verified })
  const closingContactAdvertised = await home('closing'), closingWorksites = closingContactAdvertised ? extractOfficialWorksites(await page(WORKSITES_URL,'closing')) : []
  const closingHTML=await page(CAREER_PAGE_URL,'closing'),closingRendering=await verifyBlueRendering(closingHTML,scope,'closing')
  const closing = extractNativeInventory(closingHTML, { worksites: closingWorksites,renderingVerified:closingRendering.verified })
  const closingReconciled = digest(opening.rows) === digest(closing.rows), reasons = []
  if (!closingReconciled) reasons.push('closing-native-criteria-or-identity-changed')
  if (openingContactAdvertised !== closingContactAdvertised || digest(openingWorksites) !== digest(closingWorksites)) reasons.push('closing-employer-worksite-country-evidence-changed')
  if (!opening.terminal || !closing.terminal) reasons.push('native-terminal-unresolved')
  if (opening.duplicateIds.length) reasons.push('duplicate-native-posting-id')
  if (opening.rows.some(r => !r.sourceIdentityComplete)) reasons.push('native-posting-identity-unresolved')
  if (opening.rows.some(r => !r.country)) reasons.push('role-owned-country-unresolved')
  if (opening.rows.some(r => !r.sourceDetailComplete)) reasons.push('full-native-criteria-unresolved')
  const additional = [...new Set([...opening.additionalRecruitmentChannels, ...closing.additionalRecruitmentChannels])]
  if (additional.length) reasons.push('additional-recruitment-channel-unresolved')
  // An empty generic container is not an explicit employer no-vacancies statement.
  if (!opening.rows.length) reasons.push('native-empty-state-unproven')
  const primaryComplete = closingReconciled && opening.terminal && closing.terminal && opening.rows.length > 0 && opening.rows.every(r => r.sourceIdentityComplete), scopeComplete = reasons.length === 0
  const india = opening.rows.filter(r => r.country === 'India' && r.jobId && r.title), outputCapped = maxJobs > 0 && india.length > maxJobs, listingComplete = scopeComplete && !outputCapped
  const now=scope.stamp(),jobs = (outputCapped ? india.slice(0, maxJobs) : india).map(r => ({ ...r, scrapedAt: now, sourceListingComplete: listingComplete, sourceCleanupEligible: listingComplete, sourcePrimaryScopeComplete: primaryComplete }))
  const metrics = analyzePublishableJobs(jobs, { now: new Date(now) })
  const audit = { source: SOURCE, observedGlobalCount: opening.observedCount, nativeGlobalReportedTotal: null, uniqueNativeIdCount: opening.uniqueNativeIdCount, duplicateNativeIds: opening.duplicateIds, nativeJobs: opening.rows, primaryScopeComplete: primaryComplete, scopeComplete, closingReconciled, indiaJobCount: scopeComplete ? india.length : null, fullHealthyIndia: india.filter(r => r.sourceDetailComplete && r.applicationPublicContextValidated).length, eligibleCount: metrics.eligibleJobs.length, cleanupEligible: listingComplete, outputCapped, requests, additionalRecruitmentChannels: additional, reasons }
  await scope.audit({...audit,observations:opening.rows,openingRendering,closingRendering})
  attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:opening.rows.length,observedVacancyCount:opening.rows.length,sourceScopeComplete:false})
  return attachInventoryEvidence(jobs, { status: listingComplete ? 'complete-inventory' : 'coverage-gap', surface: CAREER_PAGE_URL, firstParty: true, listingComplete, pagesFetched: scope.publicPages.length, reportedTotal: null, indiaFacetCount: scopeComplete ? india.length : null, verifiedAt: now, reason: reasons.concat(outputCapped ? ['output-capped-after-reconciliation'] : []).join(';') || 'full-native-static-board-and-closing-reconciliation' })
 })
}
