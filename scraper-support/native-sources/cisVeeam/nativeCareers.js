import { readNativeDocument } from '../../utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../utils/inventoryEvidence.js'
import { createPublicIO } from '../publicIO.js'
import { readJobPosting, countryName } from '../jobPostingData.js'
import { text, plain, content, decode, children, hasClass, requirePublished, only, same, absolute,
  canonical, links, dayDate, offsetDate, remixContext } from './publishedData.js'

const CONTRACTS = {
  cyberinfrastructure: { source: 'cyberinfrastructure', company: 'Cyber Infrastructure', employer: 'Cyber Infrastructure (CIS)',
    primary: 'https://career.cisin.com/', host: 'career.cisin.com', platform: 'first-party-native-jobposting' },
  veeamindia: { source: 'veeamindia', company: 'Veeam India', employer: 'Veeam Software',
    primary: 'https://careers.veeam.com/india', host: 'careers.veeam.com', platform: 'talentbrew-declared-greenhouse-role' },
}
const isRole = (contract, value) => {
  try {
    const url = new URL(value)
    return url.origin === 'https://' + contract.host && !url.username && !url.password && !url.search && !url.hash
      && (contract.source === 'cyberinfrastructure' ? /^\/job\/[a-z0-9-]+$/.test(url.pathname)
        : /^\/job\/[a-z0-9-]+\/[a-z0-9-]+\/22681\/\d+$/.test(url.pathname))
  } catch { return false }
}
const nativeRole = value => {
  try { const url = new URL(value);return url.origin === 'https://job-boards.eu.greenhouse.io' && !url.username && !url.password
    && !url.search && /^\/veeamsoftware\/jobs\/\d+$/.test(url.pathname) && ['', '#application-form'].includes(url.hash) } catch { return false }
}
const searchRoute = url => url.origin === 'https://careers.veeam.com' && !url.username && !url.password
  && ['/search-jobs', '/search-jobs/', '/india-careers'].includes(url.pathname) && !url.hash
const allowed = (contract, url) => url.href === contract.primary || isRole(contract, url.href)
  || contract.source === 'veeamindia' && (searchRoute(url) || nativeRole(url.href))

