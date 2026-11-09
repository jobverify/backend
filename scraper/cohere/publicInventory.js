import { createHash } from 'node:crypto'
import { decodeHTML } from 'entities'
import { createDeclaredAshbyScraper } from '../../scraper-support/native-sources/declaredAshby/nativeCareers.js'
import { countryName } from '../../scraper-support/native-sources/jobPostingData.js'
import { nativeDate, roleURL } from '../../scraper-support/native-sources/declaredAshby/nativeData.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { rawElementNodes } from '../biofourmis/scriptExecution.js'

const MAX = { maxRequests: 320, maxBodyBytes: 5 * 1024 * 1024, maxDecodedBytes: 64 * 1024 * 1024, maxDurationMs: 180000 }
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)
const label = value => typeof value === 'object' && value ? String(value.name || '').trim() : String(value || '').trim()
// A scope label is not a postal country. Preserve its original spelling/type.
const scopeName = value => countryName(value) || (/^(?:European Union|EU)$/i.test(label(value)) ? 'region:European Union' : null)
const schemaKeys = new Set(['@context', '@type', 'title', 'description', 'directApply', 'identifier', 'datePosted', 'hiringOrganization',
  'jobLocation', 'employmentType', 'baseSalary', 'jobLocationType', 'applicantLocationRequirements', 'validThrough', 'url'])
const geoIssues = new Set(['native-applicant-country-conflicts-with-explicit-worksites', 'native-role-schema-country-or-address-unreconciled'])
const geographicKey = /country|location|address|region|postal|territor|applicant|eligib|scope|remote|workplace/i
const unhandledGeography = (value, allowed) => Object.entries(value || {}).some(([key, part]) =>
  part != null && geographicKey.test(key) && !allowed.includes(key))

const publicTransport = options => {
  const limits = { ...MAX }
  for (const [key, value] of Object.entries(options.limits || {})) {
    if (!(key in MAX) || !Number.isSafeInteger(value) || value < 1 || value > MAX[key]) throw Error('Invalid Cohere public transport limit')
    limits[key] = value
  }
  const started = Date.now(), receipts = []
  const signal = AbortSignal.any([AbortSignal.timeout(limits.maxDurationMs), ...(options.signal ? [options.signal] : [])])
  let requests = 0, decodedBytes = 0, halted = null
  const stop = message => { halted ||= message; throw Error(halted) }
  const fetchPage = async url => {
    signal.throwIfAborted()
    if (halted) throw Error(halted)
    if (requests >= limits.maxRequests || Date.now() - started >= limits.maxDurationMs) stop('Cohere public read budget exhausted')
    requests++
    let result, streamedBytesCounted = false
    try {
      if (options.fetchPage) result = await options.fetchPage(url, { signal })
      else if (options.fetchText) result = await options.fetchText(url, { signal })
      else {
        const requestedAt = new Date().toISOString()
        const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(20000)])
        const response = await (options.fetchImpl || globalThis.fetch)(url, { method: 'GET', redirect: 'manual', signal: requestSignal,
          headers: { Accept: 'text/html,application/json,application/rss+xml,*/*;q=0.5', 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)' } })
        const reader = response.body?.getReader()
        if (!reader) stop('Cohere response body unavailable')
        streamedBytesCounted = true
        const chunks = []; let bytes = 0
        try {
          for (;;) {
            if (halted) throw Error(halted)
            requestSignal.throwIfAborted()
            const item = await reader.read()
            if (item.done) break
            bytes += item.value.byteLength
            decodedBytes += item.value.byteLength
            if (halted || bytes > limits.maxBodyBytes || decodedBytes > limits.maxDecodedBytes) stop('Cohere decoded body budget exhausted')
            chunks.push(item.value)
          }
        } catch (error) { await reader.cancel().catch(() => {}); throw error } finally { reader.releaseLock() }
        const body = Buffer.concat(chunks)
        result = { url: response.url || url, status: response.status, headers: Object.fromEntries(response.headers),
          bodyBase64: body.toString('base64'), requestedAt, completedAt: new Date().toISOString() }
      }
      signal.throwIfAborted()
      const bytes = typeof result?.bodyBase64 === 'string' ? Buffer.from(result.bodyBase64, 'base64')
        : Buffer.from(typeof result === 'string' ? result : result?.html || '')
      if (!streamedBytesCounted) decodedBytes += bytes.length
      if (bytes.length > limits.maxBodyBytes || decodedBytes > limits.maxDecodedBytes) stop('Cohere decoded body budget exhausted')
      const receipt = { url, finalURL: result?.url ?? null, status: result?.status ?? null,
        requestedAt: result?.requestedAt ?? null, completedAt: result?.completedAt ?? null, bytes: bytes.length, bodySHA256: sha(bytes) }
      receipts.push(receipt)
      await options.onPacket?.({ ...receipt, headers: result?.headers ?? {}, rawBodyBase64: bytes.toString('base64') })
      const html = bytes.toString('utf8')
      if ([401, 403, 429].includes(result?.status)
        || /^(?:\s*<!doctype[^>]*>)?\s*<html[\s\S]*?<title>\s*(?:Just a moment|Access denied)/i.test(html)
        || /^\s*(?:Verify you are human|Checking your browser)/i.test(html)) {
        halted = `Cohere source denied HTTP ${result?.status}; further public reads stopped`
      }
      return result
    } catch (error) {
      signal.throwIfAborted()
      halted ||= error.message
      throw error
    }
  }
  return { signal, fetchPage, summary: () => ({ requests, decodedBytes, receipts, limits, halted }) }
}

