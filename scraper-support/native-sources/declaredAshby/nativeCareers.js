import { readNativeDocument } from '../../utils/activeNativeHtml.js'
import { createPublicIO } from '../publicIO.js'
import { readJobPosting, unknownGeography } from '../jobPostingData.js'
import { attachInventoryEvidence } from '../../utils/inventoryEvidence.js'
import * as native from './nativeData.js'

// Opt-in identity-bound reader; existing ATS adapters and prior sources unchanged.
export const createDeclaredAshbyScraper = contract => {
const HOME = contract.primaryURL, BOARD = contract.boardURL, API = contract.apiURL
const { appData, decode, text, plain, requireNative, documentLinks, nativeDate, locationNames, nativePlaces, fullCriteria } = native
const roleURL = (value, id, application = false) => native.roleURL(contract, value, id, application)
const nativeOrganization = value => native.nativeOrganization(contract, value)
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const allowed = url => !url.hash && !url.search && (
  url.href === HOME || url.href === API
  || url.origin === 'https://jobs.ashbyhq.com' && new RegExp('^/' + contract.boardSlug + '(?:/[0-9a-f-]{36})?$').test(url.pathname))
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const boardData = page => {
  requireNative(page?.usable && page.transportQualified && page.originalText, 'Native board unavailable')
  const data = appData(readNativeDocument(page.originalText))
  requireNative(nativeOrganization(data.organization) && Array.isArray(data.jobBoard?.jobPostings), 'Native organization or board changed')
  const records = data.jobBoard.jobPostings
  requireNative(records.every(record => uuid.test(record.id) && text(record.title) && Array.isArray(record.secondaryLocations))
    && new Set(records.map(record => record.id)).size === records.length, 'Duplicate/malformed native board identities')
  return data
}
const feedData = (io, page) => {
  requireNative(page?.usable && page.transportQualified, 'Native API transport unqualified')
  const data = io.json(page)
  requireNative(data?.apiVersion === '1' && Array.isArray(data.jobs) && !data.error && !data.errors && data.success !== false, 'Native API envelope unavailable')
  return data
}
const delegation = page => {
  if (!page?.usable || !page.transportQualified || !page.originalText) return { qualified: false, links: [], embeddingDeclarations: [] }
  const doc = readNativeDocument(page.originalText), links = documentLinks(page.originalText, HOME)
  const embeddingDeclarations = contract.embeddingScript ? doc.nodes(node => node.tag === 'script' && !node.inert
    && !Object.hasOwn(node.attrs, 'nomodule')
    && ['', 'text/javascript', 'application/javascript', 'module'].includes((node.attrs.type || '').trim().toLowerCase())
    && node.attrs.src === contract.embeddingScript).map(node => ({ originalAttributes: { ...node.attrs }, URL: node.attrs.src, JavaScriptExecuted: false })) : []
  const advertised = links.some(link => {
    try { const url = new URL(link.url);return url.origin === 'https://jobs.ashbyhq.com' && !url.username && !url.password
      && (url.pathname === '/' + contract.boardSlug || roleURL(link.url, url.pathname.split('/')[2])) } catch { return false }
  }) || embeddingDeclarations.length === 1
  return { qualified: plain(page.originalText).toLowerCase().includes(contract.companyName.toLowerCase()) && advertised, links, embeddingDeclarations }
}
const runNative = async (options = {}) => {
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
      const derived = nativeOrganization(board?.organization) && ['/', '/' + contract.boardSlug].includes(board.routerPrefix) ? BOARD + '/' + id : null
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
        requireNative(page.transportQualified, 'Native role transport unqualified')
        const parsed = readJobPosting(page.originalText), data = appData(parsed.document)
        posting = data.posting ?? null;organization = data.organization ?? null;schema = parsed.candidate?.model ?? null
        const meta = property => parsed.document.nodes(node => node.tag === 'meta' && node.attrs.property === property).map(node => decode(node.attrs.content || ''))
        const title = parsed.document.nodes(node => node.tag === 'title').map(node => text(decode(node.raw || '')))
        const urls = meta('og:url'), titles = meta('og:title')
        const canonicals = parsed.document.nodes(node => node.tag === 'link' && (node.attrs.rel || '').split(/\s+/).includes('canonical'))
        requireNative(companyQualified && nativeOrganization(organization) && (!board || organization.organizationId === board.organization.organizationId), 'Current company/native organization delegation unqualified')
        requireNative(!context.conflicts.length && (!record || typeof record.isListed === 'boolean' && Array.isArray(record.secondaryLocations)
          && roleURL(record.jobUrl, id) && roleURL(record.applyUrl, id, true)), 'Unique coherent native API record unavailable')
        requireNative(posting?.id === id && schema?.identifier?.value === id && schema.identifier.name === contract.companyName
          && schema.hiringOrganization?.name === contract.companyName && new URL(schema.hiringOrganization.sameAs).origin === contract.websiteOrigin, 'Native role/company identity disagreement')
        requireNative(parsed.candidates.length === 1 && !parsed.errors.length && posting.isListed === true && posting.isConfidential === false
          && (!record || record.isListed === true), 'Native role publication or structured data unqualified')
        const ownTitle = text(posting.title)
        requireNative([schema.title, ...(brief ? [brief.title] : []), ...(record ? [record.title] : [])].every(value => text(decode(value)) === ownTitle)
          && title.length === 1 && title[0] === ownTitle + ' @ ' + contract.companyName
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
    return { title: bound ? text(posting.title) : context.title, company: contract.companyName, source: contract.source, jobId: id, requisitionId: null,
      sourceUrl, applyUrl, link: applyUrl, applicationUrlIsGeneric: !bound || !record,
      country: geo.country, city: geo.city, state: geo.state, location: geo.location, locations: geo.locations,
      sourceNativeCountryCodes: geo.countries, sourceCountryScopeUnresolved: !bound || geo.unresolved && !geo.indiaWorksiteQualified,
      sourceCompanyScopeUnresolved: !bound, sourceNativePostingIdentityQualified: bound,
      jobDescription: description, sourceDescription: description, postingDate: bound ? nativeDate(record?.publishedAt ?? schema.datePosted) : null, closingDate: deadline,
      employmentType: bound ? text(posting.employmentType) || null : null,
      employmentTypeProvenance: bound && text(posting?.employmentType) ? 'source' : null,
      remoteStatus: bound ? text(posting.workplaceType) || null : null,
      sourceEmploymentTypeUnresolved: !bound || !['FullTime', 'Contract', 'Intern'].includes(posting?.employmentType),
      sourceRemoteStatusUnresolved: !bound || !text(posting?.workplaceType),
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
    const openingContexts = contexts(openingFeed, openingBoard, openingCompany.links), openingResults = []
    let nextOpening = 0
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (nextOpening < openingContexts.length) {
        const index = nextOpening++, context = openingContexts[index]
        openingResults[index] = await inspect(context, openingBoard, openingCompany.qualified)
      }
    }))
    for (let index = 0; index < openingContexts.length; index++) {
      const context = openingContexts[index]
      records.set(context.id, context);observations.set(context.id, openingResults[index])
    }
    try { closingFeed = feedData(io, await io.load(API, { kind: 'json', fresh: true })) }
    catch (error) { signal?.throwIfAborted();io.issue('closing-native-API-unavailable', { message: error.message }) }
    try { closingBoard = boardData(await io.load(BOARD, { fresh: true })) }
    catch (error) { signal?.throwIfAborted();io.issue('closing-native-board-unavailable', { message: error.message }) }
    closingCompany = delegation(await io.load(HOME, { fresh: true }))
    const closingContexts = contexts(closingFeed, closingBoard, closingCompany.links)
    for (const context of closingContexts) {
      const previous = records.get(context.id), earlier = observations.get(context.id)
      const newLink = Boolean(context.originalCorporateLink && context.originalCorporateLink.url !== previous?.originalCorporateLink?.url)
      const changedAPI = Boolean(context.index && (!previous?.index || !equal(previous.index, context.index)))
      const changedBrief = Boolean(context.brief && (!previous?.brief || !equal(previous.brief, context.brief)))
      const changedConflicts = context.conflicts.length && !equal(previous?.conflicts, context.conflicts)
      const recoverableMissingDetail = Boolean(!earlier?.sourceNativePosting && context.url
        && earlier?.sourceNativeRoleDetail.issues.includes('native-role-unavailable-or-not-listed'))
      const newlyQualified = Boolean(!earlier?.sourceNativeRoleDetail.bound && closingCompany.qualified
        && (!openingCompany.qualified || context.index && context.brief && (!previous?.index || !previous?.brief)))
      if (!previous || newLink || changedAPI || changedBrief || changedConflicts || recoverableMissingDetail || newlyQualified) {
        io.issue('native-closing-new-or-changed-record', { id: context.id })
        const current = await inspect(context, closingBoard, closingCompany.qualified, true)
        records.set(context.id, context)
        const history = [...(earlier?.sourceNativeObservationHistory || (earlier ? [structuredClone(earlier)] : [])), structuredClone(current)]
        if (earlier?.jobDescription && !current.jobDescription) observations.set(context.id, { ...earlier,
          sourceNativeClosingObservation: current, sourceNativeObservationHistory: history, sourceCurrentNativeRoleQualified: false,
          sourceNativeTemporalQualification: 'earlier-full-positive-retained-closing-role-evidence-unqualified' })
        else observations.set(context.id, { ...current, sourceNativeObservationHistory: history })
      } else if (earlier && (!closingBoard || !context.brief || !closingFeed || !context.index)) {
        earlier.sourceNativeTemporalQualification = 'earlier-full-positive-retained-closing-collection-missing-or-unavailable'
        earlier.sourceCurrentNativeRoleQualified = false
      }
    }
    const closingIds = new Set(closingContexts.map(context => context.id))
    for (const [id, job] of observations) if (!closingIds.has(id)) {
      job.sourceCurrentNativeRoleQualified = false
      job.sourceNativeTemporalQualification = 'earlier-full-positive-retained-closing-collection-missing-or-unavailable'
    }
    if (!equal(openingFeed?.jobs, closingFeed?.jobs) || !equal(openingBoard?.jobBoard, closingBoard?.jobBoard)) io.issue('native-opening-closing-inventory-differ')
    if (!closingCompany.qualified) {
      io.issue('closing-corporate-native-delegation-unqualified')
      for (const job of observations.values()) Object.assign(job, {
        sourceCompanyScopeUnresolved: true, sourceCurrentNativeRoleQualified: false,
        sourceNativeClosingDelegation: structuredClone(closingCompany),
        sourceNativeTemporalQualification: 'earlier-full-positive-retained-closing-corporate-delegation-unqualified' })
    }
  } catch (error) { signal?.throwIfAborted();fatal = error }
  const all = [...observations.values()]
  const audit = { source: contract.source, observations: all, rawPages: io.rawPages, issues: io.issues,
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

return { name: contract.source, run: runNative }
}
