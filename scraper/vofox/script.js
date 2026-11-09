import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'vofox'
export const COMPANY = 'Vofox Solutions Pvt Ltd'
export const HOMEPAGE_URL = 'https://vofoxsolutions.com/'
export const ABOUT_URL = 'https://vofoxsolutions.com/about-us'
export const CONTACT_URL = 'https://vofoxsolutions.com/contact-us'
export const CAREERS_URL = 'https://vofoxsolutions.com/career-at-vofox'
export const APPLY_URL = 'https://vofoxsolutions.com/career-at-vofox'

const LOCATION = 'Kochi, Kerala, India'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

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

const city = normalizeCity('Kochi')

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const extractFirst = (pattern, value) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? stripTags(match[1]) : null
}

const extractListBlock = (label, sectionHtml) => {
  const match = new RegExp(`${label}[\\s\\S]*?(?:<p[^>]*>[\\s\\S]*?<\\/p>)+`, 'i').exec(sectionHtml)
  if (!match) return []

  return [...match[0].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((item) => stripTags(item[1]))
    .filter(Boolean)
}

export const hasOfficialHomepageSignal = (html) => {
  const normalized = stripTags(html) || ''

  return (
    normalized.includes('Software development company in India | Vofox Solution')
    || normalized.includes('Vofox Solutions | Software development company')
  )
    && normalized.includes('Offshore Development Company in India')
    && /href=["'](?:https?:\/\/vofoxsolutions\.com)?\/career-at-vofox\/?["']/i.test(String(html ?? ''))
}

export const hasOfficialAboutSignal = (html) => {
  const normalized = stripTags(html) || ''

  return normalized.includes('About Us | Vofox Solutions')
    && /Headquartered in Dallas, Texas/i.test(normalized)
    && /\b4 offices\b/i.test(normalized)
    && /spring of 2005/i.test(normalized)
    && /\bKochi\b/i.test(normalized)
}

export const hasOfficialContactSignal = (html) => {
  const normalized = stripTags(html) || ''

  return normalized.includes('Contact Us | Vofox Solutions - Best Offshore Software Development Services')
    && normalized.includes("Let's Talk Business!")
    && normalized.includes('Vofox Square')
    && /href=["'](?:https?:\/\/vofoxsolutions\.com)?\/career-at-vofox\/?["']/i.test(String(html ?? ''))
}

const extractTextLines = (value) =>
  decodeHtmlEntities(String(value ?? ''))
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .split(/\n+/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)

const extractAccordionJobCards = (html) => {
  const blocks = [...String(html ?? '').matchAll(
    /<div class="accordion-item\b[\s\S]*?(?=<div class="accordion-item\b|<div class="employee-engagements\b|<div class="career-timeline\b|<div class="career-getintouch\b|<div class="career-hiring-process\b|$)/gi,
  )]

  const jobs = []
  const seen = new Set()

  for (const [blockHtml] of blocks) {
    const title = extractFirst(/<span[^>]*>\s*Job Title\s*<\/span>[\s\S]*?<h5[^>]*>\s*([\s\S]*?)\s*<\/h5>/i, blockHtml)
    const experienceRequired = extractFirst(
      /<span[^>]*>\s*Experience\s*<\/span>[\s\S]*?<h5[^>]*>\s*:?\s*([\s\S]*?)\s*<\/h5>/i,
      blockHtml,
    )
    const salary = extractFirst(/<span[^>]*>\s*Salary\s*<\/span>[\s\S]*?<h5[^>]*>\s*([\s\S]*?)\s*<\/h5>/i, blockHtml)
    const description = extractFirst(/<h4[^>]*>\s*Description\s*<\/h4>[\s\S]*?<p[^>]*>\s*([\s\S]*?)\s*<\/p>/i, blockHtml)
    const skillsMatch = /<h4[^>]*>\s*Skills Required\s*<\/h4>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i.exec(blockHtml)
    const requiredSkills = extractTextLines(skillsMatch?.[1])

    if (!title) continue

    const dedupeKey = `${title}::${experienceRequired ?? ''}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    jobs.push({
      title,
      company: COMPANY,
      location: LOCATION,
      city,
      country: 'India',
      experienceRequired,
      employmentType: null,
      openingCount: null,
      requiredSkills,
      jobDescription: description,
      minimumQualification: null,
      preferredQualification: null,
      sourceUrl: CAREERS_URL,
      applyUrl: APPLY_URL,
      salary,
    })
  }

  return jobs
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = stripTags(html) || ''

  return normalized.includes('Career at Vofox | Vofox Solutions')
    && normalized.includes('Current Openings')
    && normalized.includes('Apply Now For The Position Of')
    && normalized.includes('Attach latest resume')
    && normalized.includes('Only PDF & DOCX files are allowed.')
    && normalized.includes('Vofox Solutions Pvt Ltd, Vofox Square, VIP Road')
}

export const extractJobCards = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Vofox careers page no longer matches the verified official public surface')
  }

  const sections = [...String(html ?? '').matchAll(
    /<section\b[^>]*class=["'][^"']*job-card[^"']*["'][^>]*>([\s\S]*?)<\/section>/gi,
  )]

  const jobs = []
  const seen = new Set()

  for (const [, sectionHtml] of sections) {
    const title = extractFirst(/<h5[^>]*>\s*([^<]+?)\s*<\/h5>/i, sectionHtml)
    const experienceRequired = extractFirst(
      /Experience[\s\S]*?<h5[^>]*>\s*:?\s*([^<]+?)\s*<\/h5>/i,
      sectionHtml,
    )
    const employmentType = extractFirst(/Employment Type[\s\S]*?<p[^>]*>\s*([^<]+?)\s*<\/p>/i, sectionHtml)
    const openingCountText = extractFirst(/No\.\s*Of\s*Positions[\s\S]*?<p[^>]*>\s*(\d+)\s*<\/p>/i, sectionHtml)
    const description = extractFirst(/Description[\s\S]*?<p[^>]*>\s*([\s\S]*?)\s*<\/p>/i, sectionHtml)
    const skills = extractListBlock('Skills Required', sectionHtml)

    if (!title) continue

    const dedupeKey = `${title}::${experienceRequired}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    jobs.push({
      title,
      company: COMPANY,
      location: LOCATION,
      city,
      country: 'India',
      experienceRequired,
      employmentType,
      openingCount: openingCountText ? Number.parseInt(openingCountText, 10) : null,
      requiredSkills: skills,
      jobDescription: description,
      minimumQualification: null,
      preferredQualification: null,
      sourceUrl: CAREERS_URL,
      applyUrl: APPLY_URL,
      salary: extractFirst(/Salary[\s\S]*?<h5[^>]*>\s*([^<]+?)\s*<\/h5>/i, sectionHtml),
    })
  }

  if (jobs.length === 0) {
    jobs.push(...extractAccordionJobCards(html))
  }

  if (jobs.length === 0) {
    throw new Error('Vofox verified public openings changed or disappeared')
  }

  return jobs
}

export const createVofoxScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Vofox homepage no longer matches the verified official site')
    }

    const aboutHtml = await fetchText(ABOUT_URL)
    if (!hasOfficialAboutSignal(aboutHtml)) {
      throw new Error('Vofox about page no longer matches the verified official site')
    }

    const contactHtml = await fetchText(CONTACT_URL)
    if (!hasOfficialContactSignal(contactHtml)) {
      throw new Error('Vofox contact page no longer matches the verified official site')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Vofox careers page no longer matches the verified official surface')
    }

    return extractJobCards(careersHtml).map((job) => {
      const identitySlug = slugify(`${job.title}-${job.location}-${job.experienceRequired ?? 'unknown'}`)

      return {
        ...job,
        jobId: `${SOURCE}-${identitySlug}`,
        requisitionId: `${SOURCE}-${identitySlug}`,
        postingDate: null,
        closingDate: null,
        source: SOURCE,
        link: job.applyUrl,
        scrapedAt: new Date().toISOString(),
      }
    })
  },
})

export const run = async (options = {}) => createVofoxScraper().run(options)

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
