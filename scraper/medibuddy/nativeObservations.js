import { createHash } from 'node:crypto'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { readNativeDocument, extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { MEDIBUDDY_CATALOG as catalog } from './catalog.js'
const SOURCE = 'medibuddy', COMPANY = 'MediBuddy'
const norm = value => String(value || '').replace(/\s+/g, ' ').trim()
const fail = message => Object.assign(new Error('MediBuddy native ' + message), { abortRetries: true, incompleteScope: true })
const children = node => node.children.filter(child => typeof child !== 'string')
const descendants = (node, predicate) => [...(predicate(node) ? [node] : []), ...children(node).flatMap(child => descendants(child, predicate))]
const documentFor = html => readVisibleNativeDocument(String(html), { strict: true })
const rootText = document => document.nodes(node => node.tag === 'root').map(node => document.text(node)).join(' ')
export const hasActiveMediPage = html => {
  const document = documentFor(html), text = rootText(document)
  const positions = /Available Positions/i.test(text)
    || document.nodes(node => ['available-positions', 'job-openings'].includes(node.attrs.id)).length === 1
  // The current Indore campaign uses this visible employer statement; its city
  // supplies page identity only and never fills an individual role workplace.
  return positions && /#BaatBadiHaiYeMediBuddyHai|MediReViva|MediBuddy is now hiring in Indore/i.test(text)
}
const address = (value, base) => {
  let url
  try { url = new URL(value, base) } catch { throw fail('advertised URL malformed') }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw fail('advertised URL ownership unavailable')
  return url
}
const trakstar = url => url.origin === catalog.trakstarJobsHost && /^\/jobs\/[a-z0-9_-]+\/$/i.test(url.pathname) && !url.search
const publicDoc = url => url.origin === 'https://docs.google.com' && /^\/document\/d\/[a-zA-Z0-9_-]+\/edit\/?$/.test(url.pathname)
const typeform = url => url.origin === 'https://form.typeform.com' && /^\/to\/[a-zA-Z0-9]+$/.test(url.pathname)
export const googleDocExportUrl = value => {
  try { const url = address(value); return publicDoc(url) ? url.origin + url.pathname.replace(/\/edit\/?$/, '/export') + '?format=txt' : null } catch { return null }
}
const canonicalKey = value => { const url = new URL(value); return url.origin + url.pathname }
const excludedVariants = (html, visible, pageUrl, sectionId) => {
  const raw = readNativeDocument(String(html)), rawRoot = raw.nodes(node => node.tag === 'root')[0]
  const visibleRoot = visible.nodes(node => node.tag === 'root')[0], parents = new Map(), result = []
  const index = node => { for (const child of children(node)) { parents.set(child, node); index(child) } }
  index(rawRoot)
  const rawRole = node => node.tag === 'h2' && raw.text(node) && raw.text(node) !== 'Available Positions'
  const jobLink = node => node.tag === 'a' && /^(?:Apply|View Job Description)$/i.test(raw.text(node))
  const walk = (node, projected, path, section) => {
    if (node.inert) return
    if (node.attrs.id === sectionId) section = node
    if (section && rawRole(node) && (!projected || projected.inert || !visible.text(projected))) {
      let card = parents.get(node)
      while (card && card !== section && descendants(card, rawRole).length === 1 && !descendants(card, jobLink).length) card = parents.get(card)
      const boundCard = card && descendants(card, rawRole).length === 1 ? card : null
      const ancestry = []
      for (let ancestor = node; ancestor; ancestor = parents.get(ancestor)) {
        ancestry.push({ tag: ancestor.tag, attrs: ancestor.attrs })
        if (ancestor === section) break
      }
      result.push({ kind: 'visibility-unqualified', title: raw.text(node), sourcePageUrl: pageUrl,
        nativeNodePath: path, ancestry, advertisedUrls: boundCard ? descendants(boundCard, jobLink)
          .map(link => ({ text: raw.text(link), href: link.attrs.href })) : [],
        roleIdentityLinkage: 'unqualified', activeNativeFieldsQualified: false, applicationSubmissionQualified: false })
    }
    node.children.forEach((child, at) => { if (typeof child !== 'string') walk(child, projected?.children[at], [...path, at], section) })
  }
  walk(rawRoot, visibleRoot, [], null)
  return result
}
export const readMediListings = (html, pageUrl) => {
  if (!catalog.firstPartyJobPages.includes(pageUrl) || !hasActiveMediPage(html)) throw fail('visible official positions scope unavailable')
  const document = documentFor(html), id = pageUrl.endsWith('medireviva') ? 'available-positions' : 'job-openings'
  const sections = document.nodes(node => node.attrs.id === id)
  if (sections.length !== 1) throw fail('visible native positions scope unavailable')
  const section = sections[0], parents = new Map(), index = node => { for (const child of children(node)) { parents.set(child, node); index(child) } }
  index(section)
  const roleTitle = node => node.tag === 'h2' && document.text(node) !== 'Available Positions'
  const listings = [], observations = excludedVariants(html, document, pageUrl, id)
  for (const heading of descendants(section, roleTitle)) {
    const title = document.text(heading)
    if (!title) continue
    let card = parents.get(heading)
    while (card && descendants(card, roleTitle).length === 1
      && !descendants(card, node => node.tag === 'a').some(node => /^(?:Apply|View Job Description)$/i.test(document.text(node)))) card = parents.get(card)
    if (!card || descendants(card, roleTitle).length !== 1) { observations.push({ title, sourcePageUrl: pageUrl, kind: 'role-area' }); continue }
    const links = descendants(card, node => node.tag === 'a' && /^(?:Apply|View Job Description)$/i.test(document.text(node)))
      .map(node => ({ text: document.text(node), url: address(node.attrs.href, pageUrl) }))
    const nativeJobs = links.filter(link => trakstar(link.url)), docs = links.filter(link => publicDoc(link.url))
    for (const link of links) if (!trakstar(link.url) && !publicDoc(link.url) && !typeform(link.url)) throw fail('application/detail URL ownership mismatch')
    if (nativeJobs.length && (docs.length || new Set(nativeJobs.map(link => link.url.href)).size !== 1)
      || docs.length && new Set(docs.map(link => canonicalKey(link.url))).size !== 1) throw fail('supplied native role URL identity conflict')
    const applies = links.filter(link => link.text === 'Apply')
    if (new Set(applies.map(link => link.url.href)).size > 1) throw fail('supplied application URL identity conflict')
    const selected = nativeJobs[0]?.url || docs[0]?.url
    if (!selected) { observations.push({ title, sourcePageUrl: pageUrl, kind: 'role-area', advertisedUrls: links.map(link => link.url.href) }); continue }
    const detailKind = nativeJobs.length ? 'trakstar' : 'public-doc'
    if (detailKind === 'public-doc' && applies.some(link => !typeform(link.url))) throw fail('public document application URL ownership mismatch')
    listings.push({ title, sourcePageUrl: pageUrl, sourceUrl: selected.href, applyUrl: applies[0]?.url.href || null,
      detailKind, jobId: 'medibuddy-url-' + createHash('sha256').update(canonicalKey(selected.href)).digest('hex'), requisitionId: null,
      rawAdvertisedUrls: links.map(link => ({ text: link.text, url: link.url.href })) })
  }
  return { listings, observations }
}
export const extractMediDocDetail = (value, listing = {}) => {
  const rawText = String(value ?? '')
  if (/^\s*(?:<!doctype|<html\b|<head\b|<body\b)/i.test(rawText)) throw fail('public document returned HTML instead of native plain text')
  const lines = rawText.replace(/\r\n?/g, '\n').split('\n').map(norm).filter(Boolean)
  const role = lines.find(line => /^Role\s*[-–:]/i.test(line))?.replace(/^Role\s*[-–:]\s*/i, '')
  const table = lines.findIndex(line => /^Job Title\s*:?$/i.test(line))
  const locationIndex = lines.findIndex(line => /^Location(?:\s*:|$)/i.test(line))
  const nativeTitle = role || (table >= 0 ? lines[table + 1] : locationIndex > 0 ? lines[locationIndex - 1] : null) || null
  const identityQualified = Boolean(nativeTitle && norm(nativeTitle) === norm(listing.title) && /\bMediBuddy\b/.test(rawText))
  const field = label => {
    const at = lines.findIndex(line => new RegExp('^' + label + '(?:\\s*:|$)', 'i').test(line))
    if (at < 0) return null
    return lines[at].replace(new RegExp('^' + label + '\\s*:?\\s*', 'i'), '') || lines[at + 1] || null
  }
  const workplace = field('Location'), employment = field('Employment Type')
  const criteria = /(?:Key Responsibilities|Job Responsibilities|^Responsibilities\s*:)/mi.test(rawText)
    && Boolean(extractActiveDescription(rawText))
  const complete = identityQualified && criteria
  return { title: listing.title || null, location: null, city: null, country: null, employmentType: null,
    experienceRequired: null, remoteStatus: identityQualified && /^(?:On[- ]?site|office[- ]based)(?:\s*\([^)]*\))?$/i.test(workplace || '') ? 'On-site' : null,
    jobDescription: complete ? rawText : null, sourceDetailComplete: complete, publicExperienceChecked: complete,
    ...(!complete ? { sourceDetailFailureKind: identityQualified ? 'missing-content' : 'identity-mismatch' } : {}),
    rawNativeRoleEvidence: { listingTitle: listing.title || null, contentJobTitle: nativeTitle, workplaceField: workplace,
      employmentTypeField: employment, contentJobDescription: rawText, identityQualified,
      activeNativeFieldsQualified: true, applicationSubmissionQualified: false } }
}

