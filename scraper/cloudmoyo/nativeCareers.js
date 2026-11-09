import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readNativeDocument, decodeNativeEntities } from '../../scraper-support/utils/activeNativeHtml.js'
import { createPublicIO } from '../../scraper-support/native-sources/publicIO.js'
import { readJobPosting, originalLinks, nodeText, plainHTML, normalizeText, geography, unknownGeography, nativeFields, appliesToIndia } from '../../scraper-support/native-sources/jobPostingData.js'
import { readSmartCollection, reconcileSmartObservations } from '../../scraper-support/native-sources/smartData.js'
import { CLOUDMOYO_CATALOG as catalog } from './catalog.js'

const API = 'https://api.smartrecruiters.com/v1/companies/CloudMoyo/postings?limit=100&offset=0'
const allowed = url => ['www.cloudmoyo.com', 'cloudmoyo.com'].includes(url.hostname)
  || url.hostname === 'api.smartrecruiters.com' && /^\/v1\/companies\/CloudMoyo\/postings(?:\/\d+)?$/.test(url.pathname)
  || url.hostname === 'careers.smartrecruiters.com' && /^\/CloudMoyo(?:\/|$)/.test(url.pathname)
  || url.hostname === 'www.linkedin.com' && (/^\/company\/cloudmoyo\/jobs\/?$/i.test(url.pathname)
    || /^\/jobs\/cloudmoyo-jobs-worldwide\/?$/i.test(url.pathname) || /^\/jobs\/view\/[^/]*-at-cloudmoyo-\d+\/?$/i.test(url.pathname))
const idOf = value => { try { return new URL(value).pathname.match(/-(\d+)\/?$/)?.[1] ?? null } catch { return null } }
const qualifiedCanonical = (value, expectedID) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.origin === 'https://www.linkedin.com' && !url.username && !url.password
      && /^\/jobs\/view\/[^/]*-at-cloudmoyo-\d+\/?$/i.test(url.pathname) && idOf(url.href) === expectedID
  } catch { return false }
}
const companyPath = value => { try { const url = new URL(value);return url.hostname === 'www.linkedin.com' && /^\/company\/cloudmoyo\/?$/i.test(url.pathname) } catch { return false } }
const inspectLinks = page => page?.usable && page.originalText ? originalLinks(readNativeDocument(page.originalText), page.url) : []

