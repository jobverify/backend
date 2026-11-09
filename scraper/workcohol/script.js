import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'workcohol'
export const COMPANY = 'Workcohol'
export const HOMEPAGE_URL = 'https://www.workcohol.com/'
export const CAREERS_URL = 'https://www.workcohol.com/page-career'
export const ABOUT_URL = 'https://www.workcohol.com/page-about'
export const CONTACT_URL = 'https://www.workcohol.com/page-contact'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const BLOCKED_TLS_PATTERNS = [
  /\bcertificate has expired\b/i,
  /\bcert_has_expired\b/i,
  /\berr_cert_date_invalid\b/i,
  /\berr_cert_common_name_invalid\b/i,
  /\berr_cert_authority_invalid\b/i,
  /hostname\/ip does not match certificate's altnames/i,
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&mdash;|Ã¢â‚¬â€œ|Ã¢â‚¬â€/g, '-')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? ''))
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const collectErrorMessages = (error) => {
  const messages = []
  const seen = new Set()
  let current = error

  while (current && !seen.has(current)) {
    seen.add(current)
    messages.push(String(current?.message ?? current ?? ''))
    current = current?.cause
  }

  return messages.filter(Boolean)
}

export const hasBlockedTlsFailure = (error) =>
  collectErrorMessages(error)
    .some((message) => BLOCKED_TLS_PATTERNS.some((pattern) => pattern.test(message)))

const extractFirst = (pattern, value) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? stripTags(match[1]) : null
}

