import { decodeHTML } from 'entities'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { nativeCountryName, nativeDate } from '../../scraper-support/shared/nativeJobPosting.js'

export const CORPORATE_CAREERS = 'https://www.lennox.com/careers/'
export const GLOBAL_SEARCH = 'https://globalcareers-lennox.icims.com/jobs/search?ss=1&in_iframe=1'
const need = (condition, message) => {
  if (!condition) throw Object.assign(Error('[lennox] Current iCIMS ' + message), { code: 'NATIVE_HTML_SHAPE', abortRetries: true })
}
const norm = value => decodeHTML(String(value ?? '')).replace(/\s+/g, ' ').trim()
const one = (values, label) => { need(values.length === 1, 'requires one active ' + label); return values[0] }
const excluded = new Set(['blockquote', 'q', 'pre', 'code', 'template', 'noscript', 'style', 'textarea'])
const textBoundaries = new Set(['root', 'html', 'body', 'div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
  'section', 'article', 'main', 'header', 'footer', 'br', 'hr'])

function document(html) {
  const base = readNativeDocument(html)
  const root = base.nodes(node => node.tag === 'root')[0]
  const nodes = (predicate, subtree = root) => {
    const result = []
    const visit = node => {
      if (node.inert || excluded.has(node.tag)) return
      if (predicate(node)) result.push(node)
      for (const child of node.children) if (typeof child !== 'string') visit(child)
    }
    visit(subtree)
    return result
  }
  const text = node => {
    const read = value => {
      if (typeof value === 'string') return decodeHTML(value)
      if (value.inert || excluded.has(value.tag) || ['script', 'title'].includes(value.tag)) return ''
      // Inline markup does not introduce whitespace; block elements and explicit breaks do.
      const content = value.children.map(read).join('')
      return textBoundaries.has(value.tag) ? ' ' + content + ' ' : content
    }
    return norm(read(node))
  }
  need(nodes(node => node.tag === 'base').length === 0, 'unreviewed document base URL')
  return { root, nodes, text, hasClass: base.hasClass }
}

function nativeURL(value, base = GLOBAL_SEARCH) {
  let url
  try { url = new URL(value, base) } catch { need(false, 'invalid native URL') }
  need(url.protocol === 'https:' && !url.username && !url.password && !url.hash, 'unqualified native URL authority')
  return url
}

function jobURL(value) {
  const url = nativeURL(value)
  const match = /^\/jobs\/(\d+)\/([^/]+)\/job$/.exec(url.pathname)
  need(/^[a-z0-9-]+-lennox\.icims\.com$/.test(url.hostname) && match, 'job URL outside declared Lennox iCIMS program')
  return { url: url.href, id: match[1], identity: url.origin + url.pathname }
}

function locationLabels(doc, node) {
  const header = one(doc.nodes(child => doc.hasClass(child, 'header') && doc.hasClass(child, 'left'), node), 'work location header')
  const label = one(doc.nodes(child => doc.hasClass(child, 'field-label'), header), 'work location label')
  need(doc.text(label) === 'Job Locations', 'work location field changed')
  const values = header.children.filter(child => typeof child !== 'string' && child !== label && child.tag === 'span').map(doc.text).filter(Boolean)
  need(values.length > 0, 'missing explicit work country label')
  for (const value of values) need(/^[A-Z]{2}-.+/.test(value) && nativeCountryName(value.slice(0, 2)), 'unrecognized explicit work country label')
  return values
}

function field(doc, node, label) {
  const matches = doc.nodes(child => doc.hasClass(child, 'iCIMS_JobHeaderTag'), node)
    .filter(child => doc.nodes(item => item.tag === 'dt' && doc.text(item) === label, child).length)
  if (!matches.length) return null
  return doc.text(one(doc.nodes(child => child.tag === 'dd', one(matches, label)), label + ' value'))
}