export const runCloudMoyo = async options => {
  const { signal, onAudit = () => {}, now = () => new Date().toISOString(), maxJobs = null } = options
  signal?.throwIfAborted()
  const io = createPublicIO({ ...options, allowed }), observations = [], currentLinks = [], models = new Map()
  let fatal = null, legacyOpening = null, legacyClosing = null, openingIDs = [], closingIDs = [], careerURL = null
  const inspectRole = async link => {
    const page = await io.load(link.url), expectedID = idOf(link.url)
    let model = null, syntax = null, bound = false, criteria = null, geo = unknownGeography(), title = link.text
    const problems = []
    if (page?.usable && page.originalText) {
      try {
        const parsed = readJobPosting(page.originalText)
        model = parsed.candidate?.model ?? null;syntax = parsed.candidate?.syntax ?? null
        const doc = parsed.document
        const h1 = doc.nodes(node => node.tag === 'h1')
        const ownIDs = doc.nodes(node => node.attrs['data-semaphore-content-urn']).map(node => node.attrs['data-semaphore-content-urn'])
        const canonicalNodes = doc.nodes(node => node.tag === 'link' && (node.attrs.rel || '').split(/\s+/).includes('canonical'))
        const canonical = canonicalNodes.length === 1 ? canonicalNodes[0].attrs.href : null
        const nativeTitle = typeof model?.title === 'string' ? normalizeText(decodeNativeEntities(model.title)) : null
        bound = Boolean(model && parsed.candidates.length === 1 && h1.length === 1 && nativeTitle === nodeText(h1[0])
          && normalizeText(link.text) === nativeTitle && ownIDs.length === 1 && ownIDs[0] === `urn:li:jobPosting:${expectedID}`
          && qualifiedCanonical(canonical, expectedID) && normalizeText(model.hiringOrganization?.name).toLowerCase() === 'cloudmoyo'
          && companyPath(model.hiringOrganization?.sameAs))
        if (bound) {
          // LinkedIn publishes one outer entity-escaped HTML layer in this
          // literal description. Decode that layer, then parse actual markup.
          criteria = plainHTML(decodeNativeEntities(model.description || ''))
          if (!criteria) bound = false
          else { geo = geography(model);title = nativeTitle }
        }
        if (!bound) problems.push('native-role-ID-title-company-or-criteria-unreconciled')
        if (parsed.errors.length) problems.push('native-structured-data-unreadable')
        return { title, company: 'CloudMoyo', source: catalog.source, jobId: bound ? expectedID : null, requisitionId: null,
          sourceUrl: bound ? canonical : link.url, applyUrl: bound ? canonical : link.url,
          country: bound ? geo.country : null, city: bound ? geo.city : null, state: bound ? geo.state : null,
          location: bound ? geo.location : null, locations: bound ? geo.locations : [],
          sourceNativeCountryCodes: bound ? geo.countries : [], sourceCountryScopeUnresolved: !bound || geo.unresolved,
          ...(bound ? nativeFields(model) : { postingDate: null, closingDate: null, employmentType: null, experienceRequired: null }),
          jobDescription: bound ? criteria : null, sourceDescription: bound ? criteria : null,
          sourceNativePlatform: 'linkedin', sourceNativeJobPosting: model, sourceNativeModelSyntax: syntax,
          sourceNativeRoleDetail: { bound, bodySHA256: page.bodySHA256, url: page.url, issues: problems },
          sourceNativeApplication: { originalLinks: originalLinks(doc, page.url).filter(item => /apply|sign.?in/i.test(item.text)), activationVerified: false, allControlsQualified: false },
          sourceDetailComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false }
      } catch (error) { problems.push('native-role-model-unreadable');io.issue('native-role-model-unreadable', { url: link.url, message: error.message }) }
    }
    return { title, company: 'CloudMoyo', source: catalog.source, jobId: null, requisitionId: null, sourceUrl: link.url, applyUrl: link.url,
      country: null, city: null, state: null, location: null, locations: [], jobDescription: null, sourceDescription: null,
      sourceNativePlatform: 'linkedin', sourceNativeJobPosting: model, sourceCountryScopeUnresolved: true, sourceNativeCountryCodes: [],
      sourceNativeRoleDetail: { bound: false, issues: problems.length ? problems : ['native-role-unavailable'] },
      sourceDetailComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false }
  }
  try {
    const contact = await io.follow(catalog.companyCareerPage)
    const links = inspectLinks(contact)
    if (!contact?.usable || !/cloudmoyo/i.test(plainHTML(contact.originalText || ''))) throw Error('Official CloudMoyo contact page is unavailable or changed')
    const life = links.find(link => new URL(link.url).hostname === 'www.cloudmoyo.com' && new URL(link.url).pathname === '/life-at-cloudmoyo/')
    legacyOpening = await readSmartCollection(io, API)
    const legacyContext = { companyID: 'CloudMoyo', companyName: 'CloudMoyo', source: catalog.source, boardURL: catalog.boardUrl }
    await reconcileSmartObservations(io, legacyOpening, observations, legacyContext)
    if (life) {
      careerURL = life.url
      const careers = await io.follow(life.url), careerLinks = inspectLinks(careers)
      currentLinks.push(...careerLinks)
      const allOldBoards = [...new Set([...links, ...careerLinks].filter(link => new URL(link.url).hostname === 'careers.smartrecruiters.com').map(link => link.url))]
      for (const url of allOldBoards) await io.load(url)
      const companyLink = careerLinks.find(link => new URL(link.url).hostname === 'www.linkedin.com' && /^\/company\/cloudmoyo\/jobs\/?$/i.test(new URL(link.url).pathname))
      if (companyLink) {
        const company = await io.follow(companyLink.url), companyLinks = inspectLinks(company)
        const roles = companyLinks.filter(link => idOf(link.url) && /-at-cloudmoyo-\d+\/?$/i.test(new URL(link.url).pathname))
        openingIDs = [...new Set(roles.map(link => idOf(link.url)))].sort()
        for (const link of roles) if (!models.has(idOf(link.url))) models.set(idOf(link.url), link)
        const allJobs = companyLinks.find(link => /^\/jobs\/cloudmoyo-jobs-worldwide\/?$/i.test(new URL(link.url).pathname) && link.text === 'See all jobs')
        if (allJobs) {
          const listing = await io.follow(allJobs.url)
          for (const link of inspectLinks(listing).filter(link => idOf(link.url) && /-at-cloudmoyo-\d+\/?$/i.test(new URL(link.url).pathname))) if (!models.has(idOf(link.url))) models.set(idOf(link.url), link)
          const closing = await io.follow(allJobs.url, { fresh: true })
          const closingRoles = inspectLinks(closing).filter(link => idOf(link.url) && /-at-cloudmoyo-\d+\/?$/i.test(new URL(link.url).pathname))
          closingIDs = [...new Set(closingRoles.map(link => idOf(link.url)))].sort()
          for (const link of closingRoles) if (!models.has(idOf(link.url))) models.set(idOf(link.url), link)
          if (JSON.stringify(openingIDs) !== JSON.stringify(closingIDs)) io.issue('native-opening-closing-IDs-differ', { openingIDs, closingIDs })
        } else io.issue('native-all-jobs-link-unavailable')
        for (const link of models.values()) observations.push(await inspectRole(link))
        const closingCompany = await io.follow(companyLink.url, { fresh: true })
        for (const link of inspectLinks(closingCompany).filter(link => idOf(link.url) && /-at-cloudmoyo-\d+\/?$/i.test(new URL(link.url).pathname))) {
          if (!models.has(idOf(link.url))) { models.set(idOf(link.url), link);observations.push(await inspectRole(link)) }
        }
      } else io.issue('current-native-hiring-channel-unavailable')
      legacyClosing = await readSmartCollection(io, API, { fresh: true })
      if (JSON.stringify(legacyOpening.records) !== JSON.stringify(legacyClosing.records)) io.issue('legacy-native-opening-closing-records-differ')
      await reconcileSmartObservations(io, legacyClosing, observations, legacyContext, { fresh: true })
      await io.follow(life.url, { fresh: true });await io.follow(catalog.companyCareerPage, { fresh: true })
    } else io.issue('current-official-careers-link-unavailable')
  } catch (error) { signal?.throwIfAborted();fatal = error }
  const audit = { source: catalog.source, observations, rawPages: io.rawPages, issues: io.issues, currentCareerLinks: currentLinks,
    legacyOpening, legacyClosing, openingIDs, closingIDs, authoritativeSourceTotal: null, authoritativeIndiaFacetCount: null,
    sourceScopeComplete: false, lifecycleCleanupAllowed: false,
    qualification: 'Original current native observations, including non-India roles. Obsolete API zero and generic-board redirects are not company/India zero or complete coverage.' }
  await onAudit(structuredClone(audit));signal?.throwIfAborted()
  if (fatal) throw fatal
  const selected = observations.filter(job => !job.sourceCompanyScopeUnresolved && appliesToIndia(job))
  const count = Number.isSafeInteger(maxJobs) && maxJobs >= 0 ? maxJobs : null
  const jobs = (count == null ? selected : selected.slice(0, count)).map(job => ({ ...job, link: job.applyUrl, scrapedAt: now() }))
  Object.defineProperty(jobs, 'sourceAudit', { value: audit })
  return attachInventoryEvidence(jobs, { status: 'discovery-only', surface: careerURL || catalog.companyCareerPage, firstParty: io.rawPages.some(page => page.transportQualified),
    listingComplete: false, pagesFetched: io.rawPages.filter(page => page.usable).length, reportedTotal: null, indiaFacetCount: null, verifiedAt: now(),
    reason: 'current-native-role-data-retained-legacy-zero-not-full-source-country-availability-or-application-proof' })
}
