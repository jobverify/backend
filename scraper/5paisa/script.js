import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = '5paisa'
export const COMPANY = '5paisa'
export const VERIFIED_AT = '2026-07-14'
export const CAREERS_URL = 'https://www.5paisa.com/careers'
export const APPLICATION_CONTACT_EMAIL = 'hrteam@5paisa.com'

export const PROVIDER_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  adapter: 'script',
  modulePath: '../../scraper/5paisa/script.js',
  companyCareerPage: CAREERS_URL,
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-current-vacancies-page-plus-first-party-detail-pages',
  extractionStrategy:
    'verified-first-party-current-vacancies-list+india-role-filter+detail-pages+same-page-application-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: '5paisa.com',
  verifiedOn: VERIFIED_AT,
  verifiedSurfaceSummary:
    'Verified https://www.5paisa.com/careers exposes a first-party Current vacancies block for India roles, and each vacancy links to a first-party /careers/job-* detail page with role content plus an embedded application form.',
  dryRunFile: '5paisa/jobs.json',
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const LOCATION_DETAILS = {
  mumbai: {
    city: 'Mumbai',
    country: 'India',
    location: 'Mumbai, Maharashtra, India',
  },
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const absoluteUrl = (value, baseUrl = CAREERS_URL) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const extractAll = (pattern, value, transform = (match) => match[1]) => [...String(value ?? '').matchAll(pattern)]
  .map((match) => transform(match))
  .filter((item) => item != null)

const stripTagsToText = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(li|p|div|ul|ol|h[1-6])>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeHeadingKey = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[:\s]+$/g, '')
  || null

const normalizeLocationLabel = (value) => normalizeWhitespace(value)?.toLowerCase() || null

export const isIndiaLocationLabel = (value) => {
  const normalized = normalizeLocationLabel(value)
  if (!normalized) return false

  return normalized.includes('india') || Object.hasOwn(LOCATION_DETAILS, normalized)
}

const getLocationDetails = (value) => {
  const normalized = normalizeLocationLabel(value)
  if (!normalized) return null

  if (Object.hasOwn(LOCATION_DETAILS, normalized)) {
    return LOCATION_DETAILS[normalized]
  }

  if (!normalized.includes('india')) {
    return null
  }

  const location = normalizeWhitespace(value)
  const city = normalizeWhitespace(location?.split(',')[0])

  return {
    city,
    country: 'India',
    location,
  }
}

const getCurrentVacanciesSection = (html) => extractFirst(
  /<section\b[^>]*id=["']block-views-block-current-vacancies-block-1["'][^>]*>([\s\S]*?)<\/section>/i,
  html,
)

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const currentVacanciesSection = getCurrentVacanciesSection(page)

  return /<title>\s*Careers\s*\|\s*5paisa\s*<\/title>/i.test(page)
    && /<h1>\s*Careers At 5paisa\s*<\/h1>/i.test(page)
    && /<h2>\s*Current vacancies\s*<\/h2>/i.test(page)
    && /apply through Workable/i.test(page)
    && /\/careers\/job-\d+/i.test(currentVacanciesSection || '')
}

const parseVacancyCard = (cardHtml) => {
  const title = stripTagsToText(extractFirst(
    /<li>\s*<span>\s*Postion\s*<\/span>\s*([\s\S]*?)<\/li>/i,
    cardHtml,
  ))
  const department = stripTagsToText(extractFirst(
    /<li>\s*<span>\s*Department\s*<\/span>\s*([\s\S]*?)<\/li>/i,
    cardHtml,
  ))
  const locationLabel = stripTagsToText(extractFirst(
    /<li>\s*<span>\s*Location\s*<\/span>\s*([\s\S]*?)<\/li>/i,
    cardHtml,
  ))
  const experienceRequired = stripTagsToText(extractFirst(
    /<li>\s*<span>\s*Experience\s*<\/span>\s*([\s\S]*?)<\/li>/i,
    cardHtml,
  ))
  const employmentType = stripTagsToText(extractFirst(
    /<li>\s*<span>\s*Work Type\s*<\/span>\s*([\s\S]*?)<\/li>/i,
    cardHtml,
  ))
  const detailHref = normalizeWhitespace(extractFirst(
    /<a\b[^>]*href=["']([^"']*\/careers\/job-\d+)["'][^>]*>/i,
    cardHtml,
  ))
  const sourceUrl = absoluteUrl(detailHref)
  const locationDetails = getLocationDetails(locationLabel)
  const jobId = normalizeWhitespace(extractFirst(/\/careers\/(job-\d+)/i, sourceUrl))

  if (!title || !sourceUrl || !jobId || !locationDetails) {
    return null
  }

  return {
    jobId,
    requisitionId: jobId,
    title,
    department: department || null,
    location: locationDetails.location,
    city: locationDetails.city,
    country: locationDetails.country,
    experienceRequired,
    employmentType,
    sourceUrl,
  }
}