export function readCurrentLennoxListings(html) {
  const doc = document(html)
  const rows = doc.nodes(node => node.tag === 'li' && doc.hasClass(node, 'iCIMS_JobCardItem')).map(node => {
    const anchor = one(doc.nodes(child => child.tag === 'a' && doc.hasClass(child, 'iCIMS_Anchor'), node), 'job card link')
    const link = jobURL(anchor.attrs.href)
    const title = doc.text(one(doc.nodes(child => child.tag === 'h3', anchor), 'job card title'))
    const locations = locationLabels(doc, node)
    const countries = [...new Set(locations.map(value => nativeCountryName(value.slice(0, 2))))]
    const requisitionId = field(doc, node, 'Requisition #')
    need(title && requisitionId && requisitionId.endsWith('-' + link.id), 'listing requisition/URL identity mismatch')
    const country = countries.length === 1 ? countries[0] : null
    const city = locations.length === 1 && locations[0].startsWith('IN-') ? locations[0].slice(3) : null
    return { title, company: 'Lennox', jobId: link.id, requisitionId, sourceUrl: link.url,
      location: city && country ? city + ', ' + country : locations.join(' / '), city, country,
      nativeLocationLabels: locations, nativeListingRecord: { title, href: anchor.attrs.href, requisitionId, locations },
      nativeRecordKind: 'icims-current-job-card' }
  })
  need(new Set(rows.map(row => row.jobId)).size === rows.length, 'duplicate listing role identity')
  return rows
}

export function readCurrentLennoxDetail(html, listing) {
  const doc = document(html), link = jobURL(listing.sourceUrl)
  const title = doc.text(one(doc.nodes(node => node.tag === 'h1' && doc.hasClass(node, 'iCIMS_Header')), 'role title'))
  need(title === listing.title, 'listing/visible title mismatch')
  const postings = []
  const walk = record => {
    if (Array.isArray(record)) { record.forEach(walk); return }
    if (!record || typeof record !== 'object') return
    if (record['@type'] === 'JobPosting') postings.push(record)
    if (record['@graph']) walk(record['@graph'])
  }
  for (const script of doc.nodes(node => node.tag === 'script' && node.attrs.type === 'application/ld+json')) walk(JSON.parse(script.raw))
  const posting = one(postings, 'native JobPosting')
  need(norm(posting.title) === title && jobURL(posting.url).identity === link.identity, 'native schema/title/URL identity mismatch')
  const employer = posting.hiringOrganization
  need(employer && employer.name === 'Lennox International' && employer.sameAs === 'www.lennoxinternational.com', 'native employer changed')
  const locations = locationLabels(doc, one(doc.nodes(node => doc.hasClass(node, 'iCIMS_JobContent')), 'role content'))
  need(JSON.stringify(locations) === JSON.stringify(listing.nativeLocationLabels), 'listing/detail work country label mismatch')
  const nativeLocations = Array.isArray(posting.jobLocation) ? posting.jobLocation : [posting.jobLocation]
  need(nativeLocations.length > 0 && nativeLocations.length <= 16, 'missing native country addresses')
  const addresses = nativeLocations.map(location => {
    const address = location?.address
    need(address && typeof address.addressCountry === 'string' && nativeCountryName(address.addressCountry), 'missing explicit native country')
    return { address, country: nativeCountryName(address.addressCountry) }
  })
  const visibleCountries = [...new Set(locations.map(value => nativeCountryName(value.slice(0, 2))))]
  need(addresses.every(value => visibleCountries.includes(value.country)) && visibleCountries.every(country => addresses.some(value => value.country === country)), 'listing/schema work country conflict')
  need(addresses.every(value => value.country === 'India'), 'native detail outside explicit India scope')
  const requisitionId = field(doc, doc.root, 'Requisition #')
  need(requisitionId === listing.requisitionId && requisitionId.endsWith('-' + link.id), 'listing/detail requisition identity mismatch')
  const headings = doc.nodes(node => node.tag === 'h2' && doc.hasClass(node, 'iCIMS_InfoField_Job'))
  const sections = doc.nodes(node => doc.hasClass(node, 'iCIMS_InfoMsg_Job'))
  need(JSON.stringify(headings.map(doc.text)) === JSON.stringify(['Company Profile', 'Job Description', 'Qualifications']) && sections.length === 3, 'full role criteria sections changed')
  need(typeof posting.description === 'string', 'missing full native description')
  const schemaDocument = document(posting.description)
  const schemaText = schemaDocument.text(schemaDocument.root)
  const visibleCriteria = sections.map((section, index) => ({ heading: doc.text(headings[index]), text: doc.text(section) }))
  need(schemaText.length >= 200 && norm(visibleCriteria.map(section => section.heading + ' ' + section.text).join(' ')) === schemaText, 'visible/schema full criteria mismatch')
  const applications = doc.nodes(node => node.tag === 'a' && doc.hasClass(node, 'iCIMS_ApplyOnlineButton'))
  const application = nativeURL(one(applications, 'native application link').attrs.href)
  need(application.origin + application.pathname === link.identity && application.searchParams.get('mode') === 'apply' && application.searchParams.get('apply') === 'yes', 'native application identity changed')
  const posted = nativeDate(posting.datePosted, { required: true }), closing = nativeDate(posting.validThrough)
  need(!closing.iso || closing.iso >= posted.iso, 'native expiry precedes publication')
  const city = addresses.length === 1 && typeof addresses[0].address.addressLocality === 'string' ? addresses[0].address.addressLocality : null
  return { title, company: employer.name, sourceConfiguredCompanyName: 'Lennox', source: 'lennox',
    jobId: link.id, requisitionId, nativeRequisitionId: requisitionId, sourceUrl: listing.sourceUrl,
    applyUrl: application.href, link: application.href, country: 'India', city,
    location: city ? city + ', India' : 'India', department: field(doc, doc.root, 'Category'),
    employmentType: posting.employmentType, postingDate: posting.datePosted, closingDate: posting.validThrough ?? null,
    sourceClosingDateIsExact: closing.exact, jobDescription: posting.description, sourceDescription: posting.description,
    experienceRequired: null, sourceExperienceRequired: null, sourceExperienceScopeUnresolved: true,
    publicExperienceChecked: false, skipPublicExperienceEnrichment: true,
    nativeHiringOrganization: employer, nativeJobPosting: posting, nativeVisibleCriteria: visibleCriteria,
    nativeListingRecord: listing.nativeListingRecord ?? listing, nativeCountryAddresses: nativeLocations,
    legalEmployer: null, nativeLegalEmployer: null, legalEmployerVerified: false,
    sourceDetailComplete: true, sourceDetailStatus: 'native-schema-visible-criteria-reconciled',
    sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
    applicationVisited: false, applicationSubmitted: false }
}