const extractListItems = (heading, html) => {
  const match = new RegExp(`<h3[^>]*>\\s*${heading}\\s*<\\/h3>([\\s\\S]*?)(?:<h3|<h4|$)`, 'i').exec(html)
  if (!match) return []

  return [...match[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((item) => stripTags(item[1]))
    .filter(Boolean)
}

const normalizeLocation = (locationLabel) => {
  const normalized = normalizeWhitespace(locationLabel) || ''

  if (/mena region/i.test(normalized)) return null
  if (/chennai/i.test(normalized)) return 'Chennai, India'
  if (/remote/i.test(normalized)) return 'Remote'
  if (/india/i.test(normalized)) return 'India'

  return null
}

const getCity = (location) => {
  if (location === 'Remote') return 'Remote'
  if (location === 'India') return null
  const firstToken = normalizeWhitespace(String(location ?? '').replace(/,\s*India$/i, '').split(',')[0])
  return firstToken ? normalizeCity(firstToken) : null
}

export const hasOfficialHomepageSignal = (html) => {
  const normalized = stripTags(html) || ''

  return normalized.includes('Workcohol || Innovative Technology Solutions | Technology Service Provider Platform')
    && normalized.includes('Supercharge your Business with World-Class Technology.')
    && normalized.includes('Workcohol founded.')
    && normalized.includes('Workcohol created to focus your work easier and more efficient.')
    && /https:\/\/www\.workcohol\.com\/page-career/i.test(String(html ?? ''))
}

export const hasOfficialAboutSignal = (html) => {
  const normalized = stripTags(html) || ''

  return normalized.includes('Workcohol || About Us | Leading Technology Service Provider')
    && normalized.includes('Empowering businesses with innovative technology solutions.')
    && normalized.includes('Our mission is to make access to technology services seamless, transparent, and efficient.')
    && normalized.includes('We believe in simplifying complex technology challenges.')
}

export const hasOfficialContactSignal = (html) => {
  const normalized = stripTags(html) || ''

  return normalized.includes('Workcohol || Contact Us | Get in Touch with Our Technology Experts')
    && normalized.includes("Let's get in touch.")
    && normalized.includes('info@workcohol.com')
    && normalized.includes('Workcohol Solutions Private Limited')
    && normalized.includes('Chennai - 600113')
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = stripTags(html) || ''

  return normalized.includes('Workcohol || Careers | Join Our Innovative Technology Team')
    && normalized.includes('Current openings')
    && normalized.includes('Software Engineer')
    && normalized.includes('Client Acquisition Specialist')
    && /page-career-detail\/\d+/i.test(String(html ?? ''))
}

export const extractCareerCards = (html) => [...String(html ?? '').matchAll(
  /<h5[^>]*>\s*([^<]+?)\s*<\/h5>\s*<p[^>]*>\s*([^<]+?)\s*<\/p>\s*<a[^>]*href=["']([^"']*page-career-detail\/\d+)["'][^>]*>\s*Apply now\s*<\/a>/gi,
)]
  .map((match) => ({
    title: stripTags(match[1]),
    locationLabel: stripTags(match[2]),
    detailUrl: normalizeWhitespace(match[3]),
  }))
  .filter((job) => job.title && job.locationLabel && job.detailUrl)

const extractJobDetail = (html, { detailUrl, location }) => {
  const title = extractFirst(/<h1[^>]*>\s*([^<]+?)\s*<\/h1>/i, html)
  const experienceRequired = extractFirst(/Experience Level:\s*([^<]+?)\s*<\/p>/i, html)
  const employmentType = extractFirst(/Job Type:\s*([^<]+?)\s*<\/p>/i, html)
  const salary = extractFirst(/Salary:\s*([^<]+?)\s*<\/p>/i, html)
  const overview = extractFirst(/<h3[^>]*>\s*Overview:\s*<\/h3>\s*<p[^>]*>\s*([\s\S]*?)\s*<\/p>/i, html)

  if (!title || !experienceRequired || !overview) {
    throw new Error('Workcohol detail page no longer matches the verified public role surface')
  }

  return {
    title,
    company: COMPANY,
    location,
    city: getCity(location),
    country: 'India',
    experienceRequired,
    employmentType,
    salary,
    department: null,
    minimumQualification: null,
    preferredQualification: extractListItems('Preferred Qualifications:', html).join('; ') || null,
    requiredSkills: extractListItems('Required Skills & Qualifications:', html),
    jobDescription: overview,
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
  }
}

export const createWorkcoholScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const fetchVerifiedText = async (url) => {
      try {
        return await fetchText(url)
      } catch (error) {
        if (hasBlockedTlsFailure(error)) {
          return null
        }

        throw error
      }
    }

    const homepageHtml = await fetchVerifiedText(HOMEPAGE_URL)
    if (homepageHtml == null) {
      return []
    }

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Workcohol homepage no longer matches the verified official site')
    }

    const aboutHtml = await fetchVerifiedText(ABOUT_URL)
    if (aboutHtml == null) {
      return []
    }

    if (!hasOfficialAboutSignal(aboutHtml)) {
      throw new Error('Workcohol about page no longer matches the verified official site')
    }

    const contactHtml = await fetchVerifiedText(CONTACT_URL)
    if (contactHtml == null) {
      return []
    }

    if (!hasOfficialContactSignal(contactHtml)) {
      throw new Error('Workcohol contact page no longer matches the verified official site')
    }

    const careersHtml = await fetchVerifiedText(CAREERS_URL)
    if (careersHtml == null) {
      return []
    }

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Workcohol careers page no longer matches the verified official surface')
    }

    const openings = extractCareerCards(careersHtml)
    const jobs = []

    for (const opening of openings) {
      const normalizedLocation = normalizeLocation(opening.locationLabel)
      if (!normalizedLocation) {
        continue
      }

      const detailHtml = await fetchVerifiedText(opening.detailUrl)
      if (detailHtml == null) {
        return []
      }

      const detail = extractJobDetail(detailHtml, {
        detailUrl: opening.detailUrl,
        location: normalizedLocation,
      })

      const identitySlug = slugify(`${detail.title}-${normalizedLocation}`)

      jobs.push({
        ...detail,
        jobId: `${SOURCE}-${identitySlug}`,
        requisitionId: `${SOURCE}-${identitySlug}`,
        postingDate: null,
        closingDate: null,
        source: SOURCE,
        link: detail.applyUrl,
        scrapedAt: new Date().toISOString(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createWorkcoholScraper().run(options)

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