const controlText = value => decodeHTML(String(value || '')).replace(/\s+/gu, ' ').trim()
const recruitingAction = /\b(?:jobs?|careers?|vacancies|positions?|open roles?|openings|apply|recruiting)\b/i
// These are the non-recruiting controls in the retained corporate document.
// New controls/name-reference grammars remain unqualified instead of guessing
// their browser accessibility names or interpreting JavaScript handlers.
const knownCorporateControls = new Set(['close banner', 'open navigation menu', 'platforms', 'models', 'industries',
  'deployment', 'resources', 'connect', 'company', 'legal', 'manage cookies', 'english'])
const hiringChannels = (company, contract, html) => {
  const channels = new Set(), extra = []
  const inspectLink = link => {
    let url
    try { url = new URL(decodeHTML(link.url), contract.primaryURL) } catch { extra.push(link.url); return }
    url.hash = ''
    const ownBoard = url.origin === 'https://jobs.ashbyhq.com'
      && (url.href === contract.boardURL || roleURL(contract, url.href, url.pathname.split('/')[2]))
    const ownCareer = url.origin === contract.websiteOrigin && url.pathname === new URL(contract.primaryURL).pathname && !url.search
    const ats = /(?:ashbyhq\.com|greenhouse\.io|lever\.co|workable\.com|myworkdayjobs\.com|smartrecruiters\.com|jobvite\.com)$/i.test(url.hostname)
    const action = recruitingAction.test(controlText(link.text))
    const careerPath = /\/(?:careers?|jobs?|positions|vacancies)(?:\/|$)/i.test(url.pathname)
    if (ownBoard || ownCareer) channels.add(url.href)
    else if (ats || action || careerPath) extra.push(url.href)
  }
  for (const link of company?.links || []) inspectLink(link)
  if (typeof html !== 'string' || !html) extra.push('corporate-document-unavailable')
  else {
    // Absence of another hiring surface needs supported raw boundaries before
    // the shared tree can safely hide comments, foreign/raw text or templates.
    // This bounded reader only inspects source; it never executes scripts.
    try { rawElementNodes(html) } catch {
      extra.push('unqualified-corporate-raw-boundaries')
      return { channels: [...channels].sort(), extra: [...new Set(extra)].sort() }
    }
    const document = readNativeDocument(html, { excludeObjectFallback: false })
    const roots = document.nodes(node => node.tag === 'root')
    const extraLabels = node => node.inert ? [] : [
      ...(node.tag === 'img' && node.attrs.alt ? [node.attrs.alt] : []),
      ...(['title', 'desc'].includes(node.tag) && node.raw ? [node.raw] : []),
      ...node.children.filter(child => typeof child !== 'string').flatMap(extraLabels),
    ]
    const visit = node => {
      if (node.activeFrame) { extra.push('unaccounted-active-child-document:iframe'); return }
      if (node.inert) return
      const attrs = node.attrs || {}
      if (['object', 'embed'].includes(node.tag)) { extra.push(`unaccounted-active-child-document:${node.tag}`); return }
      if (node.tag === 'form') extra.push('unaccounted-active-form:' + (attrs.action || 'implicit-action'))
      if (['aria-labelledby', 'aria-describedby', 'aria-details'].some(key => Object.hasOwn(attrs, key))) extra.push('unqualified-corporate-label-reference')
      const name = controlText([attrs['aria-label'], attrs.title, attrs.value, document.text(node), ...extraLabels(node)].filter(Boolean).join(' '))
      const eventControl = Object.keys(attrs).some(key => /^on/i.test(key))
      const actor = ['a', 'button', 'input'].includes(node.tag) || /^(?:button|link|menuitem)$/i.test(attrs.role || '')
        || eventControl && recruitingAction.test(name)
      if (actor && eventControl) extra.push('unqualified-corporate-event-control')
      if (node.tag === 'a' && attrs.href) inspectLink({ url: attrs.href, text: name })
      else if (node.tag === 'button') {
        if (Object.hasOwn(attrs, 'form') || Object.hasOwn(attrs, 'formaction') || recruitingAction.test(name)
          || !knownCorporateControls.has(name.toLowerCase())) extra.push('unaccounted-corporate-button:' + name)
      } else if (node.tag === 'input' && attrs.type?.toLowerCase() !== 'hidden' || actor && !['a', 'button', 'input'].includes(node.tag)) {
        extra.push('unqualified-corporate-control:' + node.tag)
      }
      for (const child of node.children.filter(child => typeof child !== 'string')) visit(child)
    }
    roots.forEach(visit)
  }
  return { channels: [...channels].sort(), extra: [...new Set(extra)].sort() }
}

