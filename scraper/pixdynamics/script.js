import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'pixdynamics'
export const COMPANY = 'PixDynamics'
export const HOMEPAGE_URL = 'https://pixdynamics.com/'
export const CAREERS_URL = 'https://pixdynamics.com/career'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const slugify = (...parts) => normalizeWhitespace(parts.filter(Boolean).join(' '))
  ?.toLowerCase()
  .replace(/['"]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const normalizeIndiaLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return /india/i.test(normalized) ? normalized : `${normalized}, India`
}

const splitLocationParts = (value) =>
  normalizeWhitespace(value)
    ?.replace(/,\s*India$/i, '')
    .split(',')
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean) || []

const extractCity = (value) => splitLocationParts(value)[0] || null

const extractState = (value) => splitLocationParts(value)[1] || null

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized.includes('internship')) return 'Internship'
  if (normalized.includes('full time') || normalized.includes('full-time')) return 'Full-time'
  if (normalized.includes('contract')) return 'Contract'
  return null
}

const normalizeExperienceRequired = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const exactMatch = normalized.match(/(\d+)\s*\+?\s*years?/i)
  if (exactMatch) return `${exactMatch[1]} years`

  const expMatch = normalized.match(/(\d+)\s*Years?\s*Exp/i)
  if (expMatch) return `${expMatch[1]} years`

  return null
}

