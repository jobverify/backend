import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'k12technoservicespvtltd'
export const COMPANY = 'K12 Techno Services Pvt. Ltd.'
export const HOMEPAGE_URL = 'https://www.orchidsinternationalschool.com/'
export const CAREERS_URL = 'https://www.orchidsinternationalschool.com/we-are-hiring'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const ROLE_TITLE_SUFFIX = 'Teacher'
const ROLE_ALIASES = new Map([
  ['Pre-Primary', 'Pre-Primary Teacher'],
  ['Primary', 'Primary Teacher'],
  ['Secondary', 'Secondary Teacher'],
  ['Arts & Computers', 'Arts & Computers Teacher'],
  ['Sports', 'Sports Teacher'],
])

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&ndash;|&#8211;/gi, '-')
  .replace(/&#174;/gi, 'Â®')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const buildMailtoUrl = (title) =>
  `mailto:careers@orchids.edu.in?subject=${encodeURIComponent(`Application \u2013 ${title} \u2013 [Your Name]`)}`

const extractRoleListItems = (html) => {
  const page = String(html ?? '')
  const currentRoleLabels = [...page.matchAll(
    /<span\b[^>]*class=["'][^"']*we-are-hiring_openRolesLabel[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi,
  )]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)

  if (currentRoleLabels.length > 0) {
    return currentRoleLabels
  }

  const rolesSection = page.match(
    /<h[1-6][^>]*>\s*Open Roles\s*<\/h[1-6]>([\s\S]*?)(?=<h[1-6][^>]*>\s*Campus Locations\s*<\/h[1-6]>)/i,
  )?.[1]

  return [...String(rolesSection ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)
}

const extractRoleOptions = (html) => {
  const selectHtml = String(html ?? '').match(
    /<label[^>]*>\s*Role applying for(?:\s*\*)?\s*<\/label>[\s\S]*?<select[^>]*>([\s\S]*?)<\/select>/i,
  )?.[1]

  return [...String(selectHtml ?? '').matchAll(/<option[^>]*>([\s\S]*?)<\/option>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter((option) => option && !/^select a role$/i.test(option))
}

const extractSingleParagraphAfterHeading = (html, heading) => {
  const pattern = new RegExp(
    `<h[1-6][^>]*>\\s*${escapeRegExp(heading)}\\s*<\\/h[1-6]>\\s*<p[^>]*>([\\s\\S]*?)<\\/p>`,
    'i',
  )

  return normalizeWhitespace(pattern.exec(String(html ?? ''))?.[1] || '')
}

const toRoleTitle = (roleLabel) => ROLE_ALIASES.get(roleLabel) || `${roleLabel} ${ROLE_TITLE_SUFFIX}`

const extractExperienceRequired = (summary) => normalizeWhitespace(summary).split('. ')[0].replace(/\.$/, '')

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<meta[^>]+property=["']og:site_name["'][^>]+content=["']ORCHIDS The International School["']/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.orchidsinternationalschool\.com\/["']/i.test(page)
    && /href=["'][^"']*\/we-are-hiring["']/i.test(page)
    && text.includes('ORCHIDS The International School')
    && text.includes('info@orchids.edu.in')
    && (
      (
        /Admissions 20\d{2}-\d{2}\b/.test(text)
        && text.includes("We're Hiring")
        && text.includes('Eduvate AI')
        && text.includes('Day & Boarding Schools')
      )
      || (
        text.includes('110+ campuses across India')
        && text.includes('Nurturing young minds since 1994')
      )
    )
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)
  const roleItems = extractRoleListItems(page)
  const roleOptions = extractRoleOptions(page)

  return /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.orchidsinternationalschool\.com\/we-are-hiring["']/i.test(page)
    && text.includes("Orchids is one of India's leading school networks.")
    && text.includes('Tap a role to email us')
    && text.includes('Apply for the campus nearest to you.')
    && text.includes('Freshers to 10+ years welcome.')
    && text.includes('Immediate openings available.')
    && text.includes('careers@orchids.edu.in')
    && text.includes('Online application form')
    && text.includes('Copyright @2026 | K12 Techno Services Pvt. Ltd.')
    && roleItems.length === 5
    && roleOptions.length === 5
}

export const extractPublicListings = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('K12 Techno Services Pvt. Ltd. verified first-party hiring page changed or disappeared')
  }

  const roleItems = extractRoleListItems(html)
  const roleOptions = extractRoleOptions(html)
  const joinedRoleItems = roleItems.join('|')
  const joinedRoleOptions = roleOptions.join('|')

  if (joinedRoleItems !== joinedRoleOptions) {
    throw new Error('K12 Techno Services Pvt. Ltd. verified first-party hiring page changed or disappeared')
  }

  const locationSummary = extractSingleParagraphAfterHeading(html, 'Campus Locations')
  const experienceSummary = extractSingleParagraphAfterHeading(html, 'Experience Required')
  const joiningTimeline = extractSingleParagraphAfterHeading(html, 'Joining Timeline')

  if (!locationSummary || !experienceSummary || !joiningTimeline) {
    throw new Error('K12 Techno Services Pvt. Ltd. verified first-party hiring page changed or disappeared')
  }

  return roleItems
    .map((roleLabel) => {
      const title = toRoleTitle(roleLabel)
      const slug = slugify(roleLabel)

      return {
        title,
        company: COMPANY,
        department: 'Teaching',
        location: 'India',
        city: null,
        country: 'India',
        jobId: `${SOURCE}-${slug}`,
        requisitionId: `${SOURCE}-${slug}`,
        sourceUrl: `${CAREERS_URL}#${slug}`,
        applyUrl: buildMailtoUrl(title),
        employmentType: null,
        experienceRequired: extractExperienceRequired(experienceSummary),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: [
          `Role category published on the official Orchids International School hiring page: ${roleLabel}.`,
          locationSummary,
          experienceSummary,
          joiningTimeline,
          'Applications are routed through the first-party Orchids hiring page and careers@orchids.edu.in.',
        ].join(' '),
      }
    })
    .sort((left, right) => left.title.localeCompare(right.title))
}

export const createK12TechnoServicesScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('K12 Techno Services Pvt. Ltd. verified official homepage no longer matches the known public surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    const jobs = extractPublicListings(careersHtml)

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: (overrideNow || now)(),
      companyCareerPage: CAREERS_URL,
      companyDomain: 'orchidsinternationalschool.com',
      atsPlatform: 'official-company-careers',
    }))
  },
})

export const run = async (options = {}) => createK12TechnoServicesScraper().run(options)

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
