import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { createPublicIO } from '../../scraper-support/native-sources/publicIO.js'
import { readJobPosting, unknownGeography } from '../../scraper-support/native-sources/jobPostingData.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { appData, decode, text, plain, requireNative, documentLinks, nativeOrganization, roleURL, nativeDate, locationNames, nativePlaces, fullCriteria } from './nativeData.js'

export const HOME = 'https://zapier.com/jobs', BOARD = 'https://jobs.ashbyhq.com/zapier', API = 'https://api.ashbyhq.com/posting-api/job-board/zapier'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const allowed = url => url.origin === 'https://zapier.com' && url.pathname === '/jobs'
  || url.origin === 'https://api.ashbyhq.com' && url.pathname === '/posting-api/job-board/zapier' && !url.search
  || url.origin === 'https://jobs.ashbyhq.com' && /^\/zapier(?:\/[0-9a-f-]+)?$/.test(url.pathname) && !url.search
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const boardData = page => {
  requireNative(page?.usable && page.originalText, 'Native board unavailable')
  const data = appData(readNativeDocument(page.originalText))
  requireNative(nativeOrganization(data.organization) && Array.isArray(data.jobBoard?.jobPostings), 'Native organization or board changed')
  const records = data.jobBoard.jobPostings
  requireNative(records.every(record => uuid.test(record.id) && text(record.title) && Array.isArray(record.secondaryLocations))
    && new Set(records.map(record => record.id)).size === records.length, 'Duplicate/malformed native board identities')
  return data
}
const feedData = (io, page) => {
  const data = io.json(page)
  requireNative(data?.apiVersion === '1' && Array.isArray(data.jobs) && !data.error && !data.errors && data.success !== false, 'Native API envelope unavailable')
  return data
}
const delegation = page => {
  if (!page?.usable || !page.originalText) return { qualified: false, links: [] }
  const links = documentLinks(page.originalText, HOME)
  return { qualified: /zapier/i.test(plain(page.originalText)) && links.some(link => {
    try { const url = new URL(link.url);return url.origin === 'https://jobs.ashbyhq.com' && !url.username && !url.password
      && (url.pathname === '/zapier' || /^\/zapier\/[0-9a-f-]{36}$/.test(url.pathname)) } catch { return false }
  }), links }
}
export const runNative = async (options = {}) => {
  const { signal, now = () => new Date().toISOString(), onAudit = () => {}, maxJobs = null } = options
  signal?.throwIfAborted()
  const verifiedAt = typeof now === 'function' ? now() : now
  requireNative(nativeDate(verifiedAt), 'Invalid observation clock')
  const io = createPublicIO({ ...options, allowed }), records = new Map(), observations = new Map()
  let openingCompany, closingCompany, openingBoard, closingBoard, openingFeed, closingFeed, fatal
  const contexts = (feed, board, links) => {
    const indexed = new Map(), briefs = new Map((board?.jobBoard?.jobPostings || []).map(brief => [brief.id, brief])), linked = new Map()
    for (const record of feed?.jobs || []) {
      if (!record || !uuid.test(record.id)) { io.issue('native-API-record-identity-unqualified', { originalRecord: record });continue }
      if (!indexed.has(record.id)) indexed.set(record.id, [])
      indexed.get(record.id).push(record)
    }
    for (const link of links || []) {
      const id = new URL(link.url).pathname.split('/')[2]
      if (uuid.test(id) && roleURL(link.url, id)) linked.set(id, link)
    }
    const ids = [...new Set([...indexed.keys(), ...briefs.keys(), ...linked.keys()])]
    return ids.map(id => {
      const matches = indexed.get(id) || [], index = matches.length === 1 ? matches[0] : null, brief = briefs.get(id) ?? null
      const supplied = index && roleURL(index.jobUrl, id) ? index.jobUrl : null
      const declared = linked.get(id)?.url ?? null
      // A route projection is labelled explicitly and checked against the role's
      // own original metadata. It never becomes a fabricated native API object.
      const derived = nativeOrganization(board?.organization) && ['/', '/zapier'].includes(board.routerPrefix) ? BOARD + '/' + id : null
      const url = supplied || declared || derived
      return { id, index, brief, conflicts: matches.length > 1 ? matches : [], url,
        originalCorporateLink: linked.get(id) ?? null, URLDerivedFromNativeRouter: !supplied && !declared && Boolean(derived),
        title: text(index?.title || brief?.title || linked.get(id)?.text),
        signature: JSON.stringify([matches, brief, declared]) }
    })
  }
  const inspect = async (context, board, companyQualified, fresh = false) => {
    const { index: record, brief, id } = context
    const page = context.url ? await io.load(context.url, { fresh }) : null
    let posting = null, schema = null, organization = null, bound = false, geo = unknownGeography(), description = null
    const problems = []
    if (page?.usable && page.originalText) {
      try {
        const parsed = readJobPosting(page.originalText), data = appData(parsed.document)
        posting = data.posting ?? null;organization = data.organization ?? null;schema = parsed.candidate?.model ?? null
        const meta = property => parsed.document.nodes(node => node.tag === 'meta' && node.attrs.property === property).map(node => decode(node.attrs.content || ''))
        const title = parsed.document.nodes(node => node.tag === 'title').map(node => text(decode(node.raw || '')))
        const urls = meta('og:url'), titles = meta('og:title')
        const canonicals = parsed.document.nodes(node => node.tag === 'link' && (node.attrs.rel || '').split(/\s+/).includes('canonical'))
        requireNative(companyQualified && nativeOrganization(organization) && (!board || organization.organizationId === board.organization.organizationId), 'Current company/native organization delegation unqualified')
        requireNative(!context.conflicts.length && (!record || typeof record.isListed === 'boolean' && Array.isArray(record.secondaryLocations)
          && roleURL(record.jobUrl, id) && roleURL(record.applyUrl, id, true)), 'Unique coherent native API record unavailable')
        requireNative(posting?.id === id && schema?.identifier?.value === id && schema.identifier.name === 'Zapier'
          && schema.hiringOrganization?.name === 'Zapier' && new URL(schema.hiringOrganization.sameAs).origin === 'https://zapier.com', 'Native role/company identity disagreement')
        requireNative(parsed.candidates.length === 1 && !parsed.errors.length && posting.isListed === true && posting.isConfidential === false
          && (!record || record.isListed === true), 'Native role publication or structured data unqualified')
        const ownTitle = text(posting.title)
        requireNative([schema.title, ...(brief ? [brief.title] : []), ...(record ? [record.title] : [])].every(value => text(decode(value)) === ownTitle)
          && title.length === 1 && title[0] === ownTitle + ' @ Zapier'
          && titles.length === 1 && text(titles[0]) === ownTitle, 'Native role title disagreement')
        requireNative(urls.length === 1 && roleURL(urls[0], id) && (!canonicals.length
          || canonicals.length === 1 && roleURL(canonicals[0].attrs.href, id)), 'Native role URL authority disagreement')
        const postedLocations = [posting.locationName, ...(posting.secondaryLocationNames || [])].map(text)
        const boardLocations = brief ? [brief.locationName, ...brief.secondaryLocations.map(place => place.locationName)].map(text) : null
        requireNative((!record || equal(postedLocations, locationNames(record))) && (!brief || equal(boardLocations, postedLocations)), 'Native role location disagreement')
        requireNative(typeof posting.descriptionHtml === 'string' && (!record || posting.descriptionHtml === record.descriptionHtml)
          && schema.description === posting.descriptionHtml && plain(posting.descriptionHtml), 'Native role criteria disagreement')
        const primarySchema = Array.isArray(schema.jobLocation) ? schema.jobLocation[0] : schema.jobLocation
        const geographyInput = record || { location: posting.locationName, address: posting.locationAddress || primarySchema?.address || null,
          secondaryLocations: (posting.secondaryLocationNames || []).map(location => ({ location, address: null })) }
        geo = { ...nativePlaces(geographyInput, schema), inputOrigin: record ? 'original-native-API-record'
          : 'location-projection-from-original-own-posting-and-schema-no-API-object' }
        description = fullCriteria(posting);bound = true
        if (geo.applicantConflict) problems.push('native-applicant-country-conflicts-with-explicit-worksites')
        if (geo.schemaConflict) problems.push('native-role-schema-country-or-address-unreconciled')
      } catch (error) { problems.push(error.message);io.issue('native-role-unqualified', { id, message: error.message }) }
    } else problems.push('native-role-unavailable-or-not-listed')
    const deadline = bound ? nativeDate(posting.applicationDeadline) : null
    if (bound && posting.applicationDeadline != null && !deadline) problems.push('native-deadline-unqualified')
    const passed = deadline ? Date.parse(deadline) < Date.parse(verifiedAt) : null
    const sourceUrl = context.url || BOARD, applyUrl = bound && record ? record.applyUrl : sourceUrl
    return { title: bound ? text(posting.title) : context.title, company: 'Zapier', source: 'zapier', jobId: id, requisitionId: null,
      sourceUrl, applyUrl, link: applyUrl, applicationUrlIsGeneric: !bound || !record,
      country: geo.country, city: geo.city, state: geo.state, location: geo.location, locations: geo.locations,
      sourceNativeCountryCodes: geo.countries, sourceCountryScopeUnresolved: !bound || geo.unresolved,
      sourceCompanyScopeUnresolved: !bound, sourceNativePostingIdentityQualified: bound,
      jobDescription: description, sourceDescription: description, postingDate: bound ? nativeDate(record?.publishedAt ?? schema.datePosted) : null, closingDate: deadline,
      employmentType: bound ? text(posting.employmentType) : null, remoteStatus: bound ? text(posting.workplaceType) : null,
      department: bound ? text(posting.departmentExternalName || posting.departmentName) : null,
      experienceRequired: null, minimumQualification: null, preferredQualification: null, requiredSkills: [],
      sourceNativePlatform: 'ashby', sourceNativeAPIRecord: record, sourceNativeAPIConflicts: context.conflicts, sourceNativeBoardRecord: brief,
      sourceNativeDiscovery: { originalCorporateLink: context.originalCorporateLink, URLDerivedFromNativeRouter: context.URLDerivedFromNativeRouter,
        originalBoardRouterPrefix: board?.routerPrefix ?? null, APIObjectInvented: false },
      sourceNativePosting: posting, sourceNativeJobPosting: schema, sourceNativeOrganization: organization,
      sourceNativeCountryEvidence: geo,
      sourceNativeRoleDetail: { bound, url: context.url, bodySHA256: page?.bodySHA256 ?? null, issues: problems },
      sourceNativeAvailability: { nativeIsListed: posting?.isListed ?? record?.isListed ?? null, originalApplicationDeadline: posting?.applicationDeadline ?? null,
        deadlinePassed: passed, activeRecruitmentVerified: false },
      sourceNativeApplication: { nativeApplyUrl: record?.applyUrl ?? null, activationVerified: false, allControlsQualified: false,
        applicantEligibilityQualified: false, originalApplicantLocationRequirements: schema?.applicantLocationRequirements ?? null },
      sourceNativeObservedAt: verifiedAt, sourceCurrentNativeRoleQualified: bound,
      sourceDetailComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false }
  }
  try {
    openingCompany = delegation(await io.load(HOME))
    if (!openingCompany.qualified) io.issue('current-corporate-native-delegation-unqualified')
    try { openingBoard = boardData(await io.load(BOARD)) }
    catch (error) { signal?.throwIfAborted();io.issue('opening-native-board-unavailable', { message: error.message }) }
    try { openingFeed = feedData(io, await io.load(API, { kind: 'json' })) }
    catch (error) { signal?.throwIfAborted();io.issue('opening-native-API-unavailable', { message: error.message }) }
    for (const context of contexts(openingFeed, openingBoard, openingCompany.links)) {
      records.set(context.id, context);observations.set(context.id, await inspect(context, openingBoard, openingCompany.qualified))
    }
    try { closingFeed = feedData(io, await io.load(API, { kind: 'json', fresh: true })) }
    catch (error) { signal?.throwIfAborted();io.issue('closing-native-API-unavailable', { message: error.message }) }
    try { closingBoard = boardData(await io.load(BOARD, { fresh: true })) }
    catch (error) { signal?.throwIfAborted();io.issue('closing-native-board-unavailable', { message: error.message }) }
    closingCompany = delegation(await io.load(HOME, { fresh: true }))
    for (const context of contexts(closingFeed, closingBoard, closingCompany.links)) {
      const previous = records.get(context.id), earlier = observations.get(context.id)
      const newLink = Boolean(context.originalCorporateLink && context.originalCorporateLink.url !== previous?.originalCorporateLink?.url)
      const changedAPI = Boolean(context.index && (!previous?.index || !equal(previous.index, context.index)))
      const changedBrief = Boolean(context.brief && (!previous?.brief || !equal(previous.brief, context.brief)))
      const changedConflicts = context.conflicts.length && !equal(previous?.conflicts, context.conflicts)
      const recoverableMissingDetail = Boolean(!earlier?.sourceNativePosting && context.url
        && earlier?.sourceNativeRoleDetail.issues.includes('native-role-unavailable-or-not-listed'))
      const newlyQualified = Boolean(!earlier?.sourceNativeRoleDetail.bound && openingCompany.qualified && closingCompany.qualified
        && context.index && context.brief && (!previous?.index || !previous?.brief))
      if (!previous || newLink || changedAPI || changedBrief || changedConflicts || recoverableMissingDetail || newlyQualified) {
        io.issue('native-closing-new-or-changed-record', { id: context.id })
        const current = await inspect(context, closingBoard, openingCompany.qualified && closingCompany.qualified, true)
        records.set(context.id, context)
        if (earlier?.jobDescription && !current.jobDescription) observations.set(context.id, { ...earlier,
          sourceNativeClosingObservation: current, sourceCurrentNativeRoleQualified: false,
          sourceNativeTemporalQualification: 'earlier-full-positive-retained-closing-role-evidence-unqualified' })
        else observations.set(context.id, current)
      } else if (earlier && (!closingBoard || !context.brief || !closingFeed || !context.index)) {
        earlier.sourceNativeTemporalQualification = 'earlier-full-positive-retained-closing-collection-missing-or-unavailable'
        earlier.sourceCurrentNativeRoleQualified = false
      }
    }
    if (!equal(openingFeed?.jobs, closingFeed?.jobs) || !equal(openingBoard?.jobBoard, closingBoard?.jobBoard)) io.issue('native-opening-closing-inventory-differ')
    if (!closingCompany.qualified) {
      io.issue('closing-corporate-native-delegation-unqualified')
      for (const job of observations.values()) Object.assign(job, { ...unknownGeography(), sourceCompanyScopeUnresolved: true,
        sourceCountryScopeUnresolved: true, sourceNativeCountryCodes: [], sourceNativeRoleDetail: { ...job.sourceNativeRoleDetail, bound: false,
          issues: [...job.sourceNativeRoleDetail.issues, 'closing-company-delegation-unqualified'] } })
    }
  } catch (error) { signal?.throwIfAborted();fatal = error }
  const all = [...observations.values()]
  const audit = { source: 'zapier', observations: all, rawPages: io.rawPages, issues: io.issues,
    openingCompany, closingCompany, openingBoard, closingBoard, openingFeed, closingFeed,
    sourceScopeComplete: false, lifecycleCleanupAllowed: false, authoritativeSourceTotal: null, authoritativeIndiaFacetCount: null,
    qualification: 'All known native role observations, original fields and explicit deadline/metadata conflicts. Listed content is not proof of active recruitment, application activation, complete employer/India inventory or publication.' }
  await onAudit(structuredClone(audit));signal?.throwIfAborted()
  if (fatal) throw fatal
  const eligible = all.filter(job => !job.sourceCompanyScopeUnresolved
    && (job.sourceCountryScopeUnresolved || job.country === 'India' || job.sourceNativeCountryCodes?.includes('India')))
  const jobs = (Number.isSafeInteger(maxJobs) && maxJobs >= 0 ? eligible.slice(0, maxJobs) : eligible).map(job => ({ ...job, scrapedAt: verifiedAt }))
  Object.defineProperty(jobs, 'sourceAudit', { value: audit })
  return attachInventoryEvidence(jobs, { status: 'discovery-only', surface: BOARD, firstParty: io.rawPages.some(page => page.transportQualified),
    pagesFetched: io.rawPages.filter(page => page.usable).length, listingComplete: false, reportedTotal: null, indiaFacetCount: null,
    verifiedAt, reason: 'native-role-criteria-deadlines-and-country-conflicts-retained-whole-source-activation-and-India-eligibility-unqualified' })
}