const extractVisibleJobSection = (html) =>
  String(html ?? '').match(/<section[^>]+id=["']section1["'][^>]*>[\s\S]*?<\/section>/i)?.[0] || ''

const hasExplicitEmptyOpenings = (html) => {
  const visibleJobSection = extractVisibleJobSection(html)
  return /New Job Openings Will Be Added Soon/i.test(stripTags(visibleJobSection) || '')
    && !/class=["'][^"']*\bjob-card(?:\s|["'])/i.test(visibleJobSection)
}

const extractHeaderTags = (cardHtml) => {
  const tagsHtml = String(cardHtml ?? '').match(/<div class="d-flex flex-wrap gap_10">([\s\S]*?)<\/div>/i)?.[1] || ''

  return [...tagsHtml.matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)
}

const extractBodySections = (cardHtml) =>
  [...String(cardHtml ?? '').matchAll(/<h4\b[^>]*>([\s\S]*?)<\/h4>([\s\S]*?)(?=<h4\b|$)/gi)]
    .map((match) => ({
      heading: stripTags(match[1]),
      bodyHtml: match[2],
    }))
    .filter((section) => section.heading)

const extractApplyUrl = (html) =>
  String(html ?? '').match(/href=["'](mailto:[^"']+)["']/i)?.[1] || null

const extractRequiredSkills = (sectionBodyHtml) =>
  [...String(sectionBodyHtml ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)

const buildJobDescription = ({
  aboutRole,
  location,
  department,
  employmentType,
  experienceRequired,
}) => [
  aboutRole,
  department ? `Focus area: ${department}.` : null,
  location ? `Location: ${location}.` : null,
  employmentType ? `Type: ${employmentType}.` : null,
  experienceRequired ? `Experience: ${experienceRequired}.` : null,
  'Apply via the official PixDynamics career page or the listed HR email.',
]
  .filter(Boolean)
  .join(' ')

const getDepartmentFromTags = (tags = []) =>
  tags.find(
    (tag, index) =>
      index > 0
      && !/internship|full[\s-]?time|contract|years?\s*exp|preferred/i.test(tag),
  ) || null

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)?.toLowerCase() || ''

  return /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/pixdynamics\.com\/["']/i.test(page)
    && /"@type"\s*:\s*"Organization"/i.test(page)
    && /"name"\s*:\s*"PixDynamics Private Limited"/i.test(page)
    && /"alternateName"\s*:\s*"PixDynamics"/i.test(page)
    && normalized.includes('identity verification')
}

export const hasOfficialCareerPageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)?.toLowerCase() || ''
  const visibleJobSection = extractVisibleJobSection(page)

  return /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/pixdynamics\.com\/career["']/i.test(page)
    && /<meta[^>]+property=["']og:site_name["'][^>]+content=["']PixDynamics["']/i.test(page)
    && normalized.includes('join us at pixdynamics')
    && normalized.includes('job openings')
    && (/href=["']mailto:hr@pixl\.ai/i.test(visibleJobSection) || hasExplicitEmptyOpenings(page))
}

export const extractVisibleJobCards = (html) => {
  const visibleJobSection = extractVisibleJobSection(html)
  if (!visibleJobSection) return []

  return visibleJobSection
    .split(/<div class="job-card(?:\s|")[^>]*>/i)
    .slice(1)
    .map((cardHtml) => {
      const title = stripTags(
        cardHtml.match(/<h3\b[^>]*font_family4[^>]*>([\s\S]*?)<\/h3>/i)?.[1]
          ?? cardHtml.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1]
          ?? null,
      )
      const tags = extractHeaderTags(cardHtml)
      const sections = extractBodySections(cardHtml)
      const aboutRole = stripTags(
        sections.find((section) => /^about the role$/i.test(section.heading))
          ?.bodyHtml
          ?.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? null,
      )
      const requiredSkills = extractRequiredSkills(
        sections.find((section) => /^required skills(?:\s*&\s*qualifications)?$/i.test(section.heading))
          ?.bodyHtml,
      )
      const applyUrl = extractApplyUrl(
        sections.find((section) => /^how to apply$/i.test(section.heading))?.bodyHtml || cardHtml,
      )
      const location = normalizeIndiaLocation(tags[0] || null)
      const employmentType = normalizeEmploymentType(tags.find((tag) => /internship|full[\s-]?time|contract/i.test(tag)))
      const experienceRequired = normalizeExperienceRequired(
        tags.find((tag) => /\byears?\s*exp\b|\byears?\b/i.test(tag)),
      )
      const department = getDepartmentFromTags(tags)

      if (!title || !location || !applyUrl) return null

      return {
        title,
        department,
        location,
        city: extractCity(location),
        state: extractState(location),
        country: 'India',
        employmentType,
        experienceRequired,
        requiredSkills,
        aboutRole,
        applyUrl,
      }
    })
    .filter(Boolean)
}

export const extractIndiaJobOpenings = (html) =>
  extractVisibleJobCards(html).map((card) => {
    const locationSlug = splitLocationParts(card.location).join(' ')
    const requisitionId = slugify(SOURCE, card.title, locationSlug)

    return {
      title: card.title,
      company: COMPANY,
      department: card.department,
      location: card.location,
      city: card.city,
      state: card.state,
      country: 'India',
      jobId: requisitionId,
      requisitionId,
      sourceUrl: CAREERS_URL,
      applyUrl: card.applyUrl,
      employmentType: card.employmentType,
      experienceRequired: card.experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: card.requiredSkills,
      postingDate: null,
      closingDate: null,
      jobDescription: buildJobDescription({
        aboutRole: card.aboutRole,
        location: card.location,
        department: card.department,
        employmentType: card.employmentType,
        experienceRequired: card.experienceRequired,
      }),
    }
  })

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createPixdynamicsScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('PixDynamics verified official homepage no longer matches the trusted first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareerPageSignal(careersHtml)) {
      throw new Error('PixDynamics verified public career page no longer matches the trusted first-party surface')
    }

    const jobs = extractIndiaJobOpenings(careersHtml)
    if (jobs.length === 0 && !hasExplicitEmptyOpenings(careersHtml)) {
      throw new Error('PixDynamics visible public job cards are no longer exposed on the verified career page')
    }

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: CAREERS_URL,
      companyCareerPage: CAREERS_URL,
      companyDomain: 'pixdynamics.com',
      atsPlatform: 'official-company-careers',
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createPixdynamicsScraper().run(options)

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
