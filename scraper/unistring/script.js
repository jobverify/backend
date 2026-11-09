import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'unistring'
export const COMPANY = 'Unistring Tech Solutions'
export const HOMEPAGE_URL = 'https://unistring.com/'
export const CAREERS_URL = 'https://unistring.com/career/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/â€“/g, '-')
  .replace(/â€”/g, '-')
  .replace(/â€˜|â€™/g, "'")
  .replace(/â€œ|â€�/g, '"')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8217;|&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const decodeHtml = (value) => normalizeWhitespace(String(value ?? ''))

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<title>\s*Unistring Tech Solutions\s*<\/title>/i.test(page)
    && normalized.includes('unistring tech solutions')
    && normalized.includes('empowering spectrum awareness')
    && normalized.includes('revolutionizing electronic warfare')
    && /href=["']https:\/\/unistring\.com\/career\/["']/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<title>\s*Career\s*(?:-|–|&#8211;|&ndash;)\s*Unistring Tech Solutions\s*<\/title>/i.test(page)
    && normalized.includes('life at uts')
    && normalized.includes('current openings')
    && normalized.includes('join us')
    && normalized.includes('take your career to a new level')
}

const extractCurrentOpeningsSection = (html) => {
  const page = String(html ?? '')
  const startMatch = /<h2[^>]*>\s*Current Openings\s*<\/h2>/i.exec(page)
  const endMatch = /<h2[^>]*>\s*Join Us\s*<\/h2>/i.exec(page)

  if (!startMatch || !endMatch || startMatch.index >= endMatch.index) {
    return null
  }

  return page.slice(startMatch.index + startMatch[0].length, endMatch.index)
}

const extractField = (html, label) => {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const blockMatch = String(html ?? '').match(new RegExp(
    `<span[^>]*>\\s*${escapedLabel}\\s*:\\s*([\\s\\S]*?)<\\/span>`,
    'i',
  ))

  if (blockMatch) {
    return decodeHtml(blockMatch[1])
  }

  const textMatch = String(html ?? '').match(new RegExp(`${escapedLabel}\\s*:\\s*([^<]+)`, 'i'))
  return decodeHtml(textMatch?.[1])
}

const extractApplyUrl = (html) => {
  const match = String(html ?? '').match(/<a[^>]+href=["']([^"']+)["'][^>]*>[\s\S]*?Apply Now[\s\S]*?<\/a>/i)
  return decodeHtml(match?.[1])
}

const extractDescription = (html) => {
  const matches = [...String(html ?? '').matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => decodeHtml(match[1]))
    .filter(Boolean)

  return matches.sort((left, right) => right.length - left.length)[0] || null
}

const extractJobCards = (sectionHtml) => {
  const titleMatches = [...String(sectionHtml ?? '').matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)]
  if (!titleMatches.length) {
    throw new Error('Unistring verified careers page job-card contract no longer contains opening titles')
  }

  return titleMatches.map((match, index) => {
    const title = decodeHtml(match[1])
    const start = match.index + match[0].length
    const end = index + 1 < titleMatches.length ? titleMatches[index + 1].index : sectionHtml.length
    const segment = sectionHtml.slice(start, end)

    const applyUrl = extractApplyUrl(segment)
    const experienceRequired = extractField(segment, 'Experience')
    const city = extractField(segment, 'Location')
    const jobDescription = extractDescription(segment)

    if (!title || !applyUrl || !experienceRequired || !city || !jobDescription) {
      throw new Error(`Unistring verified careers page job-card contract drifted for ${title || 'an opening'}`)
    }

    const jobId = slugify(title)
    const location = city === 'Remote' ? 'Remote, India' : `${city}, Telangana, India`

    return {
      title,
      company: COMPANY,
      department: null,
      location,
      city,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: CAREERS_URL,
      applyUrl,
      employmentType: null,
      experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription,
    }
  })
}

export const extractJobsFromCareersPage = (html) => {
  const currentOpeningsSection = extractCurrentOpeningsSection(html)
  if (!currentOpeningsSection) {
    throw new Error('Unistring verified careers page no longer exposes the trusted Current Openings section')
  }

  return extractJobCards(currentOpeningsSection)
    .sort((left, right) => left.title.localeCompare(right.title))
}

export const createUnistringScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Unistring verified official homepage no longer matches the trusted first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Unistring verified careers page no longer matches the trusted first-party surface')
    }

    const jobs = extractJobsFromCareersPage(careersHtml)

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createUnistringScraper().run(options)

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
