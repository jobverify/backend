import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import ARESS_SOFTWARE_AND_EDUCATION_TECHNOLOGIES_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = ARESS_SOFTWARE_AND_EDUCATION_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const ensureIndiaLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return 'India'
  return /india$/i.test(normalized) ? normalized : `${normalized}, India`
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Career\s*\|\s*Aress Software/i.test(rawHtml)
    && normalized.includes('Join the Aress team')
    && normalized.includes('Current Openings')
  }

const toAbsoluteUrl = (value) => {
  try {
    return new URL(String(value ?? ''), CAREERS_URL).toString()
  } catch {
    return null
  }
}

const buildCard = ({
  title,
  department,
  openings,
  location,
  experience,
  jobCode,
  detailUrl,
}) => {
  if (!title || !department || !jobCode || !detailUrl) return null

  const normalizedLocation = ensureIndiaLocation(location)
  return {
    title,
    department,
    openings,
    location: normalizedLocation,
    city: normalizeWhitespace(normalizedLocation.split(',')[0]),
    experience,
    jobCode,
    detailUrl,
  }
}

const extractLabeledValue = (html = '', label) =>
  normalizeWhitespace(
    String(html ?? '').match(
      new RegExp(
        `<p[^>]*>\\s*${label}:\\s*<\\/p>[\\s\\S]*?<div[^>]*class=["'][^"']*job-value[^"']*["'][^>]*>\\s*<p[^>]*>([\\s\\S]*?)<\\/p>`,
        'i',
      ),
    )?.[1],
  )
  || normalizeWhitespace(String(html ?? '').match(new RegExp(`${label}:\\s*([^<\\n\\r]+)`, 'i'))?.[1])

const extractLegacyJobCards = (rawHtml = '') => {
  const sectionPattern = /<section[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)<\/section>/gi
  const cards = []

  for (const match of rawHtml.matchAll(sectionPattern)) {
    const department = normalizeWhitespace(match[1])
    const sectionHtml = match[2]

    for (const articleMatch of sectionHtml.matchAll(/<article[^>]*>([\s\S]*?)<\/article>/gi)) {
      const articleHtml = articleMatch[1]
      const card = buildCard({
        title: normalizeWhitespace(articleHtml.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i)?.[1]),
        department,
        openings: normalizeWhitespace(articleHtml.match(/Openings\s*([0-9]+)/i)?.[1]),
        location: articleHtml.match(/Location:\s*([^<\n\r]+)/i)?.[1],
        experience: normalizeWhitespace(articleHtml.match(/Experience:\s*([^<\n\r]+)/i)?.[1]),
        jobCode: normalizeWhitespace(articleHtml.match(/Jobcode:\s*([^<\n\r]+)/i)?.[1]),
        detailUrl: toAbsoluteUrl(articleHtml.match(/href=["']([^"']+)["']/i)?.[1]),
      })

      if (card) cards.push(card)
    }
  }

  return cards
}

const extractAccordionJobCards = (rawHtml = '') => {
  const sections = String(rawHtml ?? '')
    .split(/<div[^>]*class=["'][^"']*accordion-item[^"']*["'][^>]*>/i)
    .slice(1)
  const cards = []

  for (const section of sections) {
    const department = normalizeWhitespace(section.match(/<button[^>]*>([\s\S]*?)<\/button>/i)?.[1])
    if (!department) continue

    const jobSegments = section
      .split(/<div[^>]*class=["'][^"']*job-item[^"']*["'][^>]*>/i)
      .slice(1)

    for (const jobSegment of jobSegments) {
      const card = buildCard({
        title: normalizeWhitespace(jobSegment.match(/<h[34][^>]*>([\s\S]*?)<\/h[34]>/i)?.[1]),
        department,
        openings:
          normalizeWhitespace(jobSegment.match(/<span[^>]*>\s*Openings\s*<\/span>\s*([0-9]+)/i)?.[1])
          || normalizeWhitespace(jobSegment.match(/Openings\s*([0-9]+)/i)?.[1]),
        location: extractLabeledValue(jobSegment, 'Location'),
        experience: extractLabeledValue(jobSegment, 'Experience'),
        jobCode: extractLabeledValue(jobSegment, 'Jobcode'),
        detailUrl: toAbsoluteUrl(jobSegment.match(/href=["']([^"']+)["'][^>]*>\s*More Details/i)?.[1]),
      })

      if (card) cards.push(card)
    }
  }

  return cards
}

export const extractJobCards = (html = '') => {
  const rawHtml = String(html ?? '')
  const cards = [
    ...extractLegacyJobCards(rawHtml),
    ...extractAccordionJobCards(rawHtml),
  ]

  return cards.filter((card, index, collection) =>
    collection.findIndex((candidate) =>
      candidate.jobCode === card.jobCode
      || (
        candidate.title === card.title
        && candidate.department === card.department
        && candidate.detailUrl === card.detailUrl
      )
    ) === index)
}

export const createAressSoftwareAndEducationTechnologiesScraper = () => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Verified Aress careers page no longer matches the trusted first-party surface')
    }

    const cards = extractJobCards(careersHtml)
    if (cards.length === 0) {
      throw new Error('Aress official careers page exposes no structured public job cards')
    }

    return cards.map((card) => ({
      title: card.title,
      company: COMPANY,
      department: card.department,
      location: card.location,
      city: card.city,
      country: 'India',
      jobId: slugify(card.jobCode),
      requisitionId: card.jobCode,
      sourceUrl: card.detailUrl,
      applyUrl: card.detailUrl,
      employmentType: null,
      experienceRequired: card.experience || null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: `Openings: ${card.openings || '1'}`,
      source: SOURCE,
      link: card.detailUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createAressSoftwareAndEducationTechnologiesScraper().run(options)

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
