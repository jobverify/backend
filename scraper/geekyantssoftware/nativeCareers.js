import { createHash } from 'node:crypto'
import { readNativeDocument, extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { GEEKYANTS_SOFTWARE_CATALOG as catalog } from './catalog.js'

const text = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const descendants = (node, predicate) => node.inert ? [] : [
  ...(predicate(node) ? [node] : []),
  ...node.children.filter(child => typeof child !== 'string').flatMap(child => descendants(child, predicate)),
]
const openingUrl = value => {
  try {
    const url = new URL(value)
    return url.origin === 'https://topgeek.io' && !url.username && !url.password && !url.search && !url.hash
      && new RegExp(`^/company/${catalog.topgeekCompanySlug}/openings/[a-z\\d-]+$`, 'i').test(url.pathname) ? url.href : null
  } catch { return null }
}
const plain = value => typeof value === 'string' ? extractActiveDescription(value) || '' : ''
const comparableCity = value => (normalizeCity(value) || text(value)).toLowerCase()

// The redesigned page publishes the full criteria alongside each card and an
// explicit ItemList. Reconcile all three representations before claiming a
// complete observed India inventory; legacy TopGeek layouts use the old path.
export const readNativeGeekyantsCareers = html => {
  const document = readNativeDocument(html)
  const cards = document.nodes(node => node.tag === 'a' && openingUrl(node.attrs.href)
    && document.hasClass(node, 'group/opening'))
  if (!cards.length) return null
  if (!document.nodes(node => node.tag === 'title').some(node => /Careers/i.test(node.raw || '')
    && /GeekyAnts/i.test(node.raw || ''))) throw new Error('GeekyAnts native careers title identity unavailable')
  const issues = [], schemas = []
  for (const node of document.nodes(node => node.tag === 'script' && !node.attrs.src
    && /^application\/ld\+json$/i.test(node.attrs.type || ''))) {
    try {
      const value = JSON.parse(node.raw || '')
      schemas.push(...(Array.isArray(value) ? value : Array.isArray(value?.['@graph']) ? value['@graph'] : [value]))
    } catch { issues.push('native-structured-data-invalid') }
  }
  const lists = schemas.filter(schema => schema?.['@type'] === 'ItemList'
    && schema['@id'] === 'https://geekyants.com/join-geekyants#openings')
  const postings = schemas.filter(schema => schema?.['@type'] === 'JobPosting')
  const list = lists.length === 1 ? lists[0] : null
  if (!list || !Number.isSafeInteger(list.numberOfItems) || !Array.isArray(list.itemListElement)
    || list.numberOfItems !== list.itemListElement.length) issues.push('native-opening-count-unavailable')
  const counted = list?.itemListElement || []
  const byUrl = new Map()
  for (const card of cards) {
    const url = openingUrl(card.attrs.href)
    if (byUrl.has(url)) issues.push('duplicate-native-opening-card')
    byUrl.set(url, card)
  }
  const postedUrls = postings.map(posting => openingUrl(posting.url))
  const listedUrls = counted.map(entry => openingUrl(entry.url))
  if (postedUrls.some(url => !url) || listedUrls.some(url => !url)
    || new Set(postedUrls).size !== postings.length || new Set(listedUrls).size !== counted.length
    || byUrl.size !== postings.length || byUrl.size !== counted.length
    || [...byUrl.keys()].some(url => !postedUrls.includes(url) || !listedUrls.includes(url))) {
    issues.push('native-opening-identities-not-reconciled')
  }
  const allOpeningLinks = document.nodes(node => node.tag === 'a' && openingUrl(node.attrs.href))
  if (allOpeningLinks.some(node => !byUrl.has(openingUrl(node.attrs.href)))) issues.push('additional-native-opening-unreconciled')
  const jobs = []
  for (const schema of postings) {
    const url = openingUrl(schema.url), card = byUrl.get(url)
    const title = text(schema.title), entry = counted.find(entry => openingUrl(entry.url) === url)
    if (!url || !card || !title || schema.hiringOrganization?.name !== catalog.officialBrandName
      || schema.hiringOrganization?.['@id'] !== 'https://geekyants.com/#organization') {
      issues.push('native-role-or-employer-identity-unverified')
      continue
    }
    const headings = descendants(card, node => /^h[1-6]$/.test(node.tag) || (node.tag === 'p' && document.hasClass(node, 'font-heading')))
    const locations = descendants(card, node => node.tag === 'p' && node.children.some(child => typeof child !== 'string'
      && child.tag === 'svg' && document.hasClass(child, 'lucide-map-pin')))
    const description = plain(schema.description)
    const address = schema.jobLocation?.address
    const city = text(address?.addressLocality)
    const visibleCity = locations.length === 1 ? document.text(locations[0]) : ''
    if (headings.length !== 1 || document.text(headings[0]) !== title || (entry && text(entry.name) !== title)
      || !hasSourceDescription({ jobDescription: description })
      || document.text(card) !== [title, description, visibleCity].join(' ')
      || schema.jobLocation?.['@type'] !== 'Place' || !/^(?:IN|IND|India)$/i.test(text(address?.addressCountry))
      || !city || !visibleCity || comparableCity(visibleCity) !== comparableCity(city)) {
      issues.push(`native-role-criteria-or-country-unreconciled:${url}`)
      continue
    }
    const months = schema.experienceRequirements?.monthsOfExperience
    const jobId = new URL(url).pathname.split('/').at(-1)
    jobs.push({ title, company: catalog.companyName, source: catalog.source, department: null,
      jobId, requisitionId: null, sourceUrl: url, applyUrl: url, link: url,
      location: [city, text(address.addressRegion), 'India'].filter(Boolean).join(', '),
      city: normalizeCity(city), country: 'India',
      employmentType: schema.employmentType === 'FULL_TIME' ? 'Full-time' : text(schema.employmentType) || null,
      experienceRequired: /^(?:0|[1-9]\d*)$/.test(String(months ?? '')) ? `${months} months` : null,
      minimumQualification: null, preferredQualification: null, requiredSkills: [], remoteStatus: null,
      postingDate: text(schema.datePosted) || null, closingDate: text(schema.validThrough) || null,
      jobDescription: description, sourceDescription: schema.description, descriptionHtml: schema.description,
      sourceDescriptionType: 'native-first-party-jobposting', sourceDetailComplete: true,
      nativeFields: { jobPosting: schema, totalJobOpenings: schema.totalJobOpenings ?? null },
    })
  }
  if (jobs.length !== cards.length) issues.push('native-role-detail-incomplete')
  const signature = createHash('sha256').update(JSON.stringify({
    reportedTotal: list?.numberOfItems,
    items: counted.map(entry => ({ url: entry.url, name: entry.name })).sort((left, right) => String(left.url).localeCompare(String(right.url))),
    postings: [...postings].sort((left, right) => String(left.url).localeCompare(String(right.url))),
  })).digest('hex')
  return { jobs, issues: [...new Set(issues)], complete: issues.length === 0,
    reportedTotal: Number.isSafeInteger(list?.numberOfItems) ? list.numberOfItems : null, signature }
}
