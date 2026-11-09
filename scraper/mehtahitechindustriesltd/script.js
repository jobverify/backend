import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'mehtahitechindustriesltd'
export const COMPANY = 'Mehta Hitech Industries Ltd.'
export const HOMEPAGE_URL = 'https://www.mehtahitech.com/'
export const CAREERS_URL = 'https://www.mehtahitech.com/jobs.html'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const toTextLines = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .split(/\r?\n/)
  .map((line) => normalizeWhitespace(line)?.replace(/["”]\s+Less$/i, '').replace(/^"+|"+$/g, ''))
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const absoluteUrl = (value) => {
  if (!value) return null

  try {
    return new URL(value, CAREERS_URL).toString()
  } catch {
    return null
  }
}

const extractFieldBlock = (sectionHtml, label) => sectionHtml.match(
  new RegExp(`<dt[^>]*>\\s*${label}\\s*<\\/dt>([\\s\\S]*?)(?=<dt[^>]*>|<\\/dl>|$)`, 'i'),
)?.[1] || ''

const parseFieldValue = (sectionHtml, label) => normalizeWhitespace(
  extractFieldBlock(sectionHtml, label).match(/<dd[^>]*>([\s\S]*?)<\/dd>/i)?.[1],
)

const parseAllFieldValues = (sectionHtml, label) => [...extractFieldBlock(sectionHtml, label).matchAll(
  /<dd[^>]*>([\s\S]*?)<\/dd>/gi,
)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const joinUnique = (values) => [...new Set(values.map((value) => normalizeWhitespace(value)).filter(Boolean))].join(', ')

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialHomepageSignal = (html) => {
  const page = decodeHtmlEntities(String(html ?? ''))
  return /<title>\s*Mehta Hitech Industries Limited - (?:Exporter & )?Manufacturer of Fiber Laser Cutting Machine from Ahmedabad\s*<\/title>/i.test(page)
    && /Mehta Hitech Industries Limited/i.test(page)
    && /Kathawada,\s*Ahmedabad,\s*Gujarat/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  return /<title>\s*Career Opportunities at Mehta Hitech Industries Limited\s*<\/title>/i.test(page)
    && /Marketing Executives/i.test(page)
    && /Job Application Form/i.test(page)
    && /Apply Now/i.test(page)
    && /Qualification/i.test(page)
    && /Skills Required/i.test(page)
    && /Experience/i.test(page)
}

const parseLiveInlineOpening = (page) => {
  const title = stripTags(
    String(page ?? '').match(
      /<div[^>]*class=["'][^"']*\bpflInrHdng\b[^"']*["'][^>]*>\s*<h3[^>]*>([\s\S]*?)<\/h3>/i,
    )?.[1],
  )
  const bodyHtml = String(page ?? '').match(
    /<div[^>]*class=["'][^"']*\bpflInrTxtv\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  )?.[1]

  if (!title || !bodyHtml) return null

  const lines = toTextLines(bodyHtml)
    .filter((line) => !/^less$/i.test(line))
  if (lines.length === 0) return null

  const sections = new Map()
  const summary = []
  let currentLabel = null

  for (const line of lines) {
    const label = line.match(/^(Qualification|Skills Required|Experience):?$/i)?.[1]
    if (label) {
      currentLabel = label.toLowerCase()
      sections.set(currentLabel, [])
      continue
    }

    if (!currentLabel) {
      summary.push(line)
      continue
    }

    sections.get(currentLabel)?.push(line)
  }

  const qualification = joinUnique(sections.get('qualification') || [])
  const skills = sections.get('skills required') || []
  const experienceRequired = joinUnique(sections.get('experience') || [])
  const summaryText = joinUnique(summary)

  if (!summaryText || !qualification || !experienceRequired || skills.length === 0) {
    return null
  }

  return {
    title,
    summary: summaryText,
    qualification,
    skills,
    experienceRequired,
    applyUrl: CAREERS_URL,
  }
}

export const extractPublicListings = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Mehta Hitech Industries Ltd. verified careers surface changed or disappeared')
  }

  const page = String(html ?? '')
  const openingCount = [...page.matchAll(/<section\b[^>]*class=["'][^"']*\bcareer-opening\b[^"']*["'][^>]*>/gi)].length
    + [...page.matchAll(/<div[^>]*class=["'][^"']*\bpflInrHdng\b[^"']*["'][^>]*>\s*<h3[^>]*>/gi)].length
  if (openingCount !== 1) {
    throw new Error('Mehta Hitech Industries Ltd. verified single-opening inventory changed')
  }
  const openingHtml = page.match(/<section\b[^>]*class=["'][^"']*\bcareer-opening\b[^"']*["'][^>]*>([\s\S]*?)<\/section>/i)?.[1]

  if (!openingHtml) {
    const liveOpening = parseLiveInlineOpening(page)
    if (!liveOpening) {
      throw new Error('Mehta Hitech Industries Ltd. verified careers surface changed or disappeared')
    }

    const location = 'Ahmedabad, Gujarat, India'
    const city = 'Ahmedabad'
    const jobSlug = slugify(liveOpening.title)
    const jobId = `${SOURCE}-${jobSlug}`

    return [{
      title: liveOpening.title,
      company: COMPANY,
      department: 'Marketing',
      location,
      city,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: `${CAREERS_URL}#${jobId}`,
      applyUrl: liveOpening.applyUrl,
      employmentType: null,
      experienceRequired: liveOpening.experienceRequired,
      minimumQualification: liveOpening.qualification,
      preferredQualification: joinUnique(liveOpening.skills),
      requiredSkills: liveOpening.skills,
      postingDate: null,
      closingDate: null,
      jobDescription: [
        `Company: ${COMPANY}`,
        `Location: ${city}`,
        `Qualification: ${liveOpening.qualification}`,
        `Skills Required: ${joinUnique(liveOpening.skills)}`,
        `Year of experience: ${liveOpening.experienceRequired}`,
        `Notes: ${liveOpening.summary}`,
      ].join(' | '),
    }]
  }

  const title = stripTags(openingHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1])
  const summary = stripTags(openingHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1])
  const qualification = parseFieldValue(openingHtml, 'Qualification')
  const skills = parseAllFieldValues(openingHtml, 'Skills Required')
  const experienceRequired = parseFieldValue(openingHtml, 'Experience')
  const applyUrl = absoluteUrl(openingHtml.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>\s*Apply Now\s*<\/a>/i)?.[1]) || CAREERS_URL
  const location = 'Ahmedabad, Gujarat, India'
  const city = 'Ahmedabad'
  const jobSlug = slugify(title)
  const jobId = `${SOURCE}-${jobSlug}`

  if (!title || !summary || !qualification || !experienceRequired || skills.length === 0) {
    throw new Error('Mehta Hitech Industries Ltd. verified careers surface changed or disappeared')
  }

  return [{
    title,
    company: COMPANY,
    department: 'Marketing',
    location,
    city,
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: `${CAREERS_URL}#${jobId}`,
    applyUrl,
    employmentType: null,
    experienceRequired,
    minimumQualification: qualification,
    preferredQualification: joinUnique(skills),
    requiredSkills: skills,
    postingDate: null,
    closingDate: null,
    jobDescription: [
      `Company: ${COMPANY}`,
      `Location: ${city}`,
      `Qualification: ${qualification}`,
      `Skills Required: ${joinUnique(skills)}`,
      `Year of experience: ${experienceRequired}`,
      `Notes: ${summary}`,
    ].join(' | '),
  }]
}

export const createMehtaHitechIndustriesLtdScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Mehta Hitech Industries Ltd. verified official homepage no longer matches the known public surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    const jobs = extractPublicListings(careersHtml).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: (overrideNow || now)(),
      companyCareerPage: CAREERS_URL,
      companyDomain: 'mehtahitech.com',
      atsPlatform: 'official-company-careers',
    }))
    return attachInventoryEvidence(jobs, {
      status: 'complete-inventory', surface: CAREERS_URL, firstParty: true, listingComplete: true,
      pagesFetched: 1, reportedTotal: jobs.length, indiaFacetCount: jobs.length,
      verifiedAt: (overrideNow || now)(), reason: 'verified-single-opening-profile-and-application-form',
    })
  },
})

export const run = async (options = {}) => createMehtaHitechIndustriesLtdScraper().run(options)

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