const roleReceipt = (job, contract) => {
  const problems = [], posting = job.sourceNativePosting, schema = job.sourceNativeJobPosting, api = job.sourceNativeAPIRecord
  const geo = job.sourceNativeCountryEvidence
  const problem = value => problems.push(value)
  if (unhandledGeography(api, ['location', 'secondaryLocations', 'address', 'isRemote', 'workplaceType'])
    || unhandledGeography(posting, ['locationName', 'locationAddress', 'secondaryLocationNames', 'workplaceType'])) problem('unhandled-native-geographic-fields')
  if (!job.sourceNativeRoleDetail?.bound || !job.sourceCurrentNativeRoleQualified || job.sourceCompanyScopeUnresolved
    || !posting || !schema || !api || !job.sourceNativeBoardRecord) problem('role-identity-detail-or-current-state-unqualified')
  if (!schema || Object.keys(schema).some(key => !schemaKeys.has(key))) problem('unhandled-native-schema-fields')
  if (schema && Object.hasOwn(schema, 'url') && (typeof schema.url !== 'string' || !roleURL(contract, schema.url, job.jobId))) problem('explicit-schema-role-url-unqualified')
  if ((job.sourceNativeRoleDetail?.issues || []).some(issue => !geoIssues.has(issue))) problem('native-nongeographic-role-issue')
  if (!posting || posting.isListed !== true || posting.isConfidential !== false || api?.isListed !== true || schema?.directApply !== true
    || !roleURL(contract, api?.applyUrl, job.jobId, true) || job.applicationUrlIsGeneric) problem('public-role-or-application-route-unqualified')
  if (!job.sourceDescription || !posting || posting.descriptionHtml !== api?.descriptionHtml || schema?.description !== posting.descriptionHtml) problem('full-native-criteria-unqualified')
  if (!nativeDate(api?.publishedAt) || job.postingDate !== api?.publishedAt) problem('original-publication-unqualified')
  if (posting?.applicationDeadline != null && !nativeDate(posting.applicationDeadline)) problem('native-deadline-unqualified')
  if (schema?.validThrough != null && (!nativeDate(schema.validThrough) || schema.validThrough !== posting?.applicationDeadline)) problem('schema-deadline-unreconciled')
  const rawApplicants = schema?.applicantLocationRequirements
  const applicants = rawApplicants == null ? [] : [rawApplicants].flat()
  const scopes = applicants.map(entry => entry && entry['@type'] === 'Country'
    && Object.keys(entry).every(key => ['@type', 'name'].includes(key)) ? scopeName(entry.name) : null)
  if (applicants.length && scopes.some(value => !value)) problem('applicant-geographic-scope-unqualified')
  const places = (geo?.originalPlaces || []).map(place => {
    const address = place.originalAddress?.postalAddress || place.originalAddress || {}
    const country = scopeName(address.addressCountry), namedCountry = countryName(place.originalLocation)
    if (address.addressCountry && !country) problem('unrecognized-native-postal-country')
    if (country && namedCountry && country !== namedCountry) problem('contradictory-native-place-country')
    return { label: place.originalLocation, physicalCountry: place.country, scope: country || namedCountry, originalAddress: place.originalAddress }
  })
  for (const place of [{ location: api?.location, address: api?.address }, ...(api?.secondaryLocations || [])]) {
    const address = place.address?.postalAddress || place.address || {}
    if (unhandledGeography(place, ['location', 'address'])
      || unhandledGeography(address, ['addressCountry', 'addressLocality', 'addressRegion', 'postalCode', 'streetAddress'])) problem('unhandled-native-place-fields')
  }
  const postingAddress = posting?.locationAddress?.postalAddress || posting?.locationAddress
  if (postingAddress && typeof postingAddress === 'object') {
    const postingScope = scopeName(postingAddress.addressCountry)
    if (postingAddress.addressCountry && !postingScope || postingScope && places[0]?.scope && postingScope !== places[0].scope) problem('native-posting-address-unreconciled')
  }
  const schemaPlaces = [schema?.jobLocation].flat().filter(Boolean)
  const schemaScopes = schemaPlaces.map(place => {
    const address = place.address?.postalAddress || place.address || {}
    const country = scopeName(address.addressCountry)
    if (address.addressCountry && !country) problem('unrecognized-schema-postal-country')
    return country
  })
  if (schemaScopes.length === 1 && places[0]?.scope && schemaScopes[0] && places[0].scope !== schemaScopes[0]) problem('contradictory-primary-schema-country')
  if (schemaScopes.some(scope => scope && !places.some(place => place.scope === scope))) problem('schema-worksite-country-not-reconciled-to-native-places')
  if (geo?.schemaPlaceCorrespondence?.some(place => place.countryConflict || place.stateConflict)) problem('contradictory-native-schema-address')
  if (scopes.length && places.some(place => place.scope && !scopes.includes(place.scope))) problem('applicant-scope-contradicts-native-place')
  if (scopes.length && schemaScopes.some(scope => scope && !scopes.includes(scope))) problem('applicant-scope-contradicts-schema-place')
  const explicitIndia = geo?.indiaWorksiteQualified === true && job.country === 'India'
  let indiaEligibility = 'unknown', basis = 'native-target-scope-unresolved'
  if (!problems.length) {
    if (explicitIndia && (!scopes.length || scopes.includes('India'))) { indiaEligibility = 'included'; basis = 'explicit-native-india-worksite-and-coherent-applicant-scope' }
    else if (scopes.length && !scopes.includes('India')) { indiaEligibility = 'excluded'; basis = 'role-owned-explicit-applicant-geographic-whitelist' }
    else if (!scopes.length && places.length && places.every(place => place.scope && place.scope !== 'India')
      && api?.isRemote !== true && schema?.jobLocationType !== 'TELECOMMUTE') { indiaEligibility = 'excluded'; basis = 'all-native-worksites-explicitly-foreign' }
  }
  return { id: job.jobId, indiaEligibility, basis, problems, applicantScopes: scopes,
    originalApplicantLocationRequirements: rawApplicants ?? null, nativePlaces: places,
    schemaWorksiteScopes: schemaScopes, originalSchemaJobLocations: schema?.jobLocation ?? null,
    detailQualified: problems.length === 0, deadlinePassed: job.sourceNativeAvailability?.deadlinePassed === true,
    physicalUnknownsPreserved: places.filter(place => !place.physicalCountry).map(place => place.label),
    privateApplicationActivationVerified: job.sourceNativeApplication?.activationVerified ?? false }
}