export const extractCurrentVacancyListings = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('5paisa verified first-party careers page no longer matches the trusted current vacancies surface')
  }

  const currentVacanciesSection = getCurrentVacanciesSection(html)
  const cards = extractAll(/<ul>([\s\S]*?)<\/ul>/gi, currentVacanciesSection)
    .map(parseVacancyCard)
    .filter((card) => card && isIndiaLocationLabel(card.location))

  if (cards.length === 0) {
    throw new Error('5paisa verified current vacancies block no longer exposes India job cards')
  }

  return cards
}

const extractDetailFields = (html) => {
  const fieldsHtml = extractFirst(/<ul class=["']titles_req_post["']>([\s\S]*?)<\/ul>/i, html)
  const fields = new Map()

  for (const match of String(fieldsHtml ?? '').matchAll(/<li>\s*<span>\s*([^:<>]+?)\s*:\s*<\/span>\s*([\s\S]*?)<\/li>/gi)) {
    const key = normalizeHeadingKey(match[1])
    if (!key) continue

    fields.set(key, stripTagsToText(match[2]))
  }

  return fields
}

const extractDetailSections = (html) => [...String(html ?? '').matchAll(
  /<div class=["'][^"']*\bdesc_box\b[^"']*["'][^>]*>\s*<h3>([\s\S]*?)<\/h3>\s*([\s\S]*?)<\/div>/gi,
)].reduce((sections, match) => {
  const rawHeading = normalizeWhitespace(match[1])
  const key = normalizeHeadingKey(rawHeading)
  if (!key) return sections

  sections.set(key, {
    heading: rawHeading?.replace(/:$/, '') || rawHeading,
    html: match[2],
    text: stripTagsToText(match[2]),
    bullets: extractAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, match[2], (item) => stripTagsToText(item[1])),
  })

  return sections
}, new Map())

const resolveMinimumQualification = (section) => {
  if (!section || section.bullets.length !== 1) return null

  return /^minimum\b/i.test(section.bullets[0]) ? section.bullets[0] : null
}

const uniqueStrings = (values) => {
  const seen = new Set()
  const output = []

  for (const value of values) {
    const normalized = normalizeWhitespace(value)
    if (!normalized || seen.has(normalized)) continue

    seen.add(normalized)
    output.push(normalized)
  }

  return output
}

const buildJobDescription = ({ descriptionSection, rolesSection, extraSkillSections, applyEmail }) => {
  const lines = []

  if (descriptionSection?.text) {
    lines.push('Job Description')
    lines.push(descriptionSection.text)
  }

  if (rolesSection?.bullets?.length) {
    if (lines.length) lines.push('')
    lines.push('Roles & Responsibilities')
    for (const bullet of rolesSection.bullets) {
      lines.push(`- ${bullet}`)
    }
  }

  for (const section of extraSkillSections) {
    if (!section?.bullets?.length) continue

    if (lines.length) lines.push('')
    lines.push(section.heading)
    for (const bullet of section.bullets) {
      lines.push(`- ${bullet}`)
    }
  }

  if (lines.length) lines.push('')
  lines.push(`Apply via the first-party 5paisa job page or email ${applyEmail}.`)

  return lines.join('\n')
}

export const hasOfficialJobDetailSignal = (html, listing = {}) => {
  const page = String(html ?? '')
  const expectedPath = listing.sourceUrl ? new URL(listing.sourceUrl).pathname : '/careers/job-'

  return /<title>[\s\S]*?\|\s*5paisa\s*<\/title>/i.test(page)
    && /<ul class=["']titles_req_post["']>/i.test(page)
    && /<h3>\s*Job Description\s*<\/h3>/i.test(page)
    && /<h3>\s*Apply for this Job\s*<\/h3>/i.test(page)
    && /Attach Resume\/CV/i.test(page)
    && new RegExp(`action=["']${escapeRegExp(expectedPath)}["']`, 'i').test(page)
}

export const extractJobDetail = (html, listing) => {
  if (!hasOfficialJobDetailSignal(html, listing)) {
    throw new Error('5paisa verified first-party job detail no longer matches the trusted application surface')
  }

  const fields = extractDetailFields(html)
  const sections = extractDetailSections(html)
  const title = stripTagsToText(extractFirst(/<h1>\s*([\s\S]*?)\s*<\/h1>/i, html)) || listing.title
  const locationDetails = getLocationDetails(fields.get('location') || listing.city || listing.location)
  const qualificationsSection = sections.get('qualifications') || sections.get('qualification')
  const requirementsSection = sections.get('requirement') || sections.get('requirements')
  const minimumQualification = resolveMinimumQualification(qualificationsSection)
  const skillSections = []

  if (qualificationsSection?.bullets?.length && !minimumQualification) {
    skillSections.push(qualificationsSection)
  }

  if (requirementsSection?.bullets?.length) {
    skillSections.push(requirementsSection)
  }

  const requiredSkills = uniqueStrings(
    skillSections.flatMap((section) => section.bullets),
  )
  const applyEmail = normalizeWhitespace(extractFirst(
    /mailto:([^"']+@5paisa\.com)/i,
    html,
  )) || APPLICATION_CONTACT_EMAIL

  return {
    jobId: listing.jobId,
    requisitionId: listing.requisitionId,
    title,
    company: COMPANY,
    department: fields.get('department') || listing.department || null,
    location: locationDetails?.location || listing.location,
    city: locationDetails?.city || listing.city || null,
    country: locationDetails?.country || listing.country || 'India',
    sourceUrl: listing.sourceUrl,
    applyUrl: listing.sourceUrl,
    employmentType: fields.get('work type') || listing.employmentType || null,
    experienceRequired: fields.get('experience') || listing.experienceRequired || null,
    minimumQualification,
    preferredQualification: null,
    requiredSkills,
    postingDate: null,
    closingDate: null,
    jobDescription: buildJobDescription({
      descriptionSection: sections.get('job description'),
      rolesSection: sections.get('roles & responsibilities'),
      extraSkillSections: skillSections,
      applyEmail,
    }),
  }
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const isTrustedFivePaisaUrl = (value) => {
  try {
    const url = new URL(value)
    return url.origin === 'https://www.5paisa.com'
  } catch {
    return false
  }
}

export const createFivePaisaScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const careersPage = await fetchPage(CAREERS_URL)

    if (!isTrustedFivePaisaUrl(careersPage.url) || new URL(careersPage.url).pathname !== '/careers') {
      throw new Error('5paisa verified first-party careers page redirected away from the trusted careers route')
    }

    const listings = extractCurrentVacancyListings(careersPage.html)
    const limitedListings = maxJobs ? listings.slice(0, maxJobs) : listings
    const jobs = []

    for (const listing of limitedListings) {
      const detailPage = await fetchPage(listing.sourceUrl)

      if (!isTrustedFivePaisaUrl(detailPage.url) || new URL(detailPage.url).pathname !== new URL(listing.sourceUrl).pathname) {
        throw new Error('5paisa verified first-party job detail redirected away from the trusted detail route')
      }

      if (!hasOfficialJobDetailSignal(detailPage.html, listing)) {
        throw new Error('5paisa verified first-party job detail no longer matches the trusted application surface')
      }

      const job = extractJobDetail(detailPage.html, listing)
      jobs.push({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createFivePaisaScraper().run(options)

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

