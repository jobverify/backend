import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'noveloffice'
export const COMPANY = 'Novel Office'
export const HOMEPAGE_URL = 'https://noveloffice.in/'
export const CAREERS_URL = 'https://noveloffice.in/careers/'
export const APPLY_URL = 'https://noveloffice.in/careers/apply-now/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&#8211;|&#x2013;/gi, '-')
  .replace(/&mdash;|&#8212;|&#x2014;/gi, '-')
  .replace(/[–—]/g, '-')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const slugify = (value) => stripTags(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const isPlaceholderOption = (value) => /^-+\s*please choose an option\s*-+$/i.test(stripTags(value))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title>\s*Managed Office Space in Bangalore\s*\|\s*Novel Office\s*<\/title>/i.test(page)
    && text.includes('officeenquiry@noveloffice.in')
    && text.includes('Want to join us?')
    && /Explore our careers page and discover opportunities to grow with us\./i.test(text)
    && /Apply now and show us what you(?:'|’)?ve got\./i.test(text)
    && /https:\/\/noveloffice\.in\/careers\?src=internal/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title>\s*Home\s*-\s*Novel Careers\s*<\/title>/i.test(page)
    && text.includes('Work with us.')
    && text.includes('Shape your future with Novel Office')
    && text.includes('Current Openings - India Process')
    && text.includes('Current Openings - US Process')
    && text.includes('careers@noveloffice.org')
    && /href=["'](?:https:\/\/noveloffice\.in)?\/careers\/apply-now\/["']/i.test(page)
}

export const hasOfficialApplyPageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title>\s*Apply Now\s*-\s*Novel Careers\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/noveloffice\.in\/careers\/apply-now\/["']/i.test(page)
    && text.includes('Job Application Form')
    && text.includes('Current Openings')
    && text.includes('Attach Resume')
    && text.includes('careers@noveloffice.org')
    && /<select[^>]+id=["']job-name["'][^>]*>/i.test(page)
    && /id=["']job-opening["']/i.test(page)
}

export const extractCurrentOpeningOptions = (html) => {
  if (!hasOfficialApplyPageSignal(html)) {
    throw new Error('Novel Office verified apply page no longer matches the known public surface')
  }

  const selectHtml = String(html ?? '').match(
    /<select[^>]+id=["']job-name["'][^>]*>([\s\S]*?)<\/select>/i,
  )?.[1]

  if (!selectHtml) {
    throw new Error('Novel Office verified apply page no longer matches the known public surface')
  }

  return [...selectHtml.matchAll(/<option[^>]*>([\s\S]*?)<\/option>/gi)]
    .map((match) => stripTags(match[1]))
    .filter((option) => option && !isPlaceholderOption(option))
}

const buildJobRecord = (title) => {
  const normalizedTitle = stripTags(title)
  const jobId = `${SOURCE}-${slugify(normalizedTitle)}`

  return {
    title: normalizedTitle,
    company: COMPANY,
    department: /\(US Process\)/i.test(normalizedTitle) ? 'US Process' : 'India Process',
    location: 'India',
    city: null,
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: APPLY_URL,
    applyUrl: APPLY_URL,
    employmentType: null,
    remoteStatus: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    preserveExistingSourceContent: true,
    publicExperienceChecked: true,
  }
}

export const extractPublicListings = (html) => extractCurrentOpeningOptions(html).map(buildJobRecord)

export const createNovelOfficeScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Novel Office verified official homepage no longer matches the known public surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Novel Office verified careers shell no longer matches the known first-party surface')
    }

    const applyHtml = await fetchText(APPLY_URL)
    const jobs = extractPublicListings(applyHtml)

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt: (overrideNow || now)(),
      companyCareerPage: APPLY_URL,
      companyDomain: 'noveloffice.in',
      atsPlatform: 'official-company-careers',
    }))
  },
})

export const run = async (options = {}) => createNovelOfficeScraper().run(options)

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