export const createNativeMediCollector = ({ maxJobs = null, defaultFetchText }) => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString(), signal, maxJobs: runMaxJobs } = {}) {
    const outputCap = runMaxJobs === undefined ? maxJobs : runMaxJobs
    if (outputCap != null && (!Number.isSafeInteger(outputCap) || outputCap < 0)) throw fail('invalid output cap')
    signal?.throwIfAborted()
    const lifecycle = AbortSignal.any([AbortSignal.timeout(120000), ...(signal ? [signal] : [])])
    const read = async url => {
      lifecycle.throwIfAborted()
      // A callback may ignore its signal. Observe its eventual settlement but
      // release this collection immediately when the caller/deadline aborts.
      const body = await new Promise((resolve, reject) => {
        const cleanup = () => lifecycle.removeEventListener('abort', aborted)
        const aborted = () => { cleanup(); reject(lifecycle.reason) }
        lifecycle.addEventListener('abort', aborted, { once: true })
        if (lifecycle.aborted) { aborted(); return }
        Promise.resolve().then(() => { lifecycle.throwIfAborted(); return fetchText(url, { signal: lifecycle }) })
          .then(value => { cleanup(); resolve(value) }, error => { cleanup(); reject(lifecycle.aborted ? lifecycle.reason : error) })
      })
      lifecycle.throwIfAborted()
      if (/<title[^>]*>\s*(?:Just a moment|Access Denied|Forbidden|Attention Required)/i.test(body)) throw fail('public native challenge unavailable')
      return body
    }
    const listings = [], observations = []
    for (const page of catalog.firstPartyJobPages) {
      const parsed = readMediListings(await read(page), page)
      listings.push(...parsed.listings); observations.push(...parsed.observations)
    }
    const seen = new Set()
    for (const listing of listings) { if (seen.has(listing.jobId)) throw fail('native role URL identity repeated'); seen.add(listing.jobId) }
    const selected = outputCap == null ? listings : listings.slice(0, outputCap)
    const audit = { source: SOURCE, observedListingCount: listings.length, observedNativeRecordCount: listings.length + observations.length,
      observedVisibleVacancyCount: listings.length, excludedRawObservationCount: observations.length, candidateDetails: selected.length,
      successfulDetailReads: 0, nativeDetailAttempts: 0, extractedDetailJobs: 0, failures: [], otherObservations: observations,
      listingPaginationComplete: null, closingInventoryMatches: null, sourceScopeComplete: false,
      companyGlobalTotal: null, companyIndiaTotal: null, firstNativeStop: null, outputCapped: selected.length < listings.length }
    const stop = error => { audit.firstNativeStop ||= { status: Number(error.status ?? error.cause?.status) || null,
      kind: 'upstream', message: error.message }; return audit.firstNativeStop }
    let inactive = false, rootChecked = false
    if (selected.some(listing => listing.detailKind === 'trakstar')) {
      try {
        const html = await read(catalog.trakstarJobsHost + '/jobs/')
        rootChecked = true
        const text = rootText(documentFor(html))
        inactive = /inactive account/i.test(text) && /no longer using trakstar hire/i.test(text)
      } catch (error) { if (lifecycle.aborted) throw lifecycle.reason; stop(error) }
    }
    const jobs = [], scrapedAt = now()
    for (const listing of selected) {
      const raw = { sourcePageUrl: listing.sourcePageUrl, advertisedUrls: listing.rawAdvertisedUrls,
        advertisedSourceUrl: listing.sourceUrl, advertisedApplyUrl: listing.applyUrl,
        contentJobDescription: null, identityQualified: false, activeNativeFieldsQualified: false, applicationSubmissionQualified: false }
      let detail = null, failureKind = 'upstream', reason = null
      if (listing.detailKind === 'trakstar') reason = inactive ? 'native-account-inactive' : 'native-detail-contract-unverified'
      else if (audit.firstNativeStop) reason = 'unread-after-first-native-stop'
      else {
        audit.nativeDetailAttempts++
        try {
          const payload = await read(googleDocExportUrl(listing.sourceUrl))
          detail = extractMediDocDetail(payload, listing)
          audit.successfulDetailReads++
          if (detail.sourceDetailComplete) audit.extractedDetailJobs++
          else failureKind = detail.sourceDetailFailureKind
        } catch (error) {
          if (lifecycle.aborted) throw lifecycle.reason
          stop(error); reason = 'first-native-detail-stop'
        }
      }
      if (!detail?.sourceDetailComplete) audit.failures.push({ stage: 'native-detail', nativeRoleId: listing.jobId,
        kind: failureKind, reason: reason || failureKind })
      const complete = detail?.sourceDetailComplete === true
      jobs.push({ title: listing.title, company: COMPANY, source: SOURCE, department: null,
        location: null, city: null, country: null, jobId: listing.jobId, requisitionId: null,
        // Unverified upstream routes remain literal raw facts. The normalized
        // fallback is the public employer page, never a verified application.
        sourceUrl: complete ? listing.sourceUrl : listing.sourcePageUrl, applyUrl: complete ? listing.applyUrl : null,
        // The registry treats a generic link as an application fallback. Keep
        // it absent when only the public source page is qualified.
        link: complete && listing.applyUrl ? listing.applyUrl : null,
        employmentType: null, experienceRequired: null, minimumQualification: null, preferredQualification: null,
        requiredSkills: [], postingDate: null, closingDate: null, jobDescription: detail?.jobDescription || null,
        remoteStatus: detail?.remoteStatus || null, sourceDetailComplete: complete, publicExperienceChecked: complete,
        sourceListingComplete: false, ...(!complete ? { sourceDetailFailureKind: failureKind } : {}),
        rawNativeRoleEvidence: { ...raw, ...(detail?.rawNativeRoleEvidence || {}), upstreamObservation: reason }, scrapedAt })
    }
    if (jobs.length) jobs[0].rawExcludedNativeObservations = observations.filter(record => record.kind === 'visibility-unqualified')
    for (const job of jobs) job.nativeCollectionEvidence = audit
    attachSourceObservationEvidence(jobs, { source: SOURCE, recordKind: observations.length ? 'mixed' : 'vacancy-rows',
      observedRecordCount: listings.length + observations.length, observedVacancyCount: listings.length,
      sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null })
    return attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: catalog.companyCareerPage, firstParty: true,
      listingComplete: false, pagesFetched: catalog.firstPartyJobPages.length + Number(rootChecked) + audit.nativeDetailAttempts,
      reportedTotal: null, indiaFacetCount: null, verifiedAt: null,
      reason: 'medibuddy-native-advert-observations;applications-details-country-company-scope-closing-unconfirmed'
        + (inactive ? ';native-account-inactive' : '') + (audit.firstNativeStop ? ';first-native-stop' : '') + (audit.outputCapped ? ';output-cap' : '') })
  },
})
