import { parse } from 'acorn'
import { createHash } from 'node:crypto'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { nativeCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { classifyOracleCountry } from '../arcelormittal/oracleNative.js'
import { projectNativeCriteria } from './nativeCriteriaHtml.js'
import { withCallerSignal } from './callerSignal.js'

const PORTAL = 'https://careers.adani.com/'
const BRIDGE = 'https://www.adani.com/opportunity/'
const norm = value => value == null ? null : String(value).replace(/\s+/g, ' ').trim() || null
const proof = (value, message) => { if (!value) throw new Error('Adani native: ' + message) }
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const count = value => Number.isSafeInteger(value) && value >= 0 && value <= 100000
const fieldNames = ['ExternalDescriptionStr', 'ExternalResponsibilitiesStr', 'ExternalQualificationsStr', 'OrganizationDescriptionStr', 'CorporateDescriptionStr']
const criteriaNames = ['StudyLevel', 'JobGrade', 'JobLevel', 'JobShift', 'DomesticTravelRequired', 'InternationalTravelRequired', 'ContractType', 'WorkerType', 'JobType', 'WorkMonths', 'WorkYears', 'WorkHours', 'WorkDays']
const stable = row => digest([row.Id, row.Title, row.PrimaryLocationCountry, row.PrimaryLocation,
  row.secondaryLocations, row.PostedDate, row.PostingEndDate, row.LegalEmployerId, row.BusinessUnitId, row.OrganizationId])
const detailSignature = row => digest([row.Id, row.Title, row.PrimaryLocationCountry, row.PrimaryLocation,
  row.secondaryLocations, row.ExternalPostedStartDate, row.ExternalPostedEndDate, row.RequisitionId,
  ...fieldNames.map(field => row[field]), ...criteriaNames.map(field => row[field]), row.skills,
  row.JobSchedule, row.WorkplaceType, row.LegalEmployer, row.BusinessUnit, row.Organization, row.requisitionFlexFields,
  row.Department, row.JobFunction, row.Category, row.LegalEmployerId, row.BusinessUnitId, row.OrganizationId])

const siteLinks = html => {
  const doc = document(html), links = []
  for (const node of doc.nodes(node => node.tag === 'a' && node.attrs.href && doc.text(node))) {
    let url
    try { url = new URL(node.attrs.href.trim(), PORTAL) } catch { continue }
    if (url.origin === 'https://www.adani.com' && url.pathname.toLowerCase() === '/opportunity/'
      && /^#en\/sites\/CX_\d+\/requisitions$/.test(url.hash)) links.push({ site: url.hash.split('/')[2], text: doc.text(node) })
  }
  return links
}

// Validate the actual, active vanity bridge function as syntax. A comment or a
// quoted example cannot delegate this employer to an unrelated Oracle tenant.
function oracleOrigin(html) {
  const doc = document(html), origins = new Set()
  for (const node of doc.nodes(node => node.tag === 'script' && !node.attrs.src)) {
    let program
    try { program = parse(node.raw || '', { ecmaVersion: 'latest' }) } catch { continue }
    for (const fn of program.body.filter(node => node.type === 'FunctionDeclaration' && node.id?.name === 'replacecontent')) {
      const declarations = fn.body.body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations)
      const host = declarations.find(node => node.id.name === 'host')?.init
      const base = declarations.find(node => node.id.name === 'ceBaseURL')?.init
      if (host?.type !== 'Literal' || typeof host.value !== 'string' || base?.type !== 'BinaryExpression'
        || base.operator !== '+' || base.left.name !== 'host' || base.right.value !== '/hcmUI/CandidateExperience/') continue
      const visit = node => {
        if (!node || typeof node !== 'object') return
        if (node.type === 'CallExpression' && node.callee?.object?.name === 'xhr' && node.callee.property?.name === 'open'
          && node.arguments[0]?.value === 'GET' && node.arguments[1]?.type === 'BinaryExpression'
          && node.arguments[1].left?.name === 'ceBaseURL' && node.arguments[1].right?.name === 'anchortext') origins.add(host.value)
        for (const child of Object.values(node)) if (Array.isArray(child)) child.forEach(visit); else if (child && typeof child === 'object') visit(child)
      }
      visit(fn.body)
    }
  }
  proof(origins.size === 1, 'current native Oracle vanity delegation unavailable or ambiguous')
  const url = new URL([...origins][0])
  proof(url.protocol === 'https:' && /^[a-z\d-]+\.fa\.em\d+\.oraclecloud\.com$/.test(url.hostname)
    && url.pathname === '/' && !url.username && !url.password && !url.search && !url.hash && !url.port, 'unreviewed native Oracle origin')
  return url.origin
}

export async function readAdaniNativeJobs({ read, careersHtml, signal, maxPages = Infinity, maxJobs = Infinity, now = () => new Date().toISOString(), onAudit }) {
  const corporate = document(careersHtml)
  proof(corporate.nodes(node => node.tag === 'a' && /^https:\/\/careers\.adani\.com\//.test(node.attrs.href || '')).length, 'current corporate careers subdomain handoff missing')
  const portalHtml = await read(PORTAL), portal = document(portalHtml)
  proof(/Adani Group/.test(portal.text(portal.root)), 'current group careers identity missing')
  const links = siteLinks(portalHtml), groupLinks = links.filter(link => /^Explore now$/i.test(link.text))
  proof(groupLinks.length === 1, 'generic group recruiting handoff unavailable or ambiguous')
  const site = groupLinks[0].site, sites = [...new Set([...siteLinks(careersHtml), ...links].map(link => link.site))]
  const origin = oracleOrigin(await read(BRIDGE)), shellUrl = origin + '/hcmUI/CandidateExperience/en/sites/' + site
  const shellHtml = await read(shellUrl), shell = document(shellHtml), base = shell.nodes(node => node.tag === 'base')[0]
  proof(base?.attrs['data-sitenumber'] === site && new URL(base.attrs['data-apibaseurl']).origin === origin
    && /Adani Career Site/i.test(shellHtml.match(/<title[^>]*>([^<]*)/i)?.[1] || ''), 'generic group native site identity mismatch')
  const clients = shell.nodes(node => node.tag === 'script' && /^https:\/\/static\.oracle\.com\/cdn\/fa\/oj-hcm-ce\/[^/]+\/js\/main-minimal\.js$/.test(node.attrs.src || ''))
  proof(clients.length === 1, 'current public Oracle client unavailable')
  const client = await read(clients[0].attrs.src)
  proof(['/recruitingCEJobRequisitions?onlyData=true', 'requisitionList.secondaryLocations', 'finder=findReqs',
    '/recruitingCEJobRequisitionDetails', 'finder=ById', 'siteSettings/', '/hcmRestApi/resources/latest'].every(value => client.includes(value)), 'current native recruiting protocol changed')
  const json = async url => JSON.parse(await read(url))
  const parallel = async (items, handler) => {
    let cursor = 0
    await Promise.all(Array.from({ length: Math.min(6, items.length) }, async () => {
      while (cursor < items.length) { signal?.throwIfAborted(); const index = cursor++; await handler(items[index], index) }
    }))
  }
  await parallel(sites, async current => {
    const app = (await json(origin + '/hcmRestApi/CandidateExperience/en/siteSettings/' + current)).app
    proof(app?.siteNumber === current && norm(app.siteName) && new URL(app.apiBaseUrl).origin === origin, 'published native site settings identity mismatch')
    proof(!(app.settings || []).some(value => /ORA_IRC_CE_USE_JERSEY_ENDPOINT_FOR_REQ_SEARCH|IRC_ELASTIC_SEARCH_ENABLED/.test(value.settingKey) && value.settingValue === 'true'), 'unreviewed active native search variant')
    if (current === site) proof(/^Adani Career Site$/i.test(app.siteName)
      && /^https:\/\/(?:www\.)?adani\.com\/opportunity\/#$/i.test(app.seoConfiguration?.sameAs || '')
      && /Adani Group/.test(app.talentCommunitySignUp?.buttonLabel || ''), 'generic group native employer binding missing')
  })
  const pageUrl = (current, offset) => origin + '/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=' + current + ',facetsList=NONE,limit=24,offset=' + offset
  const detailUrl = id => origin + '/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id=' + encodeURIComponent('"' + id + '"') + ',siteNumber=' + site
  let pagesFetched = 0
  const traverse = async current => {
    const first = await json(pageUrl(current, 0)), envelope = first?.items?.[0]
    proof(count(envelope?.TotalJobsCount), 'native inventory total absent')
    const total = envelope.TotalJobsCount, terminal = Math.ceil(total / 24), requested = Math.min(terminal + 1, maxPages), pages = new Map([[0, first]])
    await parallel(Array.from({ length: Math.max(0, requested - 1) }, (_, index) => index + 1), async page => { pages.set(page, await json(pageUrl(current, page * 24))) })
    const records = [], identities = new Map()
    for (let page = 0; page < requested; page++) {
      const response = pages.get(page), body = response?.items?.[0], expected = Math.max(0, Math.min(24, total - page * 24))
      proof(Array.isArray(response?.items) && response.items.length === 1 && body.SiteNumber === current
        && body.TotalJobsCount === total && body.Offset === page * 24 && body.Limit === 24
        && Array.isArray(body.requisitionList) && body.requisitionList.length === expected, 'native page count, offset or site identity changed')
      for (const row of body.requisitionList) {
        proof(/^\d+$/.test(String(row.Id)) && norm(row.Title) && !identities.has(String(row.Id)), 'native role identity absent or repeated')
        proof(Array.isArray(row.secondaryLocations), 'native secondary location envelope changed')
        identities.set(String(row.Id), stable(row)); records.push(row)
      }
    }
    pagesFetched += requested
    return { records, identities, total, complete: requested === terminal + 1 && records.length === total }
  }
  const initial = await traverse(site), subordinate = new Map()
  // Site enumeration stays sequential; each inventory has a bounded six-request
  // pool so adding another corporate card cannot multiply network concurrency.
  for (const current of sites.filter(value => value !== site)) subordinate.set(current, await traverse(current))
  const reasons = []
  if (!initial.complete || [...subordinate.values()].some(value => !value.complete)) reasons.push('caller-page-cap')
  const groupIds = new Set(initial.identities.keys())
  if (initial.complete && [...subordinate.values()].some(value => value.records.some(row => !groupIds.has(String(row.Id))))) reasons.push('published-business-scope-not-covered-by-group-native-inventory')
  const businessListingModelMismatches = []
  for (const [current, inventory] of subordinate) for (const row of inventory.records) {
    const id = String(row.Id), groupIdentity = initial.identities.get(id), businessIdentity = inventory.identities.get(id)
    if (groupIdentity && groupIdentity !== businessIdentity) businessListingModelMismatches.push({ siteNumber: current, jobId: id, groupModelSha256: groupIdentity, businessModelSha256: businessIdentity })
  }
  if (businessListingModelMismatches.length) reasons.push('published-business-listing-model-differs-from-group-native-model')
  const details = new Map(), jobs = [], partial = [], unresolved = []
  const readDetail = async row => {
    const response = await json(detailUrl(row.Id)), detail = response?.items?.[0]
    proof(Array.isArray(response?.items) && response.items.length === 1 && String(detail.Id) === String(row.Id)
      && norm(detail.Title) === norm(row.Title), 'native detail role identity changed')
    proof(detail.PrimaryLocationCountry === row.PrimaryLocationCountry && norm(detail.PrimaryLocation) === norm(row.PrimaryLocation)
      && digest(detail.secondaryLocations) === digest(row.secondaryLocations), 'native detail country or location differs from listing')
    return detail
  }
  await parallel(initial.records, async row => { details.set(String(row.Id), await readDetail(row)) })
  for (const row of initial.records) {
    const detail = details.get(String(row.Id)), countryClass = classifyOracleCountry(detail)
    const projected = Object.fromEntries(fieldNames.map(field => [field, projectNativeCriteria(detail[field])]))
    const core = fieldNames.slice(0, 3).map(field => projected[field].text).filter(Boolean).join('\n\n')
    const contentComplete = fieldNames.every(field => projected[field].complete) && hasSourceDescription({ jobDescription: core })
    const locations = [
      ...(nativeCountryName(detail.PrimaryLocationCountry) === 'India' ? [{ location: norm(detail.PrimaryLocation), country: 'India', field: 'PrimaryLocationCountry', code: detail.PrimaryLocationCountry }] : []),
      ...(detail.secondaryLocations || []).filter(value => nativeCountryName(value.CountryCode) === 'India').map(value => ({ location: norm(value.Name), country: 'India', field: 'secondaryLocations.CountryCode', code: value.CountryCode })),
    ]
    if (countryClass === 'unknown') unresolved.push(String(detail.Id))
    if (!contentComplete) partial.push(String(detail.Id))
    if (countryClass !== 'india' || !contentComplete) continue
    proof(!detail.ExternalPostedStartDate || Number.isFinite(Date.parse(detail.ExternalPostedStartDate)), 'invalid native publication date')
    proof(!detail.ExternalPostedEndDate || Number.isFinite(Date.parse(detail.ExternalPostedEndDate)), 'invalid native closing date')
    const id = String(detail.Id), url = shellUrl + '/job/' + id
    const description = fieldNames.map(field => projected[field].text).filter(Boolean).join('\n\n')
    jobs.push({ source: 'adani', company: 'Adani Group', companyDomain: 'adani.com', companyCareerPage: 'https://www.adani.com/careers',
      atsPlatform: 'oracle-hcm', title: norm(detail.Title), jobId: id, postingId: id, requisitionId: norm(detail.RequisitionId),
      sourceUrl: url, applyUrl: url, link: url, applicationIdentity: { siteNumber: site, publicJobId: id, requisitionId: norm(detail.RequisitionId) },
      legalEmployer: norm(detail.LegalEmployer), nativeLegalEmployerId: detail.LegalEmployerId, nativeBusinessUnitId: detail.BusinessUnitId,
      nativeOrganizationId: detail.OrganizationId, brand: norm(detail.BusinessUnit) || norm(detail.Organization),
      nativePublishedSiteMembership: [site, ...[...subordinate].filter(([, value]) => value.identities.has(id)).map(([key]) => key)],
      department: norm(detail.Department) || norm(detail.JobFunction) || norm(detail.Category),
      location: locations[0]?.location || null, locations: locations.map(value => value.location).filter(Boolean), city: null, country: 'India',
      sourceCountryEvidence: locations, employmentType: norm(detail.JobSchedule), workplaceType: norm(detail.WorkplaceType),
      postingDate: norm(detail.ExternalPostedStartDate), postedAt: norm(detail.ExternalPostedStartDate), closingDate: norm(detail.ExternalPostedEndDate),
      sourceClosingDateIsExact: /T\d{2}:\d{2}/.test(detail.ExternalPostedEndDate || ''),
      responsibilities: projected.ExternalResponsibilitiesStr.text || null, qualifications: projected.ExternalQualificationsStr.text || null,
      minimumQualification: projected.ExternalQualificationsStr.text || norm(detail.StudyLevel), preferredQualification: null,
      requiredSkills: (detail.skills || []).map(value => norm(value.Name || value.Skill || value.name)).filter(Boolean),
      jobDescription: description, sourceDescription: description, nativePublicCriteriaHtml: Object.fromEntries(fieldNames.map(field => [field, detail[field]])),
      sourceAdditionalCriteria: Object.fromEntries(criteriaNames.map(field => [field, detail[field]])), nativeRequisitionFlexFields: detail.requisitionFlexFields || [],
      sourceDetailComplete: true, sourceLocationCorroborationComplete: true, sourceScopeComplete: false, sourceListingComplete: false,
      lifecycleCleanupAllowed: false })
  }
  if (partial.length) reasons.push('native-empty-or-rendering-incomplete-public-criteria')
  if (unresolved.length) reasons.push('native-country-unresolved')
  let closingMatches = false
  if (initial.complete && [...subordinate.values()].every(value => value.complete)) {
    let criteriaMatches = true
    await parallel(initial.records, async row => {
      const after = await readDetail(row)
      if (detailSignature(after) !== detailSignature(details.get(String(row.Id)))) criteriaMatches = false
    })
    // Close every published inventory after the final detail read. A newly
    // published or withdrawn role during hydration must enter this comparison.
    const closing = await traverse(site)
    closingMatches = closing.total === initial.total && closing.identities.size === initial.identities.size
      && [...initial.identities].every(([id, value]) => closing.identities.get(id) === value)
    for (const [current, before] of subordinate) {
      const after = await traverse(current)
      closingMatches &&= after.total === before.total && after.identities.size === before.identities.size
        && [...before.identities].every(([id, value]) => after.identities.get(id) === value)
    }
    if (!closingMatches || !criteriaMatches) reasons.push('closing-native-inventory-or-full-criteria-changed')
    closingMatches &&= criteriaMatches
  }
  const result = jobs.slice(0, maxJobs)
  if (result.length !== jobs.length) reasons.push('caller-job-cap')
  const complete = reasons.length === 0, stamp = typeof now === 'function' ? now() : now
  for (const job of result) { job.sourceScopeComplete = complete; job.sourceListingComplete = complete; job.scrapedAt = new Date(stamp).toISOString() }
  const evidence = { status: complete ? initial.total ? 'complete-inventory' : 'verified-empty' : 'coverage-gap', surface: PORTAL,
    firstParty: true, listingComplete: complete, reportedTotal: initial.total, indiaFacetCount: initial.complete ? initial.records.filter(row => classifyOracleCountry(row) === 'india').length : null,
    pagesFetched, verifiedAt: new Date(stamp).toISOString(), reason: complete ? 'all-published-business-sites-group-inventory-full-public-criteria-and-closing-comparison' : reasons.join(';') }
  attachInventoryEvidence(result, evidence)
  attachSourceObservationEvidence(result, { source: 'adani', recordKind: 'vacancy-rows', observedRecordCount: initial.records.length,
    observedVacancyCount: initial.records.length, sourceScopeComplete: complete })
  await withCallerSignal(() => onAudit?.({ source: 'adani', nativeRecords: initial.records.map(row => ({ listing: row, detail: details.get(String(row.Id)) })),
    publishedSiteCounts: Object.fromEntries([[site, initial.total], ...[...subordinate].map(([key, value]) => [key, value.total])]),
    publishedBusinessRecords: Object.fromEntries([...subordinate].map(([key, value]) => [key, value.records])), businessListingModelMismatches,
    qualifiedCount: jobs.length, partialCriteriaIds: partial, unknownCountryIds: unresolved, closingMatches, inventoryEvidence: evidence, productionWrites: false }), signal)
  signal?.throwIfAborted()
  return result
}
