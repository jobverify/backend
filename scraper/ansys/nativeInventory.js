import { document, decode } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { sourceDescriptionFromPosting } from '../../scraper-support/utils/sourceDescriptionHydration.js'

const check = (condition, reason) => { if (!condition) throw new Error('Ansys native inventory: ' + reason) }
const text = value => typeof value === 'string' ? decode(value).replace(/\s+/g, ' ').trim() : ''
const names = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })
const countryKnown = value => typeof value === 'string' && /^[A-Z]{2}$/.test(value)
  && !['ZZ', 'XA', 'XB', 'UN', 'EU', 'EZ', 'QO'].includes(value) && Boolean(names.of(value))

export function readNativeSearchFrame(html, page) {
  check(typeof html === 'string' && html.length <= 8_000_000, 'missing or oversized search body')
  const doc = document(html)
  const models = doc.nodes(node => node.tag === 'script' && !node.attrs.src)
    .map(node => node.raw?.trim().match(/^console\.log\((\{[\s\S]*\}),\s*['"]site['"]\);?$/)?.[1]).filter(Boolean)
  if (!models.length) return null
  check(models.length === 1, 'ambiguous native search models')
  // The first-party page publishes this renderer model as JSON. No downloaded
  // JavaScript is evaluated, including the surrounding console.log call.
  const model = JSON.parse(models[0])
  check(String(model.OrganizationIds) === '44408' && text(model.Keywords).toLowerCase() === 'ansys', 'employer or published keyword scope changed')
  check(model.CurrentPage === page && Number.isSafeInteger(model.TotalJobResults) && model.TotalJobResults >= 0 && model.TotalJobResults <= 10000
    && model.TotalResults === model.TotalJobResults && Number.isSafeInteger(model.RecordsPerPage) && model.RecordsPerPage > 0
    && model.TotalPages === Math.max(1, Math.ceil(model.TotalJobResults / model.RecordsPerPage)), 'native pagination changed')
  check(Array.isArray(model.Jobs) && Array.isArray(model.JobModels)
    && model.Jobs.length === Math.min(model.RecordsPerPage, model.TotalJobResults - (page - 1) * model.RecordsPerPage)
    && model.JobModels.length === model.Jobs.length, 'incomplete native page')
  const ids = new Set(), identities = new Map(), indiaIds = new Set()
  let geographyComplete = true
  for (const job of model.Jobs) {
    const id = String(job.ID)
    check(/^\d+$/.test(id) && !ids.has(id) && String(job.OrganizationID) === '44408' && text(job.Title), 'duplicate or invalid native role identity')
    ids.add(id)
    const locations = Array.isArray(job.Locations) ? job.Locations : []
    if (!locations.length || locations.some(location => !countryKnown(location.CountryCode)
      || (/^india$/i.test(text(location.Country))) !== (location.CountryCode === 'IN'))) geographyComplete = false
    if (locations.some(location => location.CountryCode === 'IN')) indiaIds.add(id)
    identities.set(id, JSON.stringify([job.Title, job.Locations, job.PostedDate, job.UpdatedDate, job.ImportID]))
  }
  check(new Set(model.JobModels.map(job => String(job.Id))).size === ids.size
    && model.JobModels.every(job => ids.has(String(job.Id))), 'native renderer identities disagree')
  const facets = Array.isArray(model.CountryFacetFilters) ? model.CountryFacetFilters.filter(facet => facet.Country === 'India' && String(facet.ID) === '1269750') : []
  const indiaCount = facets.length === 1 && Number.isSafeInteger(facets[0].Count) && facets[0].Count >= 0 ? facets[0].Count : null
  return { total: model.TotalJobResults, pages: model.TotalPages, identities, indiaIds, indiaCount, geographyComplete }
}

export function nativeRoleId(url) {
  const parsed = new URL(url)
  check(parsed.origin === 'https://careers.synopsys.com' && !parsed.username && !parsed.password, 'role left the native employer')
  const id = parsed.pathname.match(/^\/job\/[^/]+\/[^/]+\/44408\/(\d+)\/?$/)?.[1]
  check(id, 'invalid native role route')
  return id
}

export function readNativeRoleDetail(job, response) {
  nativeRoleId(job.sourceUrl)
  const html = typeof response === 'string' ? response : response?.html
  const doc = document(html)
  const postings = []
  for (const node of doc.nodes(node => node.tag === 'script' && node.attrs.type === 'application/ld+json')) {
    const parsed = JSON.parse(node.raw)
    for (const value of Array.isArray(parsed) ? parsed : parsed['@graph'] || [parsed]) if (value['@type'] === 'JobPosting') postings.push(value)
  }
  const matches = postings.filter(posting => String(posting.identifier?.value) === job.jobId
    && posting.url === job.sourceUrl && text(posting.title) === job.title)
  check(matches.length === 1, 'detail role identity changed')
  const posting = matches[0], employer = text(posting.hiringOrganization?.name)
  check(/^(?:Synopsys|Ansys)(?: Inc\.?)?$/i.test(employer), 'detail employer changed')
  const places = Array.isArray(posting.jobLocation) ? posting.jobLocation : [posting.jobLocation]
  check(places.some(place => {
    const country = place?.address?.addressCountry
    return /^(?:IN|India)$/i.test(typeof country === 'string' ? country : country?.name || '')
  }), 'detail India scope changed')
  const description = sourceDescriptionFromPosting({ ...job, company: employer }, response)
  check(description, 'complete native JobPosting content unavailable')
  return { ...description, nativeEmployer: employer, country: 'India', postingDate: posting.datePosted || job.postingDate,
    closingDate: posting.validThrough || null, nativeJobLocations: posting.jobLocation }
}