export const officialPrimary = (source, html) => {
  const doc = readNativeDocument(html), titles = doc.nodes(node => node.tag === 'title').map(content)
  return titles.length === 1 && (source === 'cyberinfrastructure'
    ? /Jobs and Current Openings.*Career at CIS/.test(titles[0]) && content(doc.nodes(n => n.tag === 'root')[0]).includes('career@cisin.com')
    : /Veeam/i.test(titles[0]) && /India/i.test(titles[0]))
}
export const roleLinks = (source, html, base = CONTRACTS[source].primary) => {
  const contract = CONTRACTS[source]
  return [...new Map(links(html, base).filter(link => isRole(contract, link.url)).map(link => [link.url, link])).values()]
}
export const searchObservation = html => {
  const doc = readNativeDocument(html), scopes = doc.nodes(node => node.attrs['data-selector-name'] === 'searchresults')
  if (scopes.length !== 1) return { qualified: false, reportedJobs: null, roleURLs: [] }
  const scope = scopes[0], list = children(scope, node => node.attrs.id === 'search-results-list')
  const own = list.length === 1 ? children(list[0], node => node.tag === 'a' && node.attrs['data-job-id']) : []
  const number = name => /^\d+$/.test(scope.attrs[name] || '') ? Number(scope.attrs[name]) : null
  const reportedJobs = number('data-total-job-results'), roleURLs = [...new Set(own.map(node => absolute(node.attrs.href, CONTRACTS.veeamindia.primary)))]
  const ownRoleIdentity = own.length > 0 && own.every(node => {
    const url = absolute(node.attrs.href, CONTRACTS.veeamindia.primary)
    return isRole(CONTRACTS.veeamindia, url) && new URL(url).pathname.split('/').at(-1) === node.attrs['data-job-id']
  })
  // The currently advertised /india-careers redirect omits the optional org
  // filter; its actual cards still publish exact own org22681 role identities.
  const organizationQualified = ['22681', ''].includes(scope.attrs['data-organization-ids'] ?? '') && ownRoleIdentity
  return { qualified: organizationQualified && list.length === 1
      && number('data-total-pages') === 1 && number('data-current-page') === 1 && reportedJobs === roleURLs.length,
    originalAttributes: { ...scope.attrs }, reportedJobs, reportedContent: number('data-total-content-results'),
    reportedResults: number('data-total-results'), roleURLs,
    originalCountryFilters: children(scope, node => node.tag === 'button' && node.attrs['data-facet-type'] === '2').map(node => ({ text: content(node), attrs: { ...node.attrs } })) }
}
const discover = async (contract, io, phase) => {
  const page = await io.follow(contract.primary, { fresh: true })
  const result = { phase, primary: page, qualified: false, links: [], searches: [], currentScopeQualified: false }
  if (!page?.usable || !officialPrimary(contract.source, page.originalText)) {
    io.issue('official-primary-unqualified', { phase });return result
  }
  result.qualified = true
  const found = roleLinks(contract.source, page.originalText)
  if (contract.source === 'veeamindia') {
    const declarations = [...new Set(links(page.originalText, page.url).filter(link => {
      try { return searchRoute(new URL(link.url)) } catch { return false }
    }).map(link => link.url))]
    for (const declaration of declarations) {
      const search = await io.follow(declaration, { fresh: true })
      const observation = search?.usable ? searchObservation(search.originalText) : { qualified: false, roleURLs: [] }
      result.searches.push({ declaration, pageURL: search?.url ?? null, ...observation })
      if (search?.usable) found.push(...roleLinks(contract.source, search.originalText, search.url))
      if (!observation.qualified) io.issue('advertised-search-scope-unqualified', { phase, declaration })
    }
    if (!declarations.length) io.issue('current-advertised-search-missing', { phase })
  }
  result.links = [...new Map(found.map(link => [link.url, link])).values()]
  result.currentScopeQualified = result.links.length > 0 && (contract.source === 'cyberinfrastructure'
    || result.searches.length > 0 && result.searches.every(search => search.qualified))
  return result
}
const ownSchema = (html, url, employer, { rawControls = false } = {}) => {
  const parsed = readJobPosting(html, { rawControls })
  requirePublished(parsed.candidate && !parsed.errors.length, 'Own JobPosting missing, duplicate or unreadable')
  const model = parsed.candidate.model
  requirePublished(model.url === url && model.hiringOrganization?.name === employer, 'Own schema URL/employer conflict')
  requirePublished(canonical(parsed.document, url), 'Canonical disagrees with requested role')
  return { doc: parsed.document, model, syntax: parsed.candidate.syntax, raw: parsed.candidate.raw }
}
const criterionText = value => typeof value === 'string' ? plain(value)
  : Array.isArray(value) ? value.map(criterionText).filter(Boolean).join('; ')
    : value && typeof value === 'object' ? ['credentialCategory', 'name', 'description'].map(key => criterionText(value[key])).filter(Boolean).join('; ') : ''