const qualify = (audit, transport, contract, observedAt) => {
  const issues = [], issue = value => issues.push(value)
  const opening = audit?.openingFeed, closing = audit?.closingFeed
  if (!audit?.openingCompany?.qualified || !audit?.closingCompany?.qualified) issue('current-opening-closing-corporate-delegation-unqualified')
  const corporatePages = (audit?.rawPages || []).filter(page => page.url === contract.primaryURL)
  const firstChannels = hiringChannels(audit?.openingCompany, contract, corporatePages[0]?.originalText)
  const lastChannels = hiringChannels(audit?.closingCompany, contract, corporatePages.at(-1)?.originalText)
  if (firstChannels.extra.length || lastChannels.extra.length || !same(firstChannels.channels, lastChannels.channels)) issue('additional-or-changing-advertised-hiring-surfaces')
  for (const feed of [opening, closing]) {
    if (!feed || feed.apiVersion !== '1' || !Array.isArray(feed.jobs) || Object.keys(feed).some(key => !['apiVersion', 'jobs'].includes(key))) issue('native-feed-envelope-or-termination-unqualified')
  }
  for (const board of [audit?.openingBoard, audit?.closingBoard]) {
    if (!board?.jobBoard || Object.keys(board.jobBoard).some(key => !['teams', 'jobPostings', '__typename'].includes(key))) issue('native-board-envelope-or-termination-unqualified')
  }
  if (!same(opening, closing) || !same(audit?.openingBoard, audit?.closingBoard)) issue('opening-closing-native-scope-changed')
  const ids = rows => Array.isArray(rows) ? rows.map(row => row.id).sort() : []
  const expected = ids(opening?.jobs), boardIds = ids(audit?.openingBoard?.jobBoard?.jobPostings)
  if (!same(expected, boardIds) || !same(expected, (audit?.observations || []).map(job => job.jobId).sort())
    || new Set(expected).size !== expected.length) issue('native-identities-not-fully-reconciled')
  if (audit?.issues?.length) issue('native-reader-issues-retained')
  if (!audit?.rawPages?.length || audit.rawPages.some(page => !page.usable || !page.transportQualified)
    || audit.rawPages.length !== transport.receipts.length || transport.halted) issue('native-public-transport-incomplete')
  const at = Date.parse(observedAt), window = transport.limits.maxDurationMs
  if (transport.receipts.some(receipt => receipt.status !== 200 || receipt.finalURL !== receipt.url
    || !nativeDate(receipt.requestedAt) || !nativeDate(receipt.completedAt)
    || Date.parse(receipt.requestedAt) < at || Date.parse(receipt.completedAt) < Date.parse(receipt.requestedAt)
    || Date.parse(receipt.completedAt) > at + window)) issue('original-public-response-clocks-unqualified')
  const roles = (audit?.observations || []).map(job => roleReceipt(job, contract))
  if (roles.some(role => !role.detailQualified || role.indiaEligibility === 'unknown')) issue('native-role-detail-or-india-scope-unqualified')
  const complete = issues.length === 0
  return { complete, issues, roles, transport,
    openingHiringChannels: firstChannels, closingHiringChannels: lastChannels,
    publicNativeRoleCount: expected.length, verifiedAt: complete ? transport.receipts.at(-1)?.completedAt ?? null : null,
    scope: 'current-employer-advertised-public-careers-inventory-and-native-india-eligibility;private-activation-not-asserted' }
}

