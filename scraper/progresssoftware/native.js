import { document, norm } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { nativeCountryName, nativeLocationCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import { isIndiaJob } from '../../scraper-support/utils/indiaLocationFilter.js'
import { extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'

const PREFIX = 'https://www.progress.com/company/careers/open-positions/'
const fail = message => { throw new Error('Progress Software native inventory: ' + message) }
const requireOne = (nodes, label) => { if (nodes.length !== 1) fail('missing or ambiguous ' + label); return nodes[0] }
const readable = value => value?.replace(/&(rsquo|lsquo|rdquo|ldquo);/gi, (_, entity) => ({ rsquo: '\u2019', lsquo: '\u2018', rdquo: '\u201d', ldquo: '\u201c' })[entity.toLowerCase()]) || null
const proseText = node => !node || node.inactive || /^(?:h[1-6]|script|style)$/.test(node.tag) ? ''
  : node.children.map(child => typeof child === 'string' ? child : proseText(child)).join(' ')
export const urlKey = value => {
  let url; try { url = new URL(value) } catch { fail('invalid URL') }
  if (url.origin !== 'https://www.progress.com' || url.username || url.password || url.search || url.hash) fail('foreign URL identity')
  return url.origin + decodeURIComponent(url.pathname).toLowerCase()
}
const jobIdentity = value => {
  urlKey(value)
  if (!value.startsWith(PREFIX)) fail('foreign detail URL')
  const path = decodeURIComponent(new URL(value).pathname), prefixPath = new URL(PREFIX).pathname
  if (!path.startsWith(prefixPath) || path.slice(prefixPath.length).includes('/')) fail('detail URL outside verified flat role route')
  const id = /-([a-zA-Z0-9]{8})$/.exec(value)?.[1]
  if (!id) fail('missing native Jobvite ID')
  return id
}
export const readPage = html => {
  if (typeof html !== 'string' || html.length > 4 * 1024 * 1024) fail('missing or oversized HTML')
  const doc = document(html)
  for (const tag of ['html', 'body']) doc.outer(requireOne(doc.nodes(node => node.tag === tag), tag))
  return doc
}
const jsonData = doc => doc.nodes(node => node.tag === 'script' && node.attrs.type === 'application/ld+json').map(node => {
  try { return JSON.parse(node.raw) } catch { fail('malformed native structured data') }
})
const parseLocations = (raw, country, remote) => {
  const labels = norm(raw).replace(/^(?:Hybrid|Remote|In Office),\s*/i, '').split(',').map(value => value.trim()).filter(Boolean)
  for (const label of labels) {
    const declared = /^[A-Z]{2,3}$/.test(label) ? null : nativeCountryName(label)
    if (declared && declared !== country) fail('contradictory country/location')
    if (country !== 'India' && isIndiaJob({ location: label }) && !declared && !/^remote$/i.test(label)) fail('Indian city contradicts foreign country')
  }
  const cities = labels.filter(label => nativeCountryName(label) !== country)
  if (!cities.length) return [remote === 'Remote' ? `Remote, ${country}` : country]
  return cities.map(city => `${city}, ${country}`)
}
export const parseNativeListing = html => {
  const doc = readPage(html)
  if (doc.text(requireOne(doc.nodes(node => node.tag === 'h1'), 'listing title')) !== 'Search Open Positions') fail('official listing identity changed')
  if (doc.nodes(node => node.attrs.rel === 'next' || /pagination|load-more|pager/i.test(node.attrs.class || '')).length) fail('unverified pagination')
  const schema = requireOne(jsonData(doc).filter(value => value?.['@type'] === 'ItemList'), 'native ItemList')
  if (!Array.isArray(schema.itemListElement) || !schema.itemListElement.length || schema.itemListElement.length > 500) fail('unknown empty or oversized listing contract')
  const structured = new Set()
  schema.itemListElement.forEach((entry, index) => {
    if (entry['@type'] !== 'ListItem' || entry.position !== index + 1) fail('invalid structured listing order')
    jobIdentity(entry.url)
    const key = urlKey(entry.url)
    if (structured.has(key)) fail('duplicate structured role')
    structured.add(key)
  })
  const facets = new Map()
  for (const node of doc.nodes(node => node.tag === 'span' && node.attrs['data-country-name'] !== undefined)) {
    const country = nativeCountryName(node.attrs.country), count = Number(node.attrs['data-count'])
    if (!country || nativeCountryName(node.attrs['data-country-name']) !== country || facets.has(country) || !Number.isSafeInteger(count) || count < 0) fail('invalid native country facet')
    facets.set(country, count)
  }
  const cards = doc.nodes(node => node.tag === 'li' && doc.hasClass(node, 'job-listing'))
  if (cards.length !== structured.size || [...facets.values()].reduce((sum, count) => sum + count, 0) !== cards.length) fail('native listing/card/facet totals disagree')
  const ids = new Set(), nativeIds = new Set(), urls = new Set(), observed = new Map()
  const records = cards.map(card => {
    doc.outer(card)
    const country = nativeCountryName(card.attrs.country), remote = card.attrs.remotetype || null
    if (!country || !facets.has(country)) fail('missing card country')
    const link = requireOne(doc.nodes(node => node.tag === 'a', card), 'card role link'), detailUrl = link.attrs.href
    const key = urlKey(detailUrl), jobId = jobIdentity(detailUrl), title = doc.text(link)
    const holder = requireOne(doc.nodes(node => node.attrs['item-id'] !== undefined, card), 'CMS role identity')
    const nativeId = holder.attrs['item-id']
    const label = requireOne(doc.nodes(node => node.tag === 'div' && doc.hasClass(node, '-fr'), card), 'card location')
    const department = doc.text(doc.nodes(node => node.tag === 'h6' && node.start < card.start).at(-1))
    if (!title || !department || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(nativeId) || ids.has(jobId) || nativeIds.has(nativeId) || urls.has(key) || !structured.has(key)) fail('invalid or duplicate native role identity')
    ids.add(jobId); nativeIds.add(nativeId); urls.add(key)
    observed.set(country, (observed.get(country) || 0) + 1)
    return { title, department, country, remoteStatus: remote, listingLocation: doc.text(label), locations: parseLocations(doc.text(label), country, remote), detailUrl, jobId, nativeId }
  })
  if ([...facets].some(([country, count]) => observed.get(country) !== count)) fail('native country counts disagree')
  return { records, indiaCount: observed.get('India') || 0 }
}
const dateValue = value => {
  if (value == null || value === '') return null
  const match = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value)
  if (!match || !Number.isFinite(Date.parse(value))) fail('invalid native publication/closing date')
  const y = +match[1], m = +match[2], d = +match[3], leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)
  if (m < 1 || m > 12 || d < 1 || d > [31,leap ? 29 : 28,31,30,31,30,31,31,30,31,30,31][m-1]) fail('impossible native calendar date')
  return value
}
export const parseNativeDetail = (html, row) => {
  const doc = readPage(html), schema = requireOne(jsonData(doc).filter(value => value?.['@type'] === 'JobPosting'), 'JobPosting')
  if (/\b(?:this (?:job|position|requisition) is no longer (?:available|active)|(?:this )?position (?:has been|is) filled)\b/i.test(doc.text(doc.root))) fail('native role is visibly closed')
  const title = doc.text(requireOne(doc.nodes(node => node.tag === 'h1'), 'role title'))
  const id = requireOne(doc.nodes(node => node.tag === 'input' && node.attrs.id === 'jobId'), 'native Jobvite ID').attrs.value
  if (id !== row.jobId || title !== row.title || norm(schema.title) !== title || schema.hiringOrganization?.name !== 'Progress'
    || schema.hiringOrganization?.alternateName !== 'Progress Software' || schema.hiringOrganization?.url !== 'https://www.progress.com/') fail('detail/listing/employer identity mismatch')
  const field = name => {
    const container = requireOne(doc.nodes(node => node.tag === 'div' && node.children.some(child => typeof child === 'object' && child.tag === 'h6' && doc.text(child) === name)), name + ' container')
    doc.outer(container)
    return doc.nodes(node => node.tag === 'p', container).map(node => doc.text(node))
  }
  const department = field('Job Category'), remote = field('Remote Type'), locations = field('Location')
  if (department.length !== 1 || department[0] !== row.department || remote.length !== 1 || remote[0] !== row.remoteStatus || !locations.length) fail('detail fields disagree with listing')
  const fullLocations = locations.map(location => {
    const country = nativeLocationCountryName(location)
    if (!country || country !== row.country) fail('detail country contradicts listing')
    const city = location.split(',')[0].trim()
    if (country !== 'India' && isIndiaJob({ location: city }) && city !== country && !/^remote$/i.test(city)) fail('detail Indian city contradicts foreign country')
    return location === country && remote[0] === 'Remote' ? `Remote, ${country}` : location
  })
  const cities = values => values.map(value => value.split(',')[0].trim()).sort()
  if (new Set(fullLocations).size !== fullLocations.length || JSON.stringify(cities(fullLocations)) !== JSON.stringify(cities(row.locations))) fail('detail/listing location inventory mismatch for ' + id)
  const addresses = (Array.isArray(schema.jobLocation) ? schema.jobLocation : [schema.jobLocation]).map(location => location?.address)
  if (!addresses.length || addresses.some(address => nativeCountryName(address?.addressCountry) !== row.country || (address?.addressLocality && norm(address.addressLocality) !== row.country && !cities(fullLocations).includes(norm(address.addressLocality))))) fail('schema geography contradicts visible locations')
  const summary = doc.nodes(node => node.tag === 'div' && node.children.some(child => typeof child === 'object' && child.tag === 'h2' && doc.text(child) === 'Job Summary'))
  if (summary.length > 1) fail('ambiguous source description')
  const contentNode = summary[0]?.children.find(child => typeof child === 'object' && child.tag === 'div')
  // Headings organize employer prose; they cannot supply a missing JD alone.
  const description = contentNode && extractActiveDescription(proseText(contentNode)) ? readable(extractActiveDescription(doc.inner(contentNode))) : null
  const schemaDescription = readable(extractActiveDescription(schema.description))
  if (description && schemaDescription && description.replace(/\s+/g, '') !== schemaDescription.replace(/\s+/g, '')) fail('visible/schema source description mismatch')
  return { title, company: 'Progress Software', source: 'progresssoftware', jobId: id, requisitionId: id, nativeListingId: row.nativeId,
    sourceUrl: row.detailUrl, applyUrl: row.detailUrl, link: row.detailUrl, department: row.department,
    location: fullLocations[0], locations: fullLocations, city: fullLocations[0] === row.country ? null : fullLocations[0].split(',')[0], country: row.country,
    remoteStatus: remote[0] === 'In Office' ? 'On-site' : remote[0], employmentType: schema.employmentType || null,
    experienceRequired: schema.experienceRequirements || null, postingDate: dateValue(schema.datePosted), closingDate: dateValue(schema.validThrough),
    sourceClosingDateIsExact: Boolean(schema.validThrough?.includes('T')), jobDescription: description, sourceDescription: description,
    sourceDetailComplete: Boolean(description), sourceListingComplete: Boolean(description), requiredSkills: [] }
}
