import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'nyei'
export const COMPANY = 'NYEI'
export const HOMEPAGE_URL = 'https://www.ny-engineers.com/'
export const CAREERS_URL = 'https://www.ny-engineers.com/about/engineering-career-opportunities'
export const APPLY_URL = `${CAREERS_URL}#JobApply`

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const DEPARTMENT_LABELS = {
  mechanical: 'Mechanical',
  electricalandfirealarm: 'Electrical and Fire Alarm',
  plumbingandsprinkler: 'Plumbing and Sprinkler',
  other: 'Other',
}

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
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '').replace(/<[^>]+>/g, ' '),
)

const slugify = (...parts) => normalizeWhitespace(parts.filter(Boolean).join(' '))
  ?.toLowerCase()
  .replace(/['"]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const htmlToText = (value) => {
  const raw = String(value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/h4>/gi, ':\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<li>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/ul>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')

  const lines = decodeHtmlEntities(raw)
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  return lines.length > 0 ? lines.join('\n') : null
}

const normalizeDepartment = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  return DEPARTMENT_LABELS[normalized] || normalized
}

const extractCardsSection = (html) => {
  const page = String(html ?? '')
  const startMatch = page.match(/<div class="careerPage_tabs[^"]*">/i)
    || page.match(/<div class="faq-item\s+/i)
  const endMatch = page.match(/<div id="form-wrap"/i)

  if (!startMatch || !endMatch) {
    throw new Error('NYEI verified careers page no longer matches the verified public careers page')
  }

  const startIndex = startMatch.index ?? 0
  const endIndex = endMatch.index ?? page.length

  if (endIndex <= startIndex) {
    return page.slice(startIndex)
  }

  return page.slice(startIndex, endIndex)
}

const countMatches = (value, pattern) => [...String(value ?? '').matchAll(pattern)].length

const extractExperienceRequirement = (description) => {
  const text = String(description ?? '')
  const matchers = [
    /Experience:\s*([^\n.]+)/i,
    /(Minimum\s+\d+\+?\s+years?[^\n.]*)/i,
    /(\d+\+?\s+Years?\s+of\s+experience)/i,
  ]

  for (const matcher of matchers) {
    const match = text.match(matcher)
    if (match?.[1]) return normalizeWhitespace(match[1])
    if (match?.[0]) return normalizeWhitespace(match[0])
  }

  return null
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  const withoutCountry = normalized.replace(/,\s*India$/i, '')
  if (!withoutCountry || /\bor\b|\//i.test(withoutCountry)) return null

  return withoutCountry
}

const isIndiaLocation = (value) => /,\s*India$/i.test(normalizeWhitespace(value) || '')

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return (
    /<title>\s*MEP Engineering &amp; Design Consulting Firm \| BIM Services \| NY Engineers\s*<\/title>/i.test(page)
      || /<title>\s*MEP Consultant for Commercial Building Projects \| NY Engineers\s*<\/title>/i.test(page)
  )
    && /<a[^>]+href=["']https:\/\/www\.ny-engineers\.com\/about\/engineering-career-opportunities["'][^>]*>\s*Careers\s*<\/a>/i.test(page)
    && /info@ny-engineers\.com/i.test(text)
    && /NY Engineers/i.test(text)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Mechanical-Electrical-Plumbing Engineering Job Openings in Pune\s*<\/title>/i.test(page)
    && /<link rel="canonical" href="https:\/\/www\.ny-engineers\.com\/about\/engineering-career-opportunities">/i.test(page)
    && /Join Us\.\s*Add to a skyline\./i.test(text)
    && /module_Job_openings_NYEI\.min\.js/i.test(page)
    && /Location\s*:\s*Pune,\s*India/i.test(text)
    && /Apply Now/i.test(text)
}

export const extractOpenRoleCards = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('NYEI verified careers page no longer matches the verified public careers page')
  }

  const cardsSection = extractCardsSection(html)
  const rawCardCount = countMatches(cardsSection, /<div class="faq-item\s+/gi)
  const applyCount = countMatches(
    cardsSection,
    /<a\b[^>]*class=["'][^"']*\bJobApply\b[^"']*["'][^>]*href=["']#JobApply["'][^>]*>\s*Apply Now\s*<\/a>/gi,
  )

  const cards = [...cardsSection.matchAll(
    /<div class="faq-item\s+(?<department>[^"\s]+)">(?<block>[\s\S]*?)<a\b[^>]*class=["'][^"']*\bJobApply\b[^"']*["'][^>]*href=["']#JobApply["'][^>]*>\s*Apply Now\s*<\/a>/gi,
  )].map((match) => {
    const block = match.groups?.block || ''
    const title = stripTags(
      block.match(/<div class="fa_Title">[\s\S]*?<h4>([\s\S]*?)<\/h4>/i)?.[1] ?? null,
    )
    const location = stripTags(
      block.match(/<span class="job_location">\s*Location\s*:\s*([\s\S]*?)<\/span>/i)?.[1] ?? null,
    )
    const detailHtml = block.match(/<div class="faq_accordion_contentIn">([\s\S]*)$/i)?.[1] ?? null
    const jobDescription = htmlToText(detailHtml)

    if (!title || !location) {
      throw new Error('NYEI verified careers job cards changed shape')
    }

    return {
      title,
      department: normalizeDepartment(match.groups?.department),
      location,
      jobDescription,
      experienceRequired: extractExperienceRequirement(jobDescription),
    }
  })

  if (rawCardCount === 0 || cards.length === 0 || cards.length !== rawCardCount || applyCount !== rawCardCount) {
    throw new Error('NYEI verified careers job cards changed shape')
  }

  return cards
}

export const extractIndiaJobOpenings = (html) =>
  extractOpenRoleCards(html)
    .filter((card) => isIndiaLocation(card.location))
    .map((card) => {
      const jobId = slugify(SOURCE, card.title, card.location)

      return {
        title: card.title,
        company: COMPANY,
        department: card.department,
        location: card.location,
        city: extractCity(card.location),
        state: null,
        country: 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl: CAREERS_URL,
        applyUrl: APPLY_URL,
        employmentType: null,
        workplaceType: null,
        experienceRequired: card.experienceRequired,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: card.jobDescription,
      }
    })
    .sort((left, right) => left.title.localeCompare(right.title) || left.jobId.localeCompare(right.jobId))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createNyeiScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('NYEI verified official homepage no longer matches the trusted first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('NYEI verified careers page no longer matches the verified public careers page')
    }

    const jobs = extractIndiaJobOpenings(careersHtml)

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt: (overrideNow || now)(),
      companyCareerPage: CAREERS_URL,
      companyDomain: 'ny-engineers.com',
      atsPlatform: 'official-company-careers',
    }))
  },
})

export const run = async (options = {}) => createNyeiScraper().run(options)

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
