import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'veltrikev'
export const COMPANY = 'VELTRIK.EV'
export const COMPANY_DOMAIN = 'veltrik.com'
export const HOMEPAGE_URL = 'https://veltrik.com/'
export const CAREERS_URL = 'https://veltrik.com/careers'
export const CAMPUS_URL = 'https://veltrik.com/campus'
export const APPLY_HANDOFF_URL = 'https://veltrik.in/campus-hiring.html'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(String(value ?? ''))

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const createDescription = (title, experienceRequired) => {
  const parts = [
    'Official VELTRIK.EV role listed on the first-party careers page.',
    'Location: Bengaluru, India.',
  ]

  if (experienceRequired) {
    parts.push(`Experience: ${experienceRequired}.`)
  }

  parts.push(`Apply through the verified VELTRIK.EV careers surface or the official handoff at ${APPLY_HANDOFF_URL}.`)

  return parts.join(' ')
}

export const hasOfficialHomepageSignal = (html) => {
  const text = normalizeWhitespace(html)

  return text.includes('Cutting Edge R&D for Electric Vehicles | Veltrik.ev | VELTRIK.EV')
    && text.includes('Innovative Solutions for Electric Vehicle Design and Development')
    && text.includes('Leading B2B services for automotive electric vehicle innovation.')
    && text.includes('At Veltrik.EV, we specialize in cutting-edge R&D, co-design, and vehicle testing')
    && text.includes('Campus Hiring Careers')
    && text.includes('info@veltrik.com')
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(html)

  return text.includes('Join Our Team: Automotive Careers in Software Development | VELTRIK.EV')
    && text.includes('Join Our Team')
    && text.includes('Explore exciting career opportunities in automotive software development and functional safety engineering with us.')
    && text.includes("We're looking for talented individuals to innovate with us.")
    && text.includes('Bengaluru, India')
    && text.includes('Which Job are you interested to Apply For?')
    && text.includes('Submit Your Application')
    && page.includes(APPLY_HANDOFF_URL)
}

const parseRoleOption = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized || /select a role/i.test(normalized)) {
    return null
  }

  const match = normalized.match(/^(.*?)\s*\(([^()]*)\)\s*$/)
  const title = normalizeWhitespace(match?.[1] ?? normalized)
  const experienceRequired = normalizeWhitespace(match?.[2] ?? null)

  if (!title) {
    return null
  }

  return {
    title,
    experienceRequired,
  }
}

export const extractJobsFromCareersPage = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('VELTRIK.EV verified careers page no longer matches the trusted first-party hiring surface')
  }

  const roleSectionMatch = String(html ?? '').match(
    /Which Job are you interested to Apply For\?\*([\s\S]*?)(?:Your Message\*|Submit Your Application|<\/form>)/i,
  )

  if (!roleSectionMatch?.[1]) {
    throw new Error('VELTRIK.EV verified inline role selector is missing from the careers page')
  }

  const roleSection = roleSectionMatch[1]
  const roleTexts = [
    ...[...roleSection.matchAll(/<option\b[^>]*>([\s\S]*?)<\/option>/gi)].map((match) => match[1]),
    ...[...roleSection.matchAll(/<label\b[^>]*class=(["'])[^"']*select-input[^"']*\1[^>]*>([\s\S]*?)<\/label>/gi)]
      .map((match) => stripTags(match[2])),
  ]

  const jobs = []
  const seen = new Set()

  for (const roleText of roleTexts) {
    const role = parseRoleOption(roleText)
    if (!role) {
      continue
    }

    const dedupeKey = role.title.toLowerCase()
    if (seen.has(dedupeKey)) {
      continue
    }

    seen.add(dedupeKey)

    const slug = slugify(role.title)
    jobs.push({
      title: role.title,
      department: 'Automotive Software and EV Engineering',
      location: 'Bengaluru, India',
      city: normalizeCity('Bengaluru'),
      country: 'India',
      sourceUrl: CAREERS_URL,
      applyUrl: CAREERS_URL,
      jobId: `${SOURCE}-${slug}`,
      requisitionId: `${SOURCE}-${slug}`,
      employmentType: null,
      experienceRequired: role.experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: createDescription(role.title, role.experienceRequired),
      remoteStatus: null,
    })
  }

  if (jobs.length === 0) {
    throw new Error('VELTRIK.EV verified inline role selector no longer exposes any public roles')
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

export const createVeltrikEvScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('VELTRIK.EV verified official homepage no longer matches the trusted first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    const jobs = extractJobsFromCareersPage(careersHtml)

    return jobs.map((job) => ({
      ...job,
      company: COMPANY,
      source: SOURCE,
      companyCareerPage: CAREERS_URL,
      companyDomain: COMPANY_DOMAIN,
      atsPlatform: 'official-company-careers',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: (overrideNow || now)(),
    }))
  },
})

export const run = async (options = {}) => createVeltrikEvScraper().run(options)

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
