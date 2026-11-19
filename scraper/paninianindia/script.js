import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { nativeText, nativeLines } from '../../scraper-support/native-sources/firstPartyNativeHtml.js'
import { createFirstPartyDocumentReader, firstPartyFailure } from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'paninianindia'
export const COMPANY = 'Paninian India'
export const COMPANY_DOMAIN = 'svayatt.co.in'
export const HOMEPAGE_URL = 'https://www.svayatt.co.in/'
export const HOMEPAGE_ALIAS_URLS = [
  'https://paninian.com/',
  'https://paninian.in/',
]
export const CAREERS_URL = 'https://www.svayatt.co.in/blank-19'
export const OPEN_POSITIONS_URL = 'https://www.svayatt.co.in/blank-24'
export const SHARED_APPLY_EMAIL = 'careers_india@paninian.com'
export const SHARED_APPLY_URL = `mailto:${SHARED_APPLY_EMAIL}`
export const MISSING_ROUTE_URLS = [
  'https://www.svayatt.co.in/careers',
  'https://www.svayatt.co.in/career',
  'https://www.svayatt.co.in/jobs',
  'https://www.svayatt.co.in/join-us',
]
export const EXPECTED_JOB_TITLES = [
  'Aerospace Structural Engineer',
  'Avionics and Flight Control Engineer',
  'Business Development Manager',
  'C++ Developer',
  'CAD Engineer',
  'CFD Simulation Engineer',
  'Combustion Systems Engineer',
  'Composite Fabrication Technician',
  'Control Systems Engineer',
  'Electromechanical Assembly Expert',
  'Engineering Manager',
  'Fabrication Technician',
  'Java Developer',
  'JavaScript Developer',
  'Materials Engineer',
  'Power Electronics Engineer',
  'Structural Engineer',
  'UX Developer',
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(String(value ?? ''))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeText = (value) => normalizeWhitespace(value)?.toLowerCase() || ''

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
) || ''

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const normalizeUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    url.search = ''
    return url.toString()
  } catch {
    return null
  }
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
    ?.replace(/\s*\/\s*/g, ' / ')
    ?.replace(/\s*,\s*/g, ', ')

  if (!['Hyderabad', 'Bangalore', 'Hyderabad / Bangalore'].includes(normalized)) {
    throw new Error('Paninian India native job location requires geography review')
  }
  return `${normalized}, India`
}

const extractPrimaryCity = (location) => {
  const normalized = normalizeWhitespace(location)?.replace(/,\s*India$/i, '')
  if (!normalized) return null

  return normalized.includes('/') ? null : normalizeCity(normalized)
}

const extractExperienceRequired = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const exactYearsMatch = normalized.match(/\[\+?\s*(\d+)\s+years?\s+experience\]/i)
  if (exactYearsMatch?.[1]) {
    return `${exactYearsMatch[1]}+ years experience`
  }

  const bracketMatch = normalized.match(/\[([^\]]*?years?\s+experience)\]/i)
  return normalizeWhitespace(bracketMatch?.[1]) || null
}

const extractMinimumQualification = (value) => normalizeWhitespace(
  String(value ?? '').replace(/\s*\[[^\]]+\]\s*$/, ''),
) || null

const normalizeSkill = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/^-+\s*/, '')
    .replace(/,+$/g, ''),
)

export const extractApplyEmail = (html) => {
  const document = readVisibleNativeDocument(String(html ?? ''), { strict: true })
  const emails = new Set()
  const walk = (node, ancestors = []) => {
    if (node.inert || ['header', 'footer', 'nav', 'script', 'style', 'template', 'noscript'].includes(node.tag)) return
    if (node.tag === 'a' && /^mailto:/i.test(node.attrs.href || '')) {
      const address = node.attrs.href.slice(7).toLowerCase()
      const context = ancestors.findLast(parent => /^(?:p|h[1-6])$/.test(parent.tag))
      if (/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(address)
        && normalizeText(nativeText(node)) === address
        && context && /\bemail us at\b/i.test(nativeText(context))) emails.add(address)
    }
    for (const child of node.children) if (typeof child !== 'string') walk(child, [...ancestors, node])
  }
  for (const root of document.nodes(node => node.tag === 'root')) walk(root)
  return emails.size === 1 ? [...emails][0] : null
}

