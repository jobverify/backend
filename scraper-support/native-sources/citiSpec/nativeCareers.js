import { readNativeDocument } from '../../utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../utils/inventoryEvidence.js'
import { createPublicIO, sha256 } from '../publicIO.js'
import { readJobPosting, countryName } from '../jobPostingData.js'
import { text, plain, content, children, hasClass, only, requirePublished, canonical, dayDate, offsetDate, absolute } from '../cisVeeam/publishedData.js'
import { CITI_PRIMARY, CITI_ASSETS, citiRoleURL, readCitiSearch, citiPagination } from './citiProfile.js'

const SPEC_PRIMARY = 'https://www.spec-india.com/career/'
const specRole = value => {
  try { const url = new URL(value);return url.origin === 'https://www.spec-india.com' && !url.username && !url.password && !url.search && !url.hash
    && /^\/current-opening\/[a-z0-9-]+$/.test(url.pathname) } catch { return false }
}
const sourceLinks = (html, base, predicate) => readNativeDocument(html).nodes(node => node.tag === 'a' && node.attrs.href).flatMap(node => {
  const url = absolute(node.attrs.href, base)
  return predicate(url) ? [{ sourceUrl: url, url, title: content(node), originalAttributes: { ...node.attrs } }] : []
})
export const specCards = html => [...new Map(sourceLinks(html, SPEC_PRIMARY, specRole).map(link => [link.url, link])).values()]
export const specOfficial = html => readNativeDocument(html).nodes(node => node.tag === 'title').some(node => /Join Our Team\s*\|\s*SPEC INDIA/i.test(node.raw || ''))
const literalCountry = value => {
  const raw = text(value)
  return raw.length > 3 || raw === 'USA' ? countryName(raw) : null
}
const visiblePlaces = label => {
  const places = [];let pending = []
  for (const token of text(label).split(',').map(text).filter(Boolean)) {
    pending.push(token)
    const country = literalCountry(token)
    if (country) { places.push({ country, originalLabel: pending.join(', '), cityLabel: pending.length > 1 ? pending[0] : null,
      state: pending.length > 2 ? pending.slice(1, -1).join(', ') : null });pending = [] }
  }
  if (pending.length) places.push({ country: null, originalLabel: pending.join(', '), cityLabel: null })
  return places
}
const projectPlaces = (model, visibleLabel) => {
  const sourcePlaces = Array.isArray(model?.jobLocation) ? model.jobLocation : model?.jobLocation ? [model.jobLocation] : []
  const typed = sourcePlaces.map(place => ({ country: countryName(place?.address?.addressCountry), cityLabel: text(place?.address?.addressLocality) || null,
    state: text(place?.address?.addressRegion) || null, original: place,
    streetLabel: text(place?.address?.streetAddress) || null, postalLabel: text(place?.address?.postalCode) || null,
    originalLabel: [place?.address?.addressLocality, place?.address?.addressRegion, countryName(place?.address?.addressCountry)].filter(Boolean).join(', ') }))
  const visible = visiblePlaces(visibleLabel), sameCity = (a, b) => a && b && a.toLowerCase() === b.toLowerCase()
  const sameWorksite = (a, b) => {
    if (!sameCity(a.cityLabel, b.cityLabel)) return false
    for (const key of ['streetLabel', 'postalLabel']) if (a[key] && b[key] && !sameCity(a[key], b[key])) return false
    // An abbreviated or absent region cannot disambiguate two same-named
    // worksites. Two explicitly different full region names can.
    return !a.state || !b.state || sameCity(a.state, b.state)
      || /^[a-z]{1,3}$/i.test(a.state) || /^[a-z]{1,3}$/i.test(b.state)
  }
  const all = [...typed, ...visible], conflicts = []
  for (let at = 0; at < all.length; at++) for (const other of all.slice(at + 1)) {
    const place = all[at]
    if (place.country && other.country && place.country !== other.country && sameWorksite(place, other)) conflicts.push({ first: place, second: other })
  }
  const qualified = all.filter(place => place.country), countries = [...new Set(qualified.map(place => place.country))]
  const selectedCountry = countries.includes('India') ? 'India' : countries.length === 1 ? countries[0] : null
  const selected = qualified.filter(place => place.country === selectedCountry)
  const ownedVisible = visible.filter(place => place.country === selectedCountry)
  const display = [...ownedVisible, ...typed.filter(place => place.country === selectedCountry && !ownedVisible.some(other =>
    sameWorksite(place, other) && place.country === other.country))]
  const unique = [...new Map(display.map(place => [place.originalLabel, place])).values()]
  const conflict = conflicts.length > 0, country = conflict ? null : selectedCountry
  return { country, city: !conflict && typed.length === 1 && typed[0].country === country ? typed[0].cityLabel : null,
    state: !conflict && typed.length === 1 && typed[0].country === country ? typed[0].state : null,
    location: country ? unique.map(place => place.originalLabel).filter(Boolean).join('; ') || country : null,
    locations: country ? unique.map(place => place.originalLabel).filter(Boolean) : [],
    sourceNativeCountryCodes: countries, sourceCountryScopeUnresolved: !country || all.some(place => !place.country), sourceNativeCountryConflict: conflict,
    sourceNativeOriginalJobLocations: structuredClone(model?.jobLocation ?? null), sourceNativeVisibleLocationLabel: visibleLabel || null,
    sourceNativePlaceEvidence: { typed: structuredClone(typed), visible, samePlaceConflicts: conflicts } }
}
const afterLabel = (root, label) => {
  const values = []
  const visit = node => {
    const parts = node.children
    for (let at = 0; at < parts.length; at++) {
      const child = parts[at]
      if (typeof child === 'string') continue
      if (/^h[1-6]$/.test(child.tag) && content(child).replace(/:$/, '').toLowerCase() === label.toLowerCase()) {
        for (const following of parts.slice(at + 1)) {
          if (typeof following !== 'string' && /^h[1-6]$/.test(following.tag)) break
          const value = typeof following === 'string' ? text(following) : content(following)
          if (value && /[\p{L}\p{N}]/u.test(value)) { values.push(value);break }
        }
      }
      if (!child.inert && !['script', 'style'].includes(child.tag)) visit(child)
    }
  }
  visit(root)
  return [...new Set(values)]
}
export const citiDetail = (html, listing = {}) => {
  const url = listing.sourceUrl || listing.url
  requirePublished(citiRoleURL(url), 'Missing own Citi role URL')
  const parsed = readJobPosting(html, { rawControls: true })
  requirePublished(parsed.candidate && !parsed.errors.length, 'Own Citi structured posting missing, duplicate or unreadable')
  const doc = parsed.document, model = parsed.candidate.model, id = new URL(url).pathname.split('/').at(-1)
  const owner = only(doc.nodes(node => node.tag === 'section' && node.attrs['data-selector-name'] === 'jobdetails' && node.attrs['data-org-id'] === '287' && node.attrs['data-job-id'] === id), 'owned Citi role section')
  const title = content(only(children(owner, node => node.tag === 'h1' && hasClass(node, 'job-title-heading')), 'owned Citi role title'))
  requirePublished(canonical(doc, url) && model.url === url && text(model.title) === title && model.hiringOrganization?.name === 'CITI', 'Own Citi canonical/title/employer conflict')
  const fields = {}
  for (const node of children(owner, node => hasClass(node, 'job-description__desc-job-info'))) {
    const label = content(only(children(node, child => hasClass(child, 'job-description__desc-term')), 'native field label'))
    requirePublished(!Object.hasOwn(fields, label), 'Duplicate Citi role field ' + label)
    fields[label] = content(only(children(node, child => hasClass(child, 'job-description__desc-detail')), 'native field value'))
  }
  const requisition = fields['Job Req Id:'], meta = only(doc.nodes(node => node.tag === 'meta' && node.attrs.name === 'job-ats-req-id'), 'native ATS requisition meta').attrs.content
  requirePublished(requisition && requisition === meta && model.identifier?.name === 'Job ID' && String(model.identifier.value) === requisition, 'Native requisition labels/identifier conflict')
  const ats = only(children(owner, node => hasClass(node, 'ats-description')), 'full owned Citi ATS description')
  const own = content(ats), schema = plain(model.description)
  requirePublished(own && schema, 'Native Citi criteria absent')
  const full = own.includes(schema) ? own : schema.includes(own) ? schema : own + ' Also published in the structured posting: ' + schema
  const timeTypes = afterLabel(ats, 'Time Type'), literalType = timeTypes.length === 1 ? timeTypes[0] : null
  const employment = literalType === 'Full time' ? 'Full-time' : literalType === 'Part time' ? 'Part-time' : null
  const arrangement = fields['Job Type:'] || null, remoteStatus = arrangement === 'Hybrid' ? 'Hybrid' : arrangement === 'On-Site' ? 'On-site' : arrangement === 'Remote' ? 'Remote' : null
  const applies = children(owner, node => node.tag === 'a' && hasClass(node, 'job-apply') && node.attrs['data-job-id'] === id).map(node => ({ ...node.attrs }))
  const targets = [...new Set(applies.map(node => node.href))]
  const applyURL = only(targets, 'owned advertised application target')
  const target = new URL(applyURL)
  requirePublished(target.protocol === 'https:' && !target.username && !target.password, 'Unsupported advertised application URI')
  return { source: 'citiindia', sourceUrl: url, detailUrl: url, title, company: 'CITI', jobId: id, requisitionId: requisition,
    ...projectPlaces(model, fields['Location(s):']), jobDescription: full,
    sourceNativeJobPosting: structuredClone(model), sourceNativeSchemaOriginal: parsed.candidate.raw, sourceNativeSchemaSyntax: parsed.candidate.syntax,
    sourceNativeOwnCriteriaText: own, sourceNativeSchemaCriteriaText: schema, sourceNativeRoleFacts: fields,
    sourceNativeApplicationDeclarations: applies, applyUrl: applyURL, link: applyURL,
    // The existing public enum excludes Part-time; guard its generic Full-time
    // fallback while keeping the literal source hours and parsed value intact.
    sourceEmploymentType: literalType, employmentType: employment, sourceEmploymentTypeUnresolved: employment !== 'Full-time',
    sourceNativeTimeTypeValues: timeTypes, sourceNativeWorkArrangement: arrangement, remoteStatus, sourceRemoteStatusUnresolved: true,
    sourcePostingDate: model.datePosted ?? null, postingDate: dayDate(model.datePosted), sourcePostingDatePrecision: 'day',
    sourceClosingDate: model.validThrough ?? null, closingDate: dayDate(model.validThrough) || offsetDate(model.validThrough),
    experienceRequired: null, sourceExperienceRequired: null, requiredSkills: [],
    companyCareerPage: CITI_PRIMARY, companyDomain: 'jobs.citi.com', atsPlatform: 'talentbrew-radancy' }
}
const specDetail = (html, link) => {
  const doc = readNativeDocument(html), url = link.url
  const canonicalClaims = doc.nodes(node => node.tag === 'link' && node.attrs.rel?.toLowerCase() === 'canonical').map(node => node.attrs.href)
  const ogClaims = [...new Set(doc.nodes(node => node.tag === 'meta' && node.attrs.property === 'og:url').map(node => node.attrs.content))]
  requirePublished(specRole(url) && canonicalClaims.every(value => value === url) && ogClaims.length === 1 && ogClaims[0] === url,
    'SPEC own role URL claims conflict or are missing')
  const head = only(doc.nodes(node => hasClass(node, 'curen_head')), 'SPEC own role header')
  const title = content(only(children(head, node => node.tag === 'h1' && node.attrs.id === 'job-title'), 'SPEC own role title'))
  const criteria = only(doc.nodes(node => hasClass(node, 'roal_respo_main')), 'SPEC own criterion section')
  const blocks = criteria.children.filter(child => typeof child !== 'string' && (hasClass(child, 'roal_respo_sec') || hasClass(child, 'skills_sec')))
  requirePublished(blocks.length >= 2 && blocks.every(block => content(block)), 'SPEC complete duty/skill sections missing')
  const fields = {}
  for (const block of children(head, node => hasClass(node, 'cure_req_bx'))) {
    const label = content(only(children(block, node => node.tag === 'h6'), 'SPEC role fact label'))
    fields[label] = content(only(children(block, node => node.tag === 'p'), 'SPEC role fact value'))
  }
  const body = only(doc.nodes(node => node.tag === 'body'), 'SPEC page body')
  requirePublished(hasClass(body, 'single-current-opening'), 'SPEC page is not the native role template')
  const cms = body.attrs.class?.match(/(?:^|\s)postid-(\d+)(?:\s|$)/)?.[1] ?? null
  return { source: 'specindia', sourceUrl: url, detailUrl: url, title, company: 'SPEC INDIA', jobId: null, requisitionId: null,
    ...projectPlaces(null, fields['Job Location']), sourceNativeRoleFacts: fields, sourceNativeCMSPostId: cms,
    sourceNativeRoleIdentity: { advertisedURL: url, originalCanonicalClaims: canonicalClaims, originalOpenGraphURLs: ogClaims, CMSPostId: cms },
    sourceNativeNonJobStructuredData: doc.nodes(node => node.tag === 'script' && node.attrs.type === 'application/ld+json').map(node => node.raw),
    sourceNativeOwnCriteriaText: blocks.map(content).join(' '), jobDescription: blocks.map(content).join(' '),
    sourceNativeCriteriaBlocks: blocks.map(block => ({ originalAttributes: { ...block.attrs }, text: content(block) })),
    experienceRequired: fields.Experience || null, sourceExperienceRequired: fields.Experience || null, experienceRequiredProvenance: 'source',
    requiredSkills: blocks.filter(block => hasClass(block, 'skills_sec')).flatMap(block => children(block, node => node.tag === 'li').map(content)),
    employmentType: null, sourceEmploymentType: null, sourceEmploymentTypeUnresolved: true, remoteStatus: null, sourceRemoteStatusUnresolved: true,
    postingDate: null, sourcePostingDate: null, sourcePostingDatePrecision: null, closingDate: null, sourceClosingDate: null,
    applyUrl: url, link: url, companyCareerPage: SPEC_PRIMARY, companyDomain: 'spec-india.com', atsPlatform: 'official-company-careers' }
}
const workers = async (items, visit, signal) => {
  let next = 0
  const settled = await Promise.allSettled(Array.from({ length: 4 }, async () => { while (next < items.length) { signal?.throwIfAborted();await visit(items[next++]) } }))
  const failure = settled.find(item => item.status === 'rejected');if (failure) throw failure.reason
}
const roleIdentity = job => ({ source: job.source, sourceUrl: job.sourceUrl, detailUrl: job.detailUrl, company: job.company,
  jobId: job.jobId, requisitionId: job.requisitionId, CMSPostId: job.sourceNativeCMSPostId ?? null, applicationTarget: job.applyUrl })
