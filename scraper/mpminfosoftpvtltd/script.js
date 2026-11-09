import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'mpminfosoftpvtltd'
export const COMPANY = 'MPM Infosoft Pvt. Ltd.'
export const VERIFIED_AT = '2026-07-13'
export const HOMEPAGE_URL = 'https://www.mpminfosoft.com/'
export const CAREERS_URL = 'https://www.mpminfosoft.com/careers'
export const CONTACT_URL = 'https://www.mpminfosoft.com/contactus'
export const APPLY_EMAIL = 'info@sandman.co.in'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, '-')
    .replace(/&mdash;|&#8212;/gi, '-')
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

const stripTags = (value) => normalizeWhitespace(value)

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const slugify = (value) =>
  String(value ?? '')
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

const parseDate = (value) => {
  const normalized = stripTags(value)
  const match = /([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/.exec(normalized)
  if (!match) return null

  const monthIndex = new Date(`${match[1]} 1, 2000 UTC`).getUTCMonth()
  if (!Number.isInteger(monthIndex)) return null

  const year = match[3]
  const month = String(monthIndex + 1).padStart(2, '0')
  const day = String(Number(match[2])).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const extractLabeledValue = (html, label) => {
  const pattern = new RegExp(
    `<h5[^>]*>\\s*${escapeRegExp(label)}\\s*<\\/h5>\\s*(?:<[^>]+>\\s*)*<p[^>]*>([\\s\\S]*?)<\\/p>`,
    'i',
  )
  const match = pattern.exec(String(html ?? ''))
  return match ? stripTags(match[1]) : null
}

const extractLabeledParagraphBlock = (html, label) => {
  const pattern = new RegExp(
    `<h5[^>]*>\\s*${escapeRegExp(label)}\\s*<\\/h5>([\\s\\S]*?)(?:<hr\\b|<h5\\b|<p class="fs-5 text-black")`,
    'i',
  )
  const match = pattern.exec(String(html ?? ''))
  if (!match) return null

  const paragraphs = [...match[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((entry) => stripTags(entry[1]))
    .filter(Boolean)

  return paragraphs.length ? paragraphs.join(' ') : null
}

const extractSkills = (html) => {
  const match = /<h5[^>]*>\s*Key Skills\s*<\/h5>\s*<ul[^>]*>([\s\S]*?)<\/ul>/i.exec(String(html ?? ''))
  if (!match) return []

  return [...match[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((entry) => stripTags(entry[1]))
    .filter(Boolean)
}

const extractApplyEmail = (html) => {
  const match = /href=["']mailto:([^"']+)["']/i.exec(String(html ?? ''))
  return match ? match[1].trim() : APPLY_EMAIL
}

export const hasOfficialHomepageSignal = (html) => {
  const raw = String(html ?? '')
  const normalized = normalizeWhitespace(raw)

  return /<title>\s*MPM Infosoft - Green Sand Molding Process \| Sand Analytics Process \| Sand Analysis\s*<\/title>/i.test(raw)
    && /href=["']\/careers["']/i.test(raw)
    && /href=["']\/contactus["']/i.test(raw)
    && /linkedin\.com\/company\/mpm-infosoft-private-limited/i.test(raw)
    && /All Rights Reserved by MPM Infosoft/i.test(normalized)
}

export const hasOfficialContactSignal = (html) => {
  const raw = String(html ?? '')
  const normalized = normalizeWhitespace(raw)

  return /<title>\s*Contact Us - Green Sand Molding Process \| Sand Analytics Process \| Sand Analysis \| MPM Infosoft\s*<\/title>/i.test(raw)
    && normalized.includes('MPM Infosoft Private Limited., A6/3, Phase II, 6th Floor, IIT Madras Research Park, Kanagam Road, Taramani, Chennai - 600113, India.')
    && normalized.includes('MPM Infosoft Pvt. Ltd., M-22 M.I.D.C., Hingna Industrial Estate, Nagpur - 440016, Maharashtra, India.')
    && normalized.includes('+91 44 49597202')
    && normalized.includes(APPLY_EMAIL)
}

export const hasOfficialCareersSignal = (html) => {
  const raw = String(html ?? '')
  const normalized = normalizeWhitespace(raw)

  return /<title>\s*Career - Green Sand Molding Process \| Sand Analytics Process \| Sand Analysis\s*<\/title>/i.test(raw)
    && normalized.includes('JOB OPENINGS')
  }

export const extractJobCards = (html) => {
  const matches = [...String(html ?? '').matchAll(
    /<div class="item[\s\S]*?<h4>([\s\S]*?)<\/h4>[\s\S]*?<p>([\s\S]*?)<\/p>[\s\S]*?<p class="mt-3">([\s\S]*?)<\/p>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>\s*Learn more/gi,
  )]

  return matches.map((match) => ({
    title: stripTags(match[1]),
    detailUrl: new URL(match[4], HOMEPAGE_URL).toString(),
    location: stripTags(match[3]).replace(/^Job Location\s*:\s*/i, '').trim(),
    summary: stripTags(match[2]),
  }))
}

export const extractJobDetail = (html, detailUrl, summaryFallback, titleFallback) => {
  const title = titleFallback
    || extractLabeledValue(html, 'Role')
    || stripTags(/<h3[^>]*>([\s\S]*?)<\/h3>/i.exec(String(html ?? ''))?.[1] ?? '')
  const location = extractLabeledValue(html, 'City')
  const [city = null, country = null] = String(location ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  const skills = extractSkills(html)
  const applyEmail = extractApplyEmail(html)

  return {
    title,
    company: COMPANY,
    location,
    city,
    country,
    jobId: `${SOURCE}-${slugify(title)}`,
    requisitionId: `${SOURCE}-${slugify(title)}`,
    source: SOURCE,
    sourceUrl: detailUrl,
    link: detailUrl,
    applyUrl: `mailto:${applyEmail}`,
    postingDate: parseDate(extractLabeledValue(html, 'Job Post Date')),
    closingDate: null,
    employmentType: null,
    department: null,
    experienceRequired: extractLabeledValue(html, 'Experience'),
    minimumQualification: extractLabeledValue(html, 'Min. Qualification'),
    preferredQualification: null,
    requiredSkills: skills,
    jobDescription: extractLabeledParagraphBlock(html, 'Job Description') || summaryFallback,
    scrapedAt: new Date().toISOString(),
  }
}

export const createMpmInfosoftPvtLtdScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('MPM Infosoft verified homepage no longer matches the expected first-party surface')
    }

    const contactHtml = await fetchText(CONTACT_URL)
    if (!hasOfficialContactSignal(contactHtml)) {
      throw new Error('MPM Infosoft verified contact page no longer matches the expected first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('MPM Infosoft verified careers page no longer matches the expected first-party surface')
    }

    const cards = extractJobCards(careersHtml)
    if (cards.length === 0) {
      throw new Error('MPM Infosoft verified careers page no longer exposes the expected job cards')
    }

    const jobs = []
    for (const card of cards) {
      const detailHtml = await fetchText(card.detailUrl)
      jobs.push(extractJobDetail(detailHtml, card.detailUrl, card.summary, card.title))
    }

    return jobs
  },
})

export const run = async (options = {}) => createMpmInfosoftPvtLtdScraper().run(options)

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
