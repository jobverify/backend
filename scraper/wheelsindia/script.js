import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'wheelsindia'
export const COMPANY = 'Wheels India Limited'
export const HOMEPAGE_URL = 'https://wheelsindia.com/'
export const CAREERS_HUB_URL = 'https://wheelsindia.com/careers/'
export const OPENINGS_URL = 'https://wheelsindia.com/career-opportunities/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtml(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const toTitleCase = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/\b[a-z]/g, (char) => char.toUpperCase()) || null

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return /,\s*India$/i.test(normalized) ? normalized : `${normalized}, India`
}

const absoluteUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/^mailto:/i.test(normalized)) return normalized

  try {
    return new URL(normalized, OPENINGS_URL).toString()
  } catch {
    return null
  }
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const extractFieldValue = (sectionHtml, label) => normalizeWhitespace(
  sectionHtml.match(new RegExp(
    `<li\\b[^>]*>\\s*${escapeRegExp(label)}\\s*<\\/li>\\s*<li\\b[^>]*>([\\s\\S]*?)<\\/li>`,
    'i',
  ))?.[1],
)

const buildDescription = ({ location, postingDate }) => [
  `Company: ${COMPANY}`,
  `Location: ${location}`,
  `Posted: ${postingDate}`,
  'Apply via the first-party Wheels India career opportunities page.',
].join(' | ')

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  return /Wheels India Limited/i.test(page)
    && /href=["']https:\/\/wheelsindia\.com\/careers\/["']/i.test(page)
}

export const hasCareersHubSignal = (html) => {
  const page = String(html ?? '')
  return /<h1[^>]*>\s*Careers\s*<\/h1>/i.test(page)
    && /href=["']https:\/\/wheelsindia\.com\/career-opportunities\/["']/i.test(page)
    && /Career Opportunities/i.test(page)
}

export const hasOpeningsPageSignal = (html) => {
  const page = String(html ?? '')
  const applyCount = (page.match(/>\s*Apply Now\s*</gi) || []).length

  return /Career Opportunities/i.test(page)
    && /Location/i.test(page)
    && (/Date Posted/i.test(page) || /Posted on/i.test(page))
    && applyCount >= 1
}

export const extractOpenings = (html) => {
  if (!hasOpeningsPageSignal(html)) {
    throw new Error('Expected verified Wheels India openings page with first-party role cards')
  }

  const page = String(html ?? '')
  const cards = [...page.matchAll(
    /<div class="dealers">[\s\S]*?<span class="elementor-button-text">([\s\S]*?)<\/span>[\s\S]*?<span data-toggle="premium-modal" data-target="#(premium-modal-\d+)" class="premium-modal-trigger-text">\s*<h6 class="job-title">([\s\S]*?)<\/h6>[\s\S]*?<p class="job-exp">\s*<b>([\s\S]*?)<\/b><br>\s*Posted on\s*([\s\S]*?)<\/p>/gi,
  )]

  if (cards.length === 0) {
    throw new Error('Expected verified Wheels India openings page with first-party role cards')
  }

  return cards.map((match) => {
    const rawLocation = toTitleCase(match[1])
    const modalId = normalizeWhitespace(match[2])
    const title = stripTags(match[3])
    const experienceRequired = stripTags(match[4])
    const postingDate = normalizeWhitespace(match[5])
    const modalStart = modalId ? page.indexOf(`id="${modalId}"`) : -1
    const modalHtml = modalStart >= 0 ? page.slice(modalStart, modalStart + 8000) : ''
    const applyUrl = absoluteUrl(modalHtml.match(/<div class="applynow"><a href="([^"]+)"/i)?.[1])
    const description = stripTags(
      modalHtml.match(/<p class="job-heading"><b>Job Description<\/b><\/p>\s*<p>([\s\S]*?)<\/p>/i)?.[1],
    ) || buildDescription({ location: rawLocation, postingDate })
    const location = normalizeLocation(rawLocation)
    const city = normalizeCity(normalizeWhitespace(rawLocation)?.split(',')[0] || null)
    const slug = slugify(`${title}-${rawLocation}-${postingDate}`)

    if (!title || !rawLocation || !postingDate || !applyUrl || !/^mailto:/i.test(applyUrl) || !location || !slug) {
      throw new Error('Expected verified Wheels India openings page with first-party role cards')
    }

    const jobId = `${SOURCE}-${slug}`

    return {
      title,
      company: COMPANY,
      department: null,
      location,
      city,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: `${OPENINGS_URL}#${jobId}`,
      applyUrl,
      employmentType: null,
      experienceRequired: experienceRequired || null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate,
      closingDate: null,
      jobDescription: description,
    }
  }).sort((left, right) => (
    left.title.localeCompare(right.title)
    || left.location.localeCompare(right.location)
    || left.postingDate.localeCompare(right.postingDate)
  ))
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createWheelsIndiaScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Expected verified Wheels India homepage with first-party careers handoff')
    }

    const careersHubHtml = await fetchText(CAREERS_HUB_URL)
    if (!hasCareersHubSignal(careersHubHtml)) {
      throw new Error('Expected verified Wheels India careers hub with first-party openings handoff')
    }

    const openingsHtml = await fetchText(OPENINGS_URL)

    return extractOpenings(openingsHtml).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: (overrideNow || now)(),
    }))
  },
})

export const run = async (options = {}) => createWheelsIndiaScraper().run(options)

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