export const createCoherePublicScraper = contract => ({
  async run(options = {}) {
    options.signal?.throwIfAborted()
    const observedAt = typeof options.now === 'function' ? options.now() : options.now || new Date().toISOString()
    const transport = publicTransport(options)
    let audit
    await createDeclaredAshbyScraper(contract).run({ ...options, maxJobs: null, signal: transport.signal,
      now: () => observedAt, fetchPage: transport.fetchPage, onAudit: value => { audit = value } })
    transport.signal.throwIfAborted()
    const proof = qualify(audit, transport.summary(), contract, observedAt)
    const receipts = new Map(proof.roles.map(role => [role.id, role]))
    const positives = audit.observations.filter(job => job.country === 'India' && job.sourceNativeCountryEvidence?.indiaWorksiteQualified
      && !job.sourceNativeAvailability?.deadlinePassed)
    const limit = options.maxJobs
    if (limit != null && (!Number.isSafeInteger(limit) || limit < 0)) throw Error('Invalid Cohere maxJobs')
    const selected = limit == null ? positives : positives.slice(0, limit)
    if (selected.length !== positives.length) { proof.complete = false; proof.issues.push('india-output-limited') }
    if (!proof.complete) proof.verifiedAt = null
    const jobs = selected.map(job => ({ ...job, scrapedAt: observedAt,
      sourceDetailComplete: receipts.get(job.jobId)?.detailQualified === true,
      sourceListingComplete: proof.complete, lifecycleCleanupAllowed: proof.complete,
      sourcePublicScopeReceipt: receipts.get(job.jobId) }))
    // Keep every original native observation and private-activation unknown.
    // The separate public receipt is not a rewrite of the shared reader audit.
    audit.coherePublicInventory = proof
    await options.onAudit?.(audit)
    Object.defineProperty(jobs, 'sourceAudit', { value: audit })
    if (!proof.complete) attachSourceObservationEvidence(jobs, { source: contract.source, recordKind: 'vacancy-rows',
      observedRecordCount: audit.observations.length, observedVacancyCount: audit.observations.length,
      sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null })
    return attachInventoryEvidence(jobs, { status: proof.complete ? 'complete-inventory' : 'discovery-only',
      surface: contract.boardURL, firstParty: audit.openingCompany?.qualified === true,
      listingComplete: proof.complete, pagesFetched: audit.rawPages.filter(page => page.usable).length,
      // Neither accepted envelope supplies a numeric publisher total. Retain
      // observed cardinality separately in proof.publicNativeRoleCount.
      reportedTotal: null, indiaFacetCount: proof.complete ? positives.length : null,
      verifiedAt: proof.complete && nativeDate(proof.verifiedAt) ? proof.verifiedAt : null,
      reason: proof.complete ? 'cohere-current-public-native-inventory-and-role-owned-india-eligibility-reconciled'
        : `cohere-public-scope-incomplete:${proof.issues.join(';')}` })
  },
})
