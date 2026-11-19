import { isDeepStrictEqual as equal } from 'node:util'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { check } from './currentModels20261117.js'

const ROOT = 'https://zeoncharging.com/'
const COMPANY = 'Zeon Electric Pvt Ltd'
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
const requiredHeading = (document, node) => typeof node !== 'string' && /^h[1-6]$/.test(node.tag)
  && /^(?:requirements|required skills)$/i.test(document.text(node))
const fullRequiredCriteria = document => {
  const root = document.nodes(node => node.tag === 'root')[0]
  const authored = root.children.filter(node => typeof node === 'string' ? node.trim() : !node.inert)
  const headings = authored.map((node, index) => requiredHeading(document, node) ? index : -1).filter(index => index >= 0)
  if (headings.length !== 1) return false
  const after = authored.slice(headings[0] + 1)
  const nextHeading = after.findIndex(node => typeof node !== 'string' && /^h[1-6]$/.test(node.tag))
  const section = nextHeading < 0 ? after : after.slice(0, nextHeading)
  if (section.length !== 1 || typeof section[0] === 'string' || !['ul', 'ol'].includes(section[0].tag)) return false
  const items = section[0].children.filter(node => typeof node === 'string' ? node.trim() : !node.inert)
  return items.length > 0 && items.every(node => typeof node !== 'string' && node.tag === 'li'
    && document.text(node).length >= 20
    && !/\b(?:preview|truncated|read more|view full)\b|\b(?:criteria|requirements?|description|details)\s+(?:are\s+)?(?:available|provided)\s+(?:on|upon)\s+request\b/i.test(document.text(node)))
}

// Independently qualify the publisher's JobPosting and its corresponding form.
// An unrelated role's opaque Flight payload is retained without making it an
// employer-wide inventory or a prerequisite for an otherwise identical role.
export function qualifyCurrentZeon(opening, closing) {
  check(equal({ ...opening, applications: [] }, { ...closing, applications: [] }),
    'whole current publisher, listing, record or declared programme closing changed')
  const about = opening.documents.find(page => page.url === ROOT + 'about_us')
  const organizations = (about?.fullJSONModels ?? []).flatMap(carrier =>
    Array.isArray(carrier.value) ? carrier.value : [carrier.value])
    .filter(value => value?.['@type'] === 'Organization')
  const aboutDocument = readNativeDocument(about?.fullNativeHTML ?? '')
  check(organizations.length === 1 && organizations[0].name === 'Zeon Charging'
    && organizations[0].legalName === 'Zeon Electric Private Limited'
    && organizations[0].url === ROOT.slice(0, -1)
    && aboutDocument.nodes(node => node.tag === 'p' && aboutDocument.text(node).includes(COMPANY)).length > 0,
  'current own brand and legal employer binding')
  const jobs = [], heldRecords = []
  for (const record of opening.records) {
    const hold = reason => heldRecords.push({ ...record, holdReason: reason,
      openingApplication: opening.applications.find(value => value.nativeId === record.nativeId) ?? null,
      closingApplication: closing.applications.find(value => value.nativeId === record.nativeId) ?? null })
    const schema = record.originalSchema, employer = schema.hiringOrganization
    const description = readNativeDocument(schema.description)
    const activeDescription = description.text(description.nodes(node => node.tag === 'root')[0])
    if (/\bZeon\s+International\b/i.test(schema.description) || /\bZeon\s+International\b/i.test(activeDescription)) {
      hold('native-description-publishes-different-employer')
      continue
    }
    if (schema['@context'] !== 'https://schema.org' || employer?.['@type'] !== 'Organization'
      || employer.name !== 'Zeon Charging' || employer.sameAs !== ROOT.slice(0, -1)
      || schema.identifier?.name !== 'Zeon Charging'
      || schema.jobLocation?.address?.addressCountry !== 'IN'
      || typeof schema.jobLocation.address.addressLocality !== 'string'
      || !schema.jobLocation.address.addressLocality.trim()
      || schema.employmentType !== 'FULL_TIME' || !date(schema.datePosted) || !date(schema.validThrough)
      || schema.validThrough < schema.datePosted || schema.description.length < 150
      || !fullRequiredCriteria(description)) {
      hold('native-employer-country-date-or-full-criteria-unqualified')
      continue
    }
    const first = opening.applications.filter(value => value.nativeId === record.nativeId)
    const last = closing.applications.filter(value => value.nativeId === record.nativeId)
    if (first.length !== 1 || last.length !== 1 || !equal(first[0], last[0])) {
      hold('native-own-application-closing-not-reconciled')
      continue
    }
    jobs.push({ ...record, company: COMPANY, source: 'zeoncharging',
      city: schema.jobLocation.address.addressLocality,
      location: schema.jobLocation.address.addressLocality, country: 'India',
      sourceUrl: record.applyUrl, link: record.applyUrl,
      jobDescription: schema.description, sourceDescription: schema.description,
      postingDate: schema.datePosted, closingDate: schema.validThrough,
      employmentType: schema.employmentType, nativeJobPosting: schema,
      nativeApplicationForm: first[0].originalApplicationForm,
      sourceDetailComplete: true, sourceEmployerQualified: true, sourcePublicationQualified: true,
      sourceApplicationQualified: false, applicationSubmitted: false,
      criteriaAuthority: 'current-first-party-JobPosting-and-matching-application-identity',
      criteriaBrowserEquivalenceComplete: false })
  }
  return { jobs, heldRecords, closingFullNativeModelsMatch: equal(opening, closing),
    qualifiedRoleModelsClosingMatch: true }
}