const collectCiti = async (io, phase, signal) => {
  const result = { phase, qualified: false, searchPages: [], links: [], distinctRoleURLs: 0, nativeAssets: [] }
  const first = await io.follow(CITI_PRIMARY, { fresh: true })
  if (!first?.usable) return result
  try {
    const initial = readCitiSearch(first.originalText), doc = initial.document
    const title = only(doc.nodes(node => node.tag === 'title'), 'Citi primary title')
    requirePublished(/Citi Careers/.test(title.raw || ''), 'Citi primary employer title missing')
    const declarations = doc.nodes(node => node.tag === 'script' && node.attrs.src && !Object.hasOwn(node.attrs, 'nomodule')
      && ['', 'text/javascript', 'application/javascript', 'module'].includes((node.attrs.type || '').trim().toLowerCase()))
      .map(node => ({ url: absolute(node.attrs.src, first.url), originalAttributes: { ...node.attrs } }))
    for (const [url, expectedSHA] of Object.entries(CITI_ASSETS)) {
      requirePublished(declarations.some(item => item.url === url), 'Current primary does not declare the supported native asset')
      const page = await io.load(url, { fresh: true })
      const hash = page?.bodySHA256 || (page?.originalText ? sha256(Buffer.from(page.originalText)) : null)
      requirePublished(page?.usable && hash === expectedSHA, 'Current native search asset profile changed')
      result.nativeAssets.push({ url, sha256: hash, originalDeclarations: declarations.filter(item => item.url === url) })
    }
    const pages = new Map([[1, initial]])
    await workers(Array.from({ length: initial.totalPages - 1 }, (_, index) => index + 2), async number => {
      const request = citiPagination(initial, number), response = await io.load(request.url, { fresh: true }), envelope = io.json(response)
      if (!envelope || envelope.hasJobs !== true || envelope.hasContent !== false || typeof envelope.results !== 'string') {
        io.issue('native-search-page-unavailable', { phase, page: number });return
      }
      const parsed = readCitiSearch(envelope.results)
      requirePublished(parsed.currentPage === number && parsed.totalPages === initial.totalPages && parsed.reportedJobs === initial.reportedJobs, 'Native page counters changed during traversal')
      pages.set(number, parsed)
    }, signal)
    const found = new Map()
    for (const [number, page] of [...pages].sort(([a], [b]) => a - b)) {
      result.searchPages.push({ currentPage: number, totalPages: page.totalPages, reportedJobs: page.reportedJobs, cards: page.cards })
      for (const card of page.cards) found.set(card.url, card)
    }
    result.links = [...found.values()];result.distinctRoleURLs = found.size;result.reportedNativeFacetTotal = initial.reportedJobs
    result.qualified = pages.size === initial.totalPages && found.size === initial.reportedJobs
  } catch (error) { signal?.throwIfAborted();io.issue('native-citi-discovery-held', { phase, message: error.message }) }
  return result
}
const collectSpec = async (io, phase) => {
  const primary = await io.follow(SPEC_PRIMARY, { fresh: true }), result = { phase, qualified: false, links: [], pages: [] }
  if (!primary?.usable || !specOfficial(primary.originalText)) return result
  const found = specCards(primary.originalText), boards = [...new Set(sourceLinks(primary.originalText, primary.url,
    value => value === 'https://www.spec-india.com/current-opening').map(link => link.url))]
  for (const url of boards) {
    const page = await io.follow(url, { fresh: true });result.pages.push({ url, usable: Boolean(page?.usable) })
    if (page?.usable) found.push(...specCards(page.originalText))
  }
  result.links = [...new Map(found.map(link => [link.url, link])).values()]
  result.qualified = result.links.length > 0 && boards.length > 0 && result.pages.every(page => page.usable)
  return result
}
export const createCitiSpecScraper = (source, defaults = {}) => ({ async run(passed = {}) {
  const options = { ...defaults, ...passed }, { signal, onAudit = () => {}, maxJobs = null, now = () => new Date().toISOString() } = options
  requirePublished(options.maxPages == null || options.maxPages === Number.POSITIVE_INFINITY,
    'Finite maxPages is unsupported: current advertised scope must be traversed; maxJobs only caps candidates after audit')
  const primary = source === 'citiindia' ? CITI_PRIMARY : SPEC_PRIMARY, observedAt = now()
  const routeAllowed = url => source === 'citiindia' ? url.href === CITI_PRIMARY || citiRoleURL(url.href) || Object.hasOwn(CITI_ASSETS, url.href)
    || url.origin === 'https://jobs.citi.com' && url.pathname === '/search-jobs/results' && !url.username && !url.password
    : url.origin === 'https://www.spec-india.com' && !url.username && !url.password && !url.search && !url.hash
      && ([new URL(SPEC_PRIMARY).pathname, '/about/career', '/current-opening'].includes(url.pathname) || specRole(url.href))
  const allowed = url => routeAllowed(url) && !io.rawPages.some(page => [401, 403, 429].includes(page.status)
    && new URL(page.url).hostname === url.hostname)
  const io = createPublicIO({ ...options, allowed }), observations = new Map(), history = [], discoveryOrder = new Map()
  let opening, closing, fatal = null
  try {
    for (const phase of ['opening', 'closing']) {
      signal?.throwIfAborted()
      const discovered = source === 'citiindia' ? await collectCiti(io, phase, signal) : await collectSpec(io, phase)
      if (phase === 'opening') opening = discovered;else closing = discovered
      // Opening page/card order comes first; closing-only records append in
      // their declared order. Network completion timing never selects a prefix.
      for (const link of discovered.links) if (!discoveryOrder.has(link.url)) discoveryOrder.set(link.url, discoveryOrder.size)
      await workers(discovered.links, async link => {
        const job = { source, sourceUrl: link.url, title: link.title, jobDescription: null, country: null, city: null, state: null, location: null, locations: [],
          sourceCountryScopeUnresolved: true, sourceCurrentNativeRoleQualified: false, sourceNativePhase: phase, sourceNativeIssues: [],
          sourceNativeListingDeclaration: link, sourceScopeComplete: false, sourceDetailComplete: false, lifecycleCleanupAllowed: false }
        try {
          const page = await io.follow(link.url, { fresh: true })
          requirePublished(page?.usable, 'Own published role unavailable')
          job.sourceNativeOwnBodySHA256 = page.bodySHA256
          Object.assign(job, source === 'citiindia' ? citiDetail(page.originalText, link) : specDetail(page.originalText, link))
          job.sourceCurrentNativeRoleQualified = !job.sourceNativeCountryConflict
        } catch (error) { signal?.throwIfAborted();job.sourceNativeIssues.push(error.message);io.issue('own-role-held', { phase, url: link.url, message: error.message }) }
        const earlier = observations.get(link.url)
        if (earlier) {
          if (earlier.jobDescription && job.jobDescription) {
            const first = roleIdentity(earlier), last = roleIdentity(job), changed = Object.keys(first).filter(key => first[key] !== last[key])
            if (changed.length) {
              Object.assign(job, { sourceCurrentNativeRoleQualified: false,
                sourceNativeTemporalQualification: 'opening-closing-role-identity-or-application-target-changed',
                sourceNativeTemporalIdentityChange: { opening: first, closing: last, changedFields: changed } })
              job.sourceNativeIssues.push('Opening/closing role identity or application handoff changed')
              io.issue('closing-role-identity-or-handoff-changed', { url: link.url, changedFields: changed })
            }
          }
          history.push({ url: link.url, earlier: structuredClone(earlier), current: structuredClone(job) })
          if (earlier.jobDescription && !job.jobDescription) Object.assign(earlier, { sourceCurrentNativeRoleQualified: false,
            sourceNativeTemporalQualification: 'earlier-complete-text-retained-current-role-held', sourceNativeClosingObservation: job })
          else observations.set(link.url, job)
        } else observations.set(link.url, job)
      }, signal)
    }
  } catch (error) { fatal = error }
  const closed = new Set((closing?.links || []).map(link => link.url))
  for (const [url, job] of observations) if (!closing?.qualified || !closed.has(url)) Object.assign(job, {
    sourceCurrentNativeRoleQualified: false, sourceNativeTemporalQualification: 'earlier-published-text-retained-closing-discovery-unqualified-or-missing' })
  const ordinal = url => discoveryOrder.get(url) ?? Number.MAX_SAFE_INTEGER
  const all = [...observations.values()].sort((a, b) => ordinal(a.sourceUrl) - ordinal(b.sourceUrl))
  history.sort((a, b) => ordinal(a.url) - ordinal(b.url))
  const audit = { source, opening, closing, observations: all, observationHistory: history, issues: io.issues, rawPages: io.rawPages,
    sourceScopeComplete: false, lifecycleCleanupAllowed: false, authoritativeSourceTotal: null, authoritativeIndiaFacetCount: null,
    qualification: 'Selected advertised published content and literal own fields only; whole employer, recruitment, applications, database persistence and publication unqualified.' }
  await onAudit(structuredClone(audit));signal?.throwIfAborted();if (fatal) throw fatal
  const candidates = all.filter(job => job.jobDescription && job.sourceCurrentNativeRoleQualified && !job.sourceNativeCountryConflict
    && (job.country === 'India' || job.sourceCountryScopeUnresolved))
  const jobs = (Number.isSafeInteger(maxJobs) && maxJobs >= 0 ? candidates.slice(0, maxJobs) : candidates).map(job => ({ ...job, scrapedAt: observedAt }))
  Object.defineProperty(jobs, 'sourceAudit', { value: audit })
  return attachInventoryEvidence(jobs, { status: 'discovery-only', surface: primary, firstParty: io.rawPages.some(page => page.transportQualified),
    pagesFetched: io.rawPages.filter(page => page.usable).length, listingComplete: false, reportedTotal: null, indiaFacetCount: null, verifiedAt: observedAt,
    reason: 'current-own-role-criteria-fields-and-explicit-country-observations-whole-source-and-publication-unqualified' })
} })