const cisFields = (html, job, contract) => {
  const { doc, model, syntax, raw } = ownSchema(html, job.sourceUrl, contract.employer)
  const title = only(doc.nodes(node => node.tag === 'h1' && node.attrs.id === 'job-title'), 'CIS own role title')
  requirePublished(same(content(title), model.title) && model.mainEntityOfPage === job.sourceUrl
    && model.hiringOrganization.sameAs === 'https://www.cisin.com/', 'CIS own role identity conflict')
  requirePublished(model.identifier?.name === contract.employer && /^career-job:\d+$/.test(model.identifier?.value || '')
    && model['@id'] === job.sourceUrl + '#job-' + model.identifier.value.split(':')[1], 'CIS source posting ID conflict')
  const hero = only(doc.nodes(node => node.tag === 'section' && hasClass(node, 'hero')), 'CIS own role hero')
  requirePublished(children(hero, node => node === title).length === 1, 'CIS title outside own role hero')
  const facts = {}, factsList = only(children(hero, node => node.tag === 'dl' && hasClass(node, 'facts')), 'CIS own role facts')
  for (const pair of factsList.children.filter(node => typeof node !== 'string' && node.tag === 'div')) {
    const label = content(only(children(pair, node => node.tag === 'dt'), 'CIS fact label'))
    requirePublished(!Object.hasOwn(facts, label), 'Duplicate own CIS fact ' + label)
    facts[label] = content(only(children(pair, node => node.tag === 'dd'), 'CIS fact value'))
  }
  const article = only(doc.nodes(node => node.tag === 'article' && hasClass(node, 'prose') && hasClass(node, 'card')), 'CIS criteria article')
  const sections = article.children.filter(node => typeof node !== 'string' && node.tag === 'section' && !hasClass(node, 'related'))
  requirePublished(sections.length >= 4 && plain(model.description), 'CIS original criteria missing')
  const criteria = Object.fromEntries(['description', 'experienceRequirements', 'responsibilities', 'skills', 'qualifications', 'educationRequirements']
    .filter(key => Object.hasOwn(model, key)).map(key => [key, model[key]]))
  const pieces = [plain(model.description)]
  for (const [key, value] of Object.entries(criteria)) {
    const part = criterionText(value)
    if (part && !pieces.some(piece => piece.includes(part))) pieces.push(key + ': ' + part)
  }
  for (const section of sections) {
    const part = content(section)
    if (part && !pieces.some(piece => piece.includes(part))) pieces.push(part)
  }
  if (facts.Experience && !pieces.some(piece => piece.includes(facts.Experience))) pieces.push('Experience: ' + facts.Experience)
  const places = Array.isArray(model.jobLocation) ? model.jobLocation : model.jobLocation ? [model.jobLocation] : []
  const resolved = places.map(place => ({ original: place, country: countryName(place?.address?.addressCountry) }))
  const countries = [...new Set(resolved.map(place => place.country).filter(Boolean))]
  const india = resolved.filter(place => place.country === 'India')
  const countryConflict = visibleCountryConflict(facts.Location, resolved.map(place => ({
    country: place.country, ...place.original.address })))
  const selected = countryConflict ? [] : india.length ? india : countries.length === 1 && resolved.every(place => place.country) ? resolved : []
  const country = countryConflict ? null : india.length ? 'India' : selected[0]?.country ?? null
  const oneAddress = selected.length === 1 ? selected[0].original.address : null
  const portal = links(html, job.sourceUrl).find(link => link.url === 'https://r.cisin.com/')?.url ?? null
  Object.assign(job, { title: text(model.title), jobId: model.identifier.value, requisitionId: null,
    company: contract.employer, sourceNativeJobPosting: structuredClone(model), sourceNativeCriteria: structuredClone(criteria),
    sourceNativeRoleFacts: facts, sourceNativeExperienceRequirements: structuredClone(model.experienceRequirements ?? null),
    sourceNativeSchemaSyntax: syntax, sourceNativeSchemaOriginal: raw, sourceOwnCriteriaText: sections.map(content).join(' '),
    jobDescription: pieces.join(' '), country, city: oneAddress?.addressLocality ?? null, state: oneAddress?.addressRegion ?? null,
    location: selected.length ? selected.map(place => [place.original.address.addressLocality, place.original.address.addressRegion, place.country].filter(Boolean).join(', ')).join('; ') : null,
    locations: selected.map(place => [place.original.address.addressLocality, place.original.address.addressRegion, place.country].filter(Boolean).join(', ')),
    sourceNativeCountryCodes: countries, sourceNativeCountryConflict: countryConflict,
    sourceCountryScopeUnresolved: countryConflict || !resolved.length || resolved.some(place => !place.country),
    sourceNativeOriginalJobLocations: structuredClone(model.jobLocation ?? null),
    sourcePostingDate: model.datePosted ?? null, sourceClosingDate: model.validThrough ?? null,
    postingDate: dayDate(model.datePosted), closingDate: dayDate(model.validThrough), sourcePostingDatePrecision: 'day', sourceClosingDatePrecision: 'day',
    sourceEmploymentType: typeof model.employmentType === 'string' ? model.employmentType : null,
    employmentType: model.employmentType === 'FULL_TIME' ? 'Full-time' : model.employmentType === 'PART_TIME' ? 'Part-time' : null,
    sourceEmploymentTypeUnresolved: !['FULL_TIME', 'PART_TIME'].includes(model.employmentType),
    experienceRequired: facts.Experience || criterionText(model.experienceRequirements) || null,
    sourceExperienceRequired: facts.Experience || criterionText(model.experienceRequirements) || null,
    experienceRequiredProvenance: 'source', minimumQualification: criterionText(model.educationRequirements) || null,
    requiredSkills: model.skills ? [plain(model.skills)] : [],
    remoteStatus: null, sourceRemoteStatusUnresolved: true,
    applyUrl: portal || job.sourceUrl, link: portal || job.sourceUrl, applicationUrlIsGeneric: true })
}

