import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { HESTABIT_TECHNOLOGIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = HESTABIT_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const COMPANY_DOMAIN = PROVIDER_METADATA.companyDomain
export const ATS_PLATFORM = PROVIDER_METADATA.atsPlatform
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const INDIA_LOCATION = 'Noida, Uttar Pradesh, India'
const INDIA_CITY = 'Noida'
const INDIA_STATE = 'Uttar Pradesh'
const INDIA_COUNTRY = 'India'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const defaultFetchText = (url) =>
  fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    label: `${SOURCE}-html`,
    timeoutMs: 15000,
  })

export const hasVerifiedCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  return /Web Mobile App Development Jobs in Noida \| Hestabit/i.test(page)
    && /Career\s*@\s*HestaBit/i.test(page)
    && /Senior PHP Developer/i.test(page)
    && /Associate PHP Developer/i.test(page)
    && /Senior Graphic Designer/i.test(page)
    && /docs\.google\.com\/forms/i.test(page)
}

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const toAbsoluteGoogleFormUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''), CAREERS_URL)
    return /docs\.google\.com$/i.test(url.hostname) ? url.toString() : null
  } catch {
    return null
  }
}

export const extractRoleTeasers = (html = '') => {
  const roles = []
  const seenTitles = new Set()

  for (const match of String(html ?? '').matchAll(/<h([1-6])[^>]*>\s*([^<]+?)\s*<\/h\1>([\s\S]*?)(?=<h[1-6][^>]*>|$)/gi)) {
    const title = normalizeWhitespace(match[2])
    const block = match[3]

    if (!title || /^(career\s*@\s*hestabit|we'?re hiring)$/i.test(title) || seenTitles.has(title)) {
      continue
    }

    const applyUrl = toAbsoluteGoogleFormUrl(block.match(/<a[^>]+href=["']([^"']+)["'][^>]*>\s*(?:<span>)?\s*Apply now/i)?.[1])
      || toAbsoluteGoogleFormUrl(block.match(/<a[^>]+href=["']([^"']+)["'][^>]*>\s*Apply Now/i)?.[1])
    const paragraphs = [...block.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((item) => normalizeWhitespace(item[1]))
      .filter(Boolean)
    const blockText = normalizeWhitespace(
      String(block)
        .replace(/<a[\s\S]*?<\/a>/gi, ' ')
        .replace(/<img[^>]*>/gi, ' '),
    )
    const jobDescription = paragraphs[0]
      || blockText.replace(/\bapply now\b/gi, '').trim()
      || null

    if (!applyUrl || !jobDescription) {
      continue
    }

    seenTitles.add(title)
    roles.push({
      title,
      jobDescription,
      applyUrl,
      sourceUrl: CAREERS_URL,
      jobId: slugify(title),
    })
  }

  return roles
}

export const createHestabitTechnologiesScraper = () => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasVerifiedCareersPageSignal(careersHtml)) {
      throw new Error('Hestabit Technologies verified first-party careers page no longer matches the trusted public surface')
    }

    const roles = extractRoleTeasers(careersHtml)
    if (roles.length === 0) {
      throw new Error('Hestabit Technologies verified careers page no longer exposes the expected role teasers')
    }

    return roles.map((role) => ({
      title: role.title,
      company: COMPANY,
      department: null,
      location: INDIA_LOCATION,
      city: INDIA_CITY,
      state: INDIA_STATE,
      country: INDIA_COUNTRY,
      jobId: role.jobId,
      requisitionId: role.jobId,
      sourceUrl: role.sourceUrl,
      applyUrl: role.applyUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: role.jobDescription,
      remoteStatus: null,
      source: SOURCE,
      link: role.applyUrl || role.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createHestabitTechnologiesScraper().run(options)

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