export const extractRichTextSegments = html => readVisibleNativeDocument(String(html ?? ''), { strict: true })
  .nodes(node => node.tag === 'div' && node.attrs['data-testid'] === 'richTextElement')
  .flatMap(node => node.children.filter(child => typeof child !== 'string' && !child.inert && /^h[1-6]$/.test(child.tag)))
  .map(node => ({ lines: nativeLines(node), text: normalizeWhitespace(nativeText(node)) }))
  .filter(segment => segment.text)

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return /<title>\s*Home\s*\|\s*Paninian Svayatt Portal\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.svayatt\.co\.in\/?["']/i.test(page)
    && /<meta[^>]+property=["']og:site_name["'][^>]+content=["']Paninian Svayatt Portal["']/i.test(page)
    && normalized.includes('the unified platform for autonomous systems')
    && /href=["']mailto:info@paninian\.com["']/i.test(page)
    && /linkedin\.com\/company\/paninian-india-pvt-ltd/i.test(page)
}

export const hasVerifiedCareersLink = (html) =>
  /href=["'](?:https:\/\/www\.svayatt\.co\.in\/blank-19|\/blank-19)["']/i.test(String(html ?? ''))
  && normalizeText(html).includes('job openings')

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return /<title>\s*Careers\s*\|\s*Paninian Svayatt Portal\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.svayatt\.co\.in\/blank-19\/?["']/i.test(page)
    && /<meta[^>]+property=["']og:site_name["'][^>]+content=["']Paninian Svayatt Portal["']/i.test(page)
    && normalized.includes('paninian aerospace is seeking to talent accross various disciplines')
    && normalized.includes('join us to make an impact')
    && normalized.includes(SHARED_APPLY_EMAIL)
}

export const hasVerifiedOpenPositionsLink = (html) =>
  /href=["'](?:https:\/\/www\.svayatt\.co\.in\/blank-24|\/blank-24)["']/i.test(String(html ?? ''))
  && normalizeText(html).includes('view open positions')

export const hasOfficialOpenPositionsSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return /<title>\s*open positions\s*\|\s*Paninian Svayatt Portal\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.svayatt\.co\.in\/blank-24\/?["']/i.test(page)
    && /<meta[^>]+property=["']og:site_name["'][^>]+content=["']Paninian Svayatt Portal["']/i.test(page)
    && normalized.includes('open positions')
    && normalized.includes('job title')
    && normalized.includes('min qualification')
    && normalized.includes('skills')
    && normalized.includes('hyderabad')
    && normalized.includes('bangalore')
}

export const isVerifiedHomepageAlias = ({ status, url, html }) =>
  status === 200
  && normalizeUrl(url) === HOMEPAGE_URL
  && hasOfficialHomepageSignal(html)
  && hasVerifiedCareersLink(html)

export const isVerifiedMissingRoute = ({ status, html }) => {
  const page = String(html ?? '')

  return status === 404
    && /<title>\s*404 Error:\s*Page Not Found\s*<\/title>/i.test(page)
    && /<meta[^>]+name=["']robots["'][^>]+content=["']noindex["']/i.test(page)
    && /404-NotBranded/i.test(page)
    && /classic-error-pages-statics/i.test(page)
    && !hasOfficialOpenPositionsSignal(page)
}

const buildRoleFromSegments = ({ titleSegment, locationSegment, qualificationSegment, skillsSegment }) => {
  const title = normalizeWhitespace(titleSegment?.text)
  const location = normalizeLocation(locationSegment?.text)
  const minimumQualification = extractMinimumQualification(qualificationSegment?.text)
  const experienceRequired = extractExperienceRequired(qualificationSegment?.text)
  const requiredSkills = (skillsSegment?.lines || [])
    .map((line) => normalizeSkill(line))
    .filter(Boolean)

  if (!title || !location || !minimumQualification || requiredSkills.length === 0) {
    throw new Error('Paninian India verified open positions grid changed shape')
  }

  const jobId = `${SOURCE}-${slugify(title)}`
  if (!jobId) {
    throw new Error(`Paninian India could not normalize a stable job identifier for ${title}`)
  }

  const nativeRoleRecord = { title, location: normalizeWhitespace(locationSegment.text),
    qualification: normalizeWhitespace(qualificationSegment.text), skills: [...skillsSegment.lines] }
  const sourceDescription = [nativeRoleRecord.qualification, ...nativeRoleRecord.skills].join('\n')
  if (/\b(?:this (?:role|position|job) is (?:closed|filled)|no longer accepting applications|applications (?:are )?closed)\b/i.test(sourceDescription)) {
    throw new Error('Paninian India native role is explicitly closed')
  }
  return {
    title,
    department: null,
    location,
    city: extractPrimaryCity(location),
    state: null,
    country: 'India',
    jobId,
    requisitionId: null,
    sourceNativeJobId: null,
    jobIdentifierProvenance: 'derived source and native title; no native requisition identifier exposed',
    sourceUrl: OPEN_POSITIONS_URL,
    applyUrl: SHARED_APPLY_URL,
    employmentType: null,
    workplaceType: null,
    experienceRequired,
    minimumQualification,
    preferredQualification: null,
    requiredSkills,
    postingDate: null,
    closingDate: null,
    jobDescription: sourceDescription,
    sourceDescription,
    nativeRoleRecord,
    legalEmployer: null,
    nativeEmployerDisplayName: 'Paninian Aerospace',
    sourceDetailComplete: true,
    sourceScopeComplete: false,
    sourceListingComplete: false,
    lifecycleCleanupAllowed: false,
    sourceApplicationHandoff: 'active recruiting paragraph and matching mailto anchor on linked first-party careers page',
    applicationVisited: false,
    applicationSubmitted: false,
    sourceGeographyEvidence: { kind: 'finite-whole-native-city-label', nativeLocation: nativeRoleRecord.location,
      references: ['https://hyderabad.telangana.gov.in/', 'https://bengaluruurban.nic.in/en/history/'] },
    remoteStatus: null,
  }
}

const extractFirstOpenPositionsSection = (html) => {
  const segments = extractRichTextSegments(html)
  const startIndex = segments.findIndex((segment, index) =>
    segment.text === 'Open Positions'
    && segments[index + 1]?.text === 'Job Title'
    && segments[index + 2]?.text === 'Location'
    && segments[index + 3]?.text === 'Min Qualification'
    && segments[index + 4]?.text === 'Skills',
  )

  if (startIndex === -1) {
    throw new Error('Paninian India verified open positions page no longer exposes the trusted jobs section heading')
  }

  const sectionStart = startIndex + 5
  const sectionEnd = segments.findIndex((segment, index) =>
    index > sectionStart
    && (
      segment.text === 'Join us to make an impact.'
      || segment.text === 'The next generation platform for affordable autonomous aerial systems'
    ),
  )

  if (sectionEnd === -1 || sectionEnd <= sectionStart) {
    throw new Error('Paninian India verified open positions page no longer exposes a bounded jobs section')
  }

  return segments.slice(sectionStart, sectionEnd)
}

export const extractPublicJobs = (html) => {
  if (!hasOfficialOpenPositionsSignal(html)) {
    throw new Error('Paninian India verified open positions page no longer matches the trusted first-party surface')
  }

  const sectionSegments = extractFirstOpenPositionsSection(html)
  if (sectionSegments.length < 8) {
    throw new Error('Paninian India verified open positions grid changed shape')
  }

  const wrappedSkillsSegment = sectionSegments[0]
  const wrappedTitleSegments = sectionSegments.slice(-3)
  const groupedSegments = sectionSegments.slice(1, -3)

  if (!wrappedSkillsSegment?.lines?.length || wrappedTitleSegments.length !== 3 || groupedSegments.length % 4 !== 0) {
    throw new Error('Paninian India verified open positions grid changed shape')
  }

  const jobs = []

  for (let index = 0; index < groupedSegments.length; index += 4) {
    jobs.push(buildRoleFromSegments({
      titleSegment: groupedSegments[index],
      locationSegment: groupedSegments[index + 1],
      qualificationSegment: groupedSegments[index + 2],
      skillsSegment: groupedSegments[index + 3],
    }))
  }

  jobs.push(buildRoleFromSegments({
    titleSegment: wrappedTitleSegments[0],
    locationSegment: wrappedTitleSegments[1],
    qualificationSegment: wrappedTitleSegments[2],
    skillsSegment: wrappedSkillsSegment,
  }))

  const dedupedJobs = Array.from(
    new Map(jobs.map((job) => [job.jobId, job])).values(),
  ).sort((left, right) => left.title.localeCompare(right.title) || left.jobId.localeCompare(right.jobId))

  const extractedTitles = dedupedJobs.map((job) => job.title)
  if (
    dedupedJobs.length !== EXPECTED_JOB_TITLES.length
    || extractedTitles.some((title, index) => title !== EXPECTED_JOB_TITLES[index])
  ) {
    throw new Error('Paninian India verified open positions role set changed materially')
  }

  return dedupedJobs
}

const normalizeScrapedAt = (value) => {
  if (value instanceof Date) return value.toISOString()

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid now() value supplied to the Paninian India scraper')
  }

  return parsed.toISOString()
}

export const createPaninianIndiaScraper = ({ now = () => new Date() } = {}) => ({
  async run(options = {}) {
    const adapted = { ...options }
    // Preserve the historical structured HTML callback. It must still provide
    // its real status and final URL; a body-only callback is never admitted.
    if (options.fetchPage) adapted.fetchPage = async (url, init) => {
      const page = await options.fetchPage(url, init)
      if (typeof page?.html !== 'string') return page
      if (!Number.isInteger(page.status) || typeof page.url !== 'string') throw firstPartyFailure(SOURCE, 'Missing structured callback response metadata')
      return { ...page, body: page.html, headers: page.headers ?? { 'content-type': 'text/html' } }
    }
    const reader = createFirstPartyDocumentReader(adapted, { source: SOURCE, urls: [HOMEPAGE_URL, CAREERS_URL, OPEN_POSITIONS_URL] })
    const failure = message => firstPartyFailure(SOURCE, message)
    const read = async (url, closing = false) => {
      try { return (await reader.read(url)).body } catch (error) {
        if (closing && !options.signal?.aborted) throw failure('Closing reconciliation failed: ' + error.message)
        throw error
      }
    }
    const authority = (homepage, careers, closing = false) => {
      const prefix = closing ? 'Closing reconciliation: ' : ''
      if (!hasOfficialHomepageSignal(homepage) || !hasVerifiedCareersLink(homepage)) throw failure(prefix + 'verified official homepage changed')
      if (!hasOfficialCareersSignal(careers)) throw failure(prefix + 'verified careers landing page changed')
      if (!hasVerifiedOpenPositionsLink(careers)) throw failure(prefix + 'careers landing page no longer links to verified positions')
      if (extractApplyEmail(careers) !== SHARED_APPLY_EMAIL) throw failure(prefix + 'active recruiting handoff changed')
    }
    try {
      const homepage = await read(HOMEPAGE_URL), careers = await read(CAREERS_URL)
      authority(homepage, careers)
      const jobs = extractPublicJobs(await read(OPEN_POSITIONS_URL))
      const closingJobs = extractPublicJobs(await read(OPEN_POSITIONS_URL, true))
      if (JSON.stringify(jobs.map(job => job.nativeRoleRecord)) !== JSON.stringify(closingJobs.map(job => job.nativeRoleRecord))) {
        throw failure('Closing reconciliation changed native role criteria')
      }
      const closingCareers = await read(CAREERS_URL, true), closingHome = await read(HOMEPAGE_URL, true)
      authority(closingHome, closingCareers, true)
      const scrapedAt = normalizeScrapedAt((options.now || now)())
      const selected = options.maxJobs == null ? jobs : jobs.slice(0, options.maxJobs)
      if (options.maxJobs != null && (!Number.isSafeInteger(options.maxJobs) || options.maxJobs < 1)) throw RangeError('Invalid Paninian maxJobs')
      const output = selected.map(job => ({ ...job, company: COMPANY, source: SOURCE,
        link: job.applyUrl, scrapedAt, companyCareerPage: OPEN_POSITIONS_URL, companyDomain: COMPANY_DOMAIN,
        atsPlatform: 'official-company-careers', nativeRoleClosingReconciled: true }))
      Object.defineProperty(output, 'nativeCollectionEvidence', { value: {
        ...reader.stats(), nativeInventoryCount: jobs.length, nativeRoles: jobs.map(job => job.nativeRoleRecord),
        closingNativeRoles: closingJobs.map(job => job.nativeRoleRecord), nativeEmployerDisplayName: 'Paninian Aerospace',
        companyScopeComplete: false, lifecycleCleanupAllowed: false, activeEmailHandoffVerified: true,
        applicationSubmitted: false, legalEmployerQualified: false,
      }, configurable: true })
      return attachInventoryEvidence(output, { status: 'discovery-only', surface: OPEN_POSITIONS_URL,
        firstParty: true, listingComplete: false, lifecycleCleanupAllowed: false,
        pagesFetched: reader.stats().requests, reportedTotal: jobs.length, indiaFacetCount: jobs.length,
        verifiedAt: scrapedAt, reason: 'Current linked native grid and active recruiting mailto reconciled; company-wide inventory scope unproven' })
    } catch (error) {
      if (error && typeof error === 'object' && !options.signal?.aborted) error.nativeCollectionEvidence = reader.stats()
      throw error
    } finally { reader.close() }
  },
})

export const run = async (options = {}) => createPaninianIndiaScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
