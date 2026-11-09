import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { createHash } from 'node:crypto'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

export const SOURCE = 'selectsys'
export const COMPANY = 'Selectsys'
export const HOMEPAGE_URL = 'https://www.selectsys.com/'
export const CAREERS_URL = 'https://www.selectsys.com/careers'
export const APPLICATION_EMAIL = 'hr@selectsys.com'
export const ROLE_LIST_LABEL = "Roles We're Hiring For"
export const ROLE_LOCATION = null

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  officialBrandName: 'Selectsys',
  adapter: 'script',
  modulePath: '../../scraper/selectsys/script.js',
  homepageUrl: HOMEPAGE_URL,
  companyCareerPage: CAREERS_URL,
  atsPlatform: 'official-company-careers-email-apply',
  countryFilter: 'India',
  paginationStrategy: 'single-page-static-role-list',
  extractionStrategy: 'verified-first-party-careers-page+same-page-role-list+email-apply',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'selectsys.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.selectsys.com/careers was the live first-party Selectsys careers page, that it publicly listed six hiring titles under Roles We\'re Hiring For, and that candidates were instructed to email resumes to hr@selectsys.com with the job title in the subject line.',
  dryRunFile: 'selectsys/jobs.json',
}

const normalizeWhitespace = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
  includeResponseMetadata: true,
  signal,
})

const coverageGap = message => Object.assign(new Error('Selectsys coverage gap: ' + message), { code: 'SELECTSYS_COVERAGE_GAP' })
const descendants = (node, predicate) => node.inert ? [] : [
  ...(predicate(node) ? [node] : []),
  ...node.children.filter(child => typeof child !== 'string').flatMap(child => descendants(child, predicate)),
]
const afterHeading = (document, label) => {
  const headings = document.nodes(node => /^h[1-6]$/.test(node.tag) && document.text(node) === label)
  if (headings.length !== 1) throw coverageGap('Expected one active ' + label + ' heading')
  const parents = document.nodes(node => node.children.includes(headings[0]))
  if (parents.length !== 1) throw coverageGap('Unbound ' + label + ' section')
  const nodes = []
  for (const node of parents[0].children.slice(parents[0].children.indexOf(headings[0]) + 1)) {
    if (typeof node === 'string' || node.inert) continue
    if (/^h[1-6]$/.test(node.tag)) break
    nodes.push(node)
  }
  return nodes
}

export const hasOfficialCareersSignal = (html = '') => {
  const document = readNativeDocument(html)
  return document.nodes(node => node.tag === 'h1' && document.text(node) === 'Careers at Selectsys').length === 1
    && document.nodes(node => /^h[1-6]$/.test(node.tag) && document.text(node) === ROLE_LIST_LABEL).length === 1
    && document.nodes(node => node.tag === 'p' && document.text(node).includes('Selectsys is a global team across the U.S. and India')).length >= 1
    && document.nodes(node => node.tag === 'p' && document.text(node).includes(APPLICATION_EMAIL)).length >= 1
}

export const extractRoles = (html = '') => {
  const document = readNativeDocument(html)
  const lists = afterHeading(document, ROLE_LIST_LABEL).flatMap(node => descendants(node, child => child.tag === 'ul'))
  if (lists.length !== 1) throw coverageGap('Expected one native role list')
  return lists[0].children.filter(node => typeof node !== 'string' && !node.inert && node.tag === 'li')
    .map(node => document.text(node)).filter(Boolean)
}

// Preserve the published email route. Subject instructions stay original text.
export const buildApplyUrl = () => `mailto:${APPLICATION_EMAIL}`

export const run = async ({ fetchText = defaultFetchText, now = () => new Date().toISOString(), signal, onAudit = () => {} } = {}) => {
  signal?.throwIfAborted()
  const response = await fetchText(CAREERS_URL, { signal })
  signal?.throwIfAborted()
  const careersHtml = typeof response === 'string' ? response : response?.html
  if (typeof careersHtml !== 'string' || (typeof response !== 'string' && (response.status !== 200 || response.url !== CAREERS_URL))) {
    throw coverageGap('Careers HTTP status/final URL unavailable or changed')
  }
  if (!hasOfficialCareersSignal(careersHtml)) throw coverageGap('Verified first-party careers page changed materially')
  const roles = extractRoles(careersHtml)
  if (!roles.length) throw coverageGap('First-party careers page no longer exposes public role titles')
  const document = readNativeDocument(careersHtml)
  const applicationNodes = afterHeading(document, 'How to Apply')
  const instructions = normalizeWhitespace(applicationNodes.map(node => document.text(node)).join(' '))
  const applicationLinks = applicationNodes.flatMap(node => descendants(node, child => child.tag === 'a' && child.attrs.href)).map(node => ({ href: node.attrs.href, text: document.text(node) }))
  const expected = buildApplyUrl()
  const explicitEmail = instructions.includes(APPLICATION_EMAIL)
  const ambiguousApplication = applicationLinks.some(link => link.text.includes(APPLICATION_EMAIL) && link.href !== expected)
  const applyUrl = explicitEmail && !ambiguousApplication ? expected : null
  const documentSHA256 = createHash('sha256').update(careersHtml).digest('hex')
  const application = { instructions, links: applicationLinks, applyUrl, ambiguous: ambiguousApplication,
    provenance: applicationLinks.some(link => link.href === expected) ? 'original-native-mailto' : 'explicit-visible-email-instructions', subjectConstructed: false }
  const observations = roles.map(title => ({ title, country: null, location: null, jobId: null, requisitionId: null,
    jobDescription: null, nativeIdentifier: null, sourceDocumentSHA256: documentSHA256 }))
  const audit = { source: SOURCE, originalHTML: careersHtml, documentSHA256, observations, application,
    countryScope: 'Corporate U.S./India team and office text does not assign any individual role a country.',
    fullSourceVerified: false, authoritativeSourceTotal: null, authoritativeIndiaFacetCount: null, lifecycleCleanupAllowed: false }
  await onAudit(structuredClone(audit))
  signal?.throwIfAborted()
  const jobs = observations.map(observation => ({
    title: observation.title, location: null, locations: [], city: null, state: null, country: null,
    jobId: null, requisitionId: null, jobDescription: null, sourceDescription: null,
    sourceCountryScopeUnresolved: true, sourceDetailComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false,
    sourceNativeRole: observation, sourceNativeApplication: application,
    applyUrl, sourceUrl: CAREERS_URL, company: COMPANY, link: applyUrl, source: SOURCE,
    publicExperienceChecked: false, scrapedAt: now(),
  }))
  Object.defineProperty(jobs, 'sourceAudit', { value: audit })
  return attachInventoryEvidence(jobs, { status: 'discovery-only', surface: CAREERS_URL,
    firstParty: typeof response !== 'string', listingComplete: false, pagesFetched: 1,
    reportedTotal: null, indiaFacetCount: null, verifiedAt: now(),
    reason: 'selectsys-native-title-and-application-observations-retained-role-country-detail-identity-and-source-scope-unresolved' })
}