export const firstPartyVeeam = (html, listing = {}) => {
  const url = listing.sourceUrl || listing.url
  requirePublished(isRole(CONTRACTS.veeamindia, url), 'Veeam requested own role route is missing')
  const { doc, model, syntax, raw } = ownSchema(html, url, 'Veeam Software', { rawControls: true })
  const id = new URL(url).pathname.split('/').at(-1)
  const owned = node => node.attrs['data-selector-name'] === 'jobdetails' && node.attrs['data-org-id'] === '22681' && node.attrs['data-job-id'] === id
  const info = only(doc.nodes(node => owned(node) && hasClass(node, 'job-info')), 'own TalentBrew job-info')
  const title = only(children(info, node => hasClass(node, 'job-info__title')), 'own TalentBrew title')
  const h1 = only(doc.nodes(node => node.tag === 'h1'), 'own h1')
  requirePublished(same(content(title), model.title) && same(content(h1), model.title), 'Firstparty own title conflict')
  const description = only(doc.nodes(node => owned(node) && hasClass(node, 'job-description')), 'own TalentBrew description')
  const criteria = only(children(description, node => hasClass(node, 'ats-description')), 'complete nested ATS criteria')
  const fields = {}
  for (const field of children(info, node => hasClass(node, 'job-info-item'))) {
    const label = only(children(field, node => node.tag === 'b'), 'job field label')
    const name = content(label), value = text(content(field).slice(name.length))
    requirePublished(!Object.hasOwn(fields, name), 'Duplicate firstparty field ' + name)
    fields[name] = value
  }
  const anchors = doc.nodes(node => node.tag === 'a' && node.attrs['data-selector-name'] === 'job-apply-link'
    && node.attrs['data-job-id'] === id && node.attrs['data-job-organization-id'] === '22681')
  const declarations = [...new Set(anchors.map(node => node.attrs.href))]
  const handoff = only(declarations, 'advertised native role target')
  requirePublished(nativeRole(handoff) && anchors.every(node => !node.attrs['data-apply-url'] || node.attrs['data-apply-url'] === handoff), 'Native handoff attributes conflict')
  const nativeId = new URL(handoff).pathname.split('/').at(-1)
  requirePublished(String(model.identifier?.value) === nativeId && model.identifier?.name === 'Job ID', 'Firstparty/native posting ID conflict')
  return { title: text(model.title), sourceUrl: url, jobId: nativeId, sourceFirstPartyJobId: id,
    sourceFirstPartyJobPosting: structuredClone(model), sourceFirstPartySchemaOriginal: raw, sourceFirstPartySchemaSyntax: syntax,
    sourceFirstPartyFields: fields, sourceFirstPartyDescription: content(criteria), sourceFirstPartyLocation: content(only(children(info, node => hasClass(node, 'job-location')), 'own job location')),
    sourceFirstPartyApplyDeclarations: anchors.map(node => ({ ...node.attrs })), sourceFirstPartyPublicationDate: model.datePosted ?? null,
    applyUrl: handoff, link: handoff, nativeRoleURL: handoff.split('#')[0] }
}
const namedLocationCountry = value => {
  const tail = text(value).split(',').at(-1).trim()
  return tail.length > 3 || tail === 'USA' ? countryName(tail) : null
}
const containsLabel = (label, value) => {
  const part = text(value).toLowerCase(), whole = text(label).toLowerCase()
  if (!part) return false
  const at = whole.indexOf(part)
  return at >= 0 && !/[\p{L}\p{N}]/u.test(whole[at - 1] || '') && !/[\p{L}\p{N}]/u.test(whole[at + part.length] || '')
}
// Match the visible place to its own typed addresses, rather than comparing
// every country globally. A separate foreign worksite does not contradict an
// independently published India worksite. Same-place contradictions do.
const visibleCountryConflict = (label, places) => {
  const country = namedLocationCountry(label), known = places.filter(place => place.country)
  if (!country || !known.length) return false
  const scored = known.map(place => ({ place, score: (containsLabel(label, place.addressLocality) ? 2 : 0)
    + (containsLabel(label, place.streetAddress) ? 4 : 0) + (containsLabel(label, place.postalCode) ? 4 : 0)
    + (containsLabel(label, place.addressRegion) ? 1 : 0) }))
  const best = Math.max(...scored.map(value => value.score))
  const matched = best > 0 ? scored.filter(value => value.score === best).map(value => value.place) : known
  return !matched.some(place => place.country === country)
}
const nativeVeeam = (html, job) => {
  const doc = readNativeDocument(html), model = remixContext(doc), data = model?.state?.loaderData
  const root = data?.root, route = data?.['routes/$url_token_.jobs_.$job_post_id'], post = route?.jobPost
  requirePublished(root?.internal === false && root.preview === false && root.urlToken === 'veeamsoftware' && root.isJobPost === true
    && root.boardConfiguration?.job_board_id === 4001870101
    && root.boardConfiguration?.job_board_public_url === 'https://job-boards.eu.greenhouse.io/veeamsoftware', 'Native own board identity conflict')
  requirePublished(route?.urlToken === 'veeamsoftware' && String(route.jobPostId) === job.jobId
    && post?.post_type === 'job_post' && post.public_url === job.nativeRoleURL && post.company_name === 'Veeam Software'
    && same(post.title, job.title), 'Native own role identity conflict')
  const header = only(doc.nodes(node => hasClass(node, 'job__header')), 'native own role header')
  const title = only(children(header, node => node.tag === 'h1'), 'native own title')
  const location = only(children(header, node => hasClass(node, 'job__location')), 'native own location')
  requirePublished(same(content(title), post.title) && same(content(location), post.job_post_location), 'Native visible role identity/location conflict')
  const schemaPlaces = Array.isArray(job.sourceFirstPartyJobPosting.jobLocation) ? job.sourceFirstPartyJobPosting.jobLocation
    : job.sourceFirstPartyJobPosting.jobLocation ? [job.sourceFirstPartyJobPosting.jobLocation] : []
  const nativeCountry = namedLocationCountry(post.job_post_location)
  const nativeCity = text(post.job_post_location).includes(',') ? text(post.job_post_location).split(',')[0] : null
  const typedPlaces = schemaPlaces.map(place => ({ ...place?.address, country: countryName(place?.address?.addressCountry) })).filter(place => place.country)
  const corresponding = typedPlaces.filter(place => nativeCity && same(text(place.addressLocality).toLowerCase(), nativeCity.toLowerCase())
    || typedPlaces.length === 1 && !text(place.addressLocality))
  const typedConflict = Boolean(nativeCountry && corresponding.length && !corresponding.some(place => place.country === nativeCountry))
  const visibleConflict = visibleCountryConflict(job.sourceFirstPartyLocation,
    [...typedPlaces, { country: nativeCountry, addressLocality: nativeCity }])
  const countryConflict = typedConflict || visibleConflict
  const country = countryConflict ? null : nativeCountry
  const pieces = ['introduction', 'content', 'conclusion'].map(key => plain(post[key])).filter(Boolean)
  requirePublished(pieces.length && plain(post.content), 'Native full criteria missing')
  const nativeCriteria = pieces.join(' '), firstPartyCriteria = job.sourceFirstPartyDescription
  const fullCriteria = firstPartyCriteria && !nativeCriteria.includes(firstPartyCriteria)
    ? nativeCriteria + ' Also published on Veeam careers: ' + firstPartyCriteria : nativeCriteria
  const workLocation = job.sourceFirstPartyFields['Work Location'] || null
  const remoteStatus = workLocation === 'Hybrid' ? 'Hybrid' : workLocation === 'Office Based' ? 'On-site'
    : workLocation === 'Remote' ? 'Remote' : null
  Object.assign(job, { company: 'Veeam Software', sourceNativeJobPost: structuredClone(post), sourceNativeRootIdentity: {
    internal: root.internal, preview: root.preview, urlToken: root.urlToken, isJobPost: root.isJobPost,
    jobBoardId: root.boardConfiguration.job_board_id, jobBoardPublicURL: root.boardConfiguration.job_board_public_url },
    sourceNativeRouteIdentity: { jobPostId: route.jobPostId, urlToken: route.urlToken },
    jobDescription: fullCriteria, sourceNativeCriteriaText: nativeCriteria,
    sourceNativeOriginalLocation: post.job_post_location ?? null,
    sourceNativeCountryEvidence: { typedConflict, visibleConflict, originalFirstPartyLocation: job.sourceFirstPartyLocation },
    country, city: country ? nativeCity : null, state: null,
    location: country ? text(post.job_post_location) || null : null, locations: country && post.job_post_location ? [text(post.job_post_location)] : [],
    sourceNativeCountryCodes: nativeCountry ? [nativeCountry] : [], sourceNativeCountryConflict: countryConflict,
    sourceCountryScopeUnresolved: !country, sourceEmploymentType: typeof post.employment === 'string' ? post.employment : null,
    employmentType: null, sourceEmploymentTypeUnresolved: true, sourceNativeEmploymentDuration: job.sourceFirstPartyFields['Role Type'] ?? null,
    remoteStatus, sourceRemoteStatusUnresolved: true, sourceNativeWorkLocation: workLocation,
    department: job.sourceFirstPartyFields.Function ?? null, team: job.sourceFirstPartyFields.Team ?? null,
    postingDate: offsetDate(post.published_at), sourcePostingDate: post.published_at ?? null, sourcePostingDatePrecision: 'offset-timestamp',
    closingDate: offsetDate(post.application_deadline) || dayDate(post.application_deadline), sourceClosingDate: post.application_deadline ?? null,
    requisitionId: null, requiredSkills: [] })
}