export function inspectLennoxCorporateDeclaration(html) {
  const doc = document(html)
  need(norm(one(doc.nodes(node => node.tag === 'title'), 'corporate title').raw) === 'Careers | Lennox', 'corporate publisher title changed')
  need(one(doc.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical'), 'corporate canonical').attrs.href === CORPORATE_CAREERS, 'corporate publisher canonical changed')
  const links = doc.nodes(node => node.tag === 'a' && node.attrs.href === 'https://globalcareers-lennox.icims.com/')
  need(links.length > 0 && links.some(node => doc.text(node) === 'Explore All Lennox Career Opportunities'), 'current corporate iCIMS declaration missing')
  return { publisher: CORPORATE_CAREERS, declaredProgram: 'https://globalcareers-lennox.icims.com/' }
}

export function discoverLennoxIndiaSearches(html) {
  const doc = document(html)
  const form = one(doc.nodes(node => node.tag === 'form' && node.attrs.id === 'searchForm'), 'native search form')
  const action = nativeURL(form.attrs.action)
  need(action.origin === 'https://globalcareers-lennox.icims.com' && action.pathname === '/jobs/search' && (!form.attrs.method || form.attrs.method.toLowerCase() === 'get'), 'native search form authority changed')
  const select = one(doc.nodes(node => node.tag === 'select' && node.attrs.name === 'searchLocation', form), 'native location selector')
  const options = doc.nodes(node => node.tag === 'option' && /^India-/.test(doc.text(node)), select)
  need(options.length > 0 && options.length <= 16, 'no bounded explicitly declared India search facets')
  return options.map(option => {
    need(option.attrs.value && /^\d+--?.+/.test(option.attrs.value), 'invalid native India facet value')
    const url = new URL(action.href)
    for (const input of doc.nodes(node => node.tag === 'input' && node.attrs.name && node.attrs.type === 'hidden' && node.attrs.value, form)) url.searchParams.set(input.attrs.name, input.attrs.value)
    url.searchParams.set(select.attrs.name, option.attrs.value)
    return { label: doc.text(option), nativeValue: option.attrs.value, url: url.href }
  })
}

export function nextLennoxNativePage(html) {
  const doc = document(html)
  const links = doc.nodes(node => node.tag === 'a' && !doc.hasClass(node, 'invisible') && doc.text(node) === 'Next page of results')
  if (!links.length) return null
  const url = nativeURL(one(links, 'next results page').attrs.href)
  need(url.origin === 'https://globalcareers-lennox.icims.com' && url.pathname === '/jobs/search', 'native pagination authority changed')
  return url.href
}

