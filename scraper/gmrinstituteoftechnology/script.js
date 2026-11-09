import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'gmrinstituteoftechnology'
export const COMPANY = 'GMR Institute of Technology'
export const HOMEPAGE_URL = 'https://gmrit.edu.in/'
export const CAREERS_URL = 'https://gmrit.edu.in/careers.php'
export const APPLY_URL = 'https://gmrit.edu.in/applynow.php'
export const APPLY_EMAIL = 'opportunities@gmrit.edu.in'

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

const stripTags = (value) => decodeHtml(value)
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const slugify = (value) => stripTags(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const removeHtmlComments = (html) => String(html ?? '').replace(/<!--[\s\S]*?-->/g, '')

const extractTableMarkup = (html) =>
  String(html ?? '').match(/<table\b[^>]*>([\s\S]*?)<\/table>/i)?.[0] || null

const extractRowCells = (rowHtml) => {
  const cells = []

  for (const match of String(rowHtml ?? '').matchAll(/<td\b[^>]*>([\s\S]*?)(?=<td\b|<\/tr>)/gi)) {
    cells.push(stripTags(match[1]))
  }

  return cells.filter(Boolean)
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return /GMRIT Deemed to be University \| Top Engineering College in Andhra Pradesh/i.test(page)
    && /Empowering Minds,\s*Shaping the Future/i.test(page)
    && /href="careers\.php"/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /Careers\s*@\s*GMRIT/i.test(page)
    && /opportunities@gmrit\.edu\.in/i.test(page)
    && /Current Vacancy/i.test(page)
    && /<th\b[^>]*>\s*DESIGNATION\s*<\/th>/i.test(page)
    && /<th\b[^>]*>\s*DEPARTMENT\s*<\/th>/i.test(page)
    && /<th\b[^>]*>\s*QUALIFICATION\s*<\/th>/i.test(page)
}

export const extractPublicListings = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('GMR Institute of Technology careers page no longer matches the verified vacancy table')
  }

  const activeHtml = removeHtmlComments(html)
  const tableHtml = extractTableMarkup(activeHtml)

  if (!tableHtml) {
    throw new Error('GMR Institute of Technology careers page no longer matches the verified vacancy table')
  }

  const jobs = []

  for (const rowMatch of tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const rowHtml = rowMatch[1]

    if (/<th\b/i.test(rowHtml)) continue

    const cells = extractRowCells(rowHtml)
    if (cells.length === 0) continue
    if (cells.length < 3) {
      throw new Error('GMR Institute of Technology careers page no longer matches the verified vacancy table')
    }

    const [title, department, qualification] = cells
    const applyHref = rowHtml.match(/<a\b[^>]*href="([^"]*applynow\.php[^"]*)"[^>]*>\s*Apply Now\s*<\/a>/i)?.[1]

    if (!title || !department || !qualification || !applyHref) {
      throw new Error('GMR Institute of Technology careers page no longer matches the verified vacancy table')
    }

    const identitySlug = slugify(`${title}-${department}`)
    if (!identitySlug) {
      throw new Error('GMR Institute of Technology careers page no longer matches the verified vacancy table')
    }

    jobs.push({
      title,
      company: COMPANY,
      department,
      location: 'Rajam, Andhra Pradesh, India',
      city: 'Rajam',
      country: 'India',
      jobId: `${SOURCE}-${identitySlug}`,
      requisitionId: `${SOURCE}-${identitySlug}`,
      sourceUrl: CAREERS_URL,
      applyUrl: new URL(applyHref, CAREERS_URL).toString(),
      employmentType: null,
      experienceRequired: null,
      minimumQualification: qualification,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: qualification,
      remoteStatus: 'On-site',
    })
  }

  return jobs
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createGmritScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('GMR Institute of Technology homepage no longer matches the verified careers handoff')
    }

    const careersHtml = await fetchText(CAREERS_URL)

    return extractPublicListings(careersHtml).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: (overrideNow || now)(),
    }))
  },
})

export const run = async (options = {}) => createGmritScraper().run(options)

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