export const createPublishedCareersScraper = source => {
  const contract = CONTRACTS[source]
  requirePublished(contract, 'Unknown source')
  return { async run(options = {}) {
    const { signal, onAudit = () => {}, now = () => new Date().toISOString(), maxJobs = null } = options
    const observedAt = now(), io = createPublicIO({ ...options, allowed: url => allowed(contract, url) })
    const observations = new Map(), history = [], phaseContexts = new Map()
    const observe = async (link, phase, fresh) => {
      signal?.throwIfAborted()
      const job = { source, company: contract.company, sourceUrl: link.url, detailUrl: link.url,
        title: link.title || null, jobId: null, requisitionId: null, country: null, city: null, state: null, location: null,
        jobDescription: null, sourceCompanyScopeUnresolved: false, sourceCountryScopeUnresolved: true,
        sourceCurrentNativeRoleQualified: false, sourceNativePhase: phase, sourceNativeIssues: [],
        sourceNativeListingDeclaration: structuredClone(link), companyCareerPage: contract.primary,
        companyDomain: contract.host, atsPlatform: contract.platform, sourceScopeComplete: false, lifecycleCleanupAllowed: false }
      try {
        const own = await io.follow(link.url, { fresh })
        requirePublished(own?.usable && typeof own.originalText === 'string', 'Own role unavailable')
        job.sourceNativeOwnBodySHA256 = own.bodySHA256
        if (source === 'cyberinfrastructure') cisFields(own.originalText, job, contract)
        else {
          Object.assign(job, firstPartyVeeam(own.originalText, { sourceUrl: link.url }))
          const native = await io.follow(job.nativeRoleURL, { fresh })
          requirePublished(native?.usable && typeof native.originalText === 'string', 'Advertised native role unavailable')
          job.sourceNativeDelegatedBodySHA256 = native.bodySHA256
          nativeVeeam(native.originalText, job)
        }
        job.sourceCurrentNativeRoleQualified = !job.sourceNativeCountryConflict
      } catch (error) { signal?.throwIfAborted();job.sourceNativeIssues.push(error.message);io.issue('role-held', { url: link.url, phase, message: error.message }) }
      const earlier = observations.get(link.url)
      if (earlier) {
        history.push({ url: link.url, earlier: structuredClone(earlier), current: structuredClone(job) })
        if (earlier.jobDescription && !job.jobDescription) Object.assign(earlier, { sourceCurrentNativeRoleQualified: false,
          sourceNativeTemporalQualification: 'earlier-positive-retained-current-role-held', sourceNativeClosingObservation: job })
        else observations.set(link.url, job)
      } else observations.set(link.url, job)
    }
    let opening, closing
    for (const phase of ['opening', 'closing']) {
      signal?.throwIfAborted()
      const discovery = await discover(contract, io, phase)
      if (phase === 'opening') opening = discovery;else closing = discovery
      const pending = discovery.links.filter(link => phase === 'closing' || !phaseContexts.has(link.url) || JSON.stringify(phaseContexts.get(link.url)) !== JSON.stringify(link))
      let next = 0
      await Promise.all(Array.from({ length: 4 }, async () => {
        while (next < pending.length) { const link = pending[next++];await observe(link, phase, phase === 'closing');phaseContexts.set(link.url, link) }
      }))
    }
    const closingURLs = new Set(closing.links.map(link => link.url))
    for (const [url, job] of observations) if (!closing.currentScopeQualified || !closingURLs.has(url)) {
      job.sourceCurrentNativeRoleQualified = false
      job.sourceNativeTemporalQualification = 'earlier-positive-retained-closing-discovery-unqualified-or-missing'
    }
    const all = [...observations.values()]
    const audit = { source, observations: all, opening, closing, observationHistory: history,
      rawPages: io.rawPages, issues: io.issues, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
      authoritativeSourceTotal: null, authoritativeIndiaFacetCount: null,
      qualification: 'Original advertised public content and own criteria only. Whole source, active recruitment, application activation and database/publication unqualified.' }
    await onAudit(structuredClone(audit));signal?.throwIfAborted()
    const eligible = all.filter(job => job.jobDescription && job.sourceCurrentNativeRoleQualified && !job.sourceCompanyScopeUnresolved && !job.sourceNativeCountryConflict
      && (job.country === 'India' || job.sourceCountryScopeUnresolved))
    const jobs = (Number.isSafeInteger(maxJobs) && maxJobs >= 0 ? eligible.slice(0, maxJobs) : eligible).map(job => ({ ...job, scrapedAt: observedAt }))
    Object.defineProperty(jobs, 'sourceAudit', { value: audit })
    return attachInventoryEvidence(jobs, { status: 'discovery-only', surface: contract.primary,
      firstParty: io.rawPages.some(page => page.transportQualified), pagesFetched: io.rawPages.filter(page => page.usable).length,
      listingComplete: false, reportedTotal: null, indiaFacetCount: null, verifiedAt: observedAt,
      reason: 'published-own-role-criteria-observations-whole-source-activation-and-publication-unqualified' })
  } }
}
