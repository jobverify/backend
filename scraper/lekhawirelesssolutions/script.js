import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  createBrowserNetworkFallback,
  defaultShouldUseBrowserNetworkFallback,
} from '../../scraper-support/shared/browserNetworkFallback.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'lekhawirelesssolutions'
export const COMPANY = 'Lekha Wireless Solutions'
export const HOMEPAGE_URL = 'https://www.lekhawireless.com/'
export const CAREERS_URL = 'https://www.lekhawireless.com/company/contact-us/careers/'
export const APPLY_FORM_URL = `${CAREERS_URL}#wpcf7-f5550-p3795-o1`

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const EXPECTED_TITLES = [
  'Hardware Design - Lead Engineer',
  'Electromechanical / Mechanical design Engineer (1 to 5 year)',
  'Antenna Lead/Sr.Lead',
  'Production Manager/ Sr.Lead',
  'LTE Testing - Er/Sr.Er',
  'RF Firmware Engineer/Sr. Engineer/Lead',
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/â€™|â€˜/g, "'")
  .replace(/â€œ|â€/g, '"')
  .replace(/â€“|â€”/g, '-')
  .replace(/â€¦/g, '...')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/[–—]/g, '-')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const normalizeRichText = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<li[^>]*>/gi, '\n- ')
  .replace(/<\/li>/gi, '\n')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/p>/gi, '\n')
  .replace(/<\/h[1-6]>/gi, '\n')
  .replace(/<(?:p|h[1-6]|ul|ol)[^>]*>/gi, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/[–—]/g, '-')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{2,}/g, '\n')
  .replace(/[ \t]{2,}/g, ' ')
  .trim()

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const ACCORDION_ITEM_PATTERN =
  /<div class="elementor-accordion-item">[\s\S]*?<a class="elementor-accordion-title"[^>]*>([^<]+)<\/a>[\s\S]*?<div id="elementor-tab-content-\d+" class="elementor-tab-content[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi

const splitNonEmptyLines = (value) => normalizeRichText(value)
  .split('\n')
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const isHeadingLine = (line) => /^[A-Z][A-Za-z0-9 /&().,'-:]{1,60}$/.test(line) && !line.startsWith('- ')

const extractSectionBody = (lines, headingCandidates) => {
  const index = lines.findIndex((line) =>
    headingCandidates.some((heading) =>
      line.replace(/:$/, '').toLowerCase() === heading.toLowerCase()),
  )

  if (index === -1) return null

  const body = []
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    if (isHeadingLine(lines[cursor])) break
    body.push(lines[cursor])
  }

  return body.length > 0 ? body.join(' ') : null
}

const extractExperienceRequired = (title, descriptionText) => {
  const titleMatch = normalizeWhitespace(title).match(/\(([^)]*year[^)]*)\)/i)
  if (titleMatch) {
    return normalizeWhitespace(titleMatch[1]).replace(/\byear\b/i, 'years')
  }

  const patterns = [
    /\b(Minimum\s+\d+\s*-\s*\d+\s*years(?:\s+experience)?)/i,
    /\b(\d+\+\s*years(?:\s+of\s+experience)?)/i,
    /\b(Fresher\s*\/\s*\d+\s*-\s*\d+\s*years(?:\s+of\s+experience)?)/i,
    /\b(\d+\s*-\s*\d+\s*years(?:\s+of\s+experience)?)/i,
  ]

  for (const pattern of patterns) {
    const match = normalizeWhitespace(descriptionText).match(pattern)
    if (match) return normalizeWhitespace(match[1])
  }

  return null
}

const extractMinimumQualification = (lines) => extractSectionBody(lines, [
  'Education',
  'Educational Background',
])

const parseAccordionJob = (rawTitle, rawContent) => {
  const title = normalizeWhitespace(rawTitle)
  const contentHtml = String(rawContent ?? '')
  const descriptionText = normalizeRichText(contentHtml)
  const lines = splitNonEmptyLines(contentHtml)
  const jobId = `${SOURCE}-${slugify(title)}`

  if (!title || !descriptionText || !jobId) {
    throw new Error('Lekha Wireless Solutions verified public job accordion changed shape')
  }

  return {
    title,
    company: COMPANY,
    department: null,
    location: 'India',
    city: null,
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: `${CAREERS_URL}#${jobId}`,
    applyUrl: APPLY_FORM_URL,
    employmentType: null,
    workplaceType: null,
    experienceRequired: extractExperienceRequired(title, descriptionText),
    minimumQualification: extractMinimumQualification(lines),
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: `${descriptionText} Apply via the official Lekha Wireless careers page.`,
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)
  const hasLegacyShell = /Welcome to Lekha - The future of seamless wireless connectivity/i.test(text)
    && /deep-tech company specializing in mobile wireless technology and connectivity/i.test(text)
    && /4G and 5G RAN equipment/i.test(text)
    && /IEEE 802\.16s\/t data connectivity products for railroads/i.test(text)
  const hasCurrentShell = /The future of seamless mobile wireless connectivity/i.test(text)
    && /Lekha designs and manufactures 5G, 4G and IEEE 802\.16/i.test(text)
    && /founding member of the Bharat 6G Alliance/i.test(text)

  return /<title>\s*Lekha Wireless Solutions Private Limited\s*<\/title>/i.test(page)
    && /href=["']https:\/\/www\.lekhawireless\.com\/company\/contact-us\/careers\/["']/i.test(page)
    && (hasLegacyShell || hasCurrentShell)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title>\s*Careers\s*(?:-|&#8211;|–)\s*Lekha Wireless Solutions Private Limited\s*<\/title>/i.test(page)
    && /Shape the Future with Lekha/i.test(text)
    && /ready to make a real difference/i.test(text)
    && /Upload your Resume/i.test(text)
    && /Years of experience/i.test(text)
    && /name=["']your-attachment["']/i.test(page)
    && /class=["']elementor-accordion-title["']/i.test(page)
}

export const extractPublicJobs = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Lekha Wireless Solutions verified first-party careers page no longer matches the known public surface')
  }

  const jobs = [...String(html ?? '').matchAll(ACCORDION_ITEM_PATTERN)].map(([, rawTitle, rawContent]) =>
    parseAccordionJob(rawTitle, rawContent),
  )

  if (jobs.length !== EXPECTED_TITLES.length) {
    throw new Error('Lekha Wireless Solutions verified public job accordion changed shape')
  }

  if (JSON.stringify(jobs.map((job) => job.title)) !== JSON.stringify(EXPECTED_TITLES)) {
    throw new Error('Lekha Wireless Solutions verified public job accordion changed shape')
  }

  if (new Set(jobs.map((job) => job.jobId)).size !== jobs.length) {
    throw new Error('Lekha Wireless Solutions verified public job accordion changed shape')
  }

  return jobs
}

export const createLekhaWirelessSolutionsScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchBrowserText,
    now: overrideNow,
  } = {}) {
    const browserFallback = createBrowserNetworkFallback({
      fetchText,
      fetchBrowserText,
      userAgent: USER_AGENT,
      browserSessionOptions: {
        timeoutMs: 90000,
        settleTimeMs: 12000,
        ignoreHTTPSErrors: false,
      },
      shouldUseBrowserFallback: (error) =>
        defaultShouldUseBrowserNetworkFallback(error)
        || /HTTP 406\b|not acceptable/i.test(String(error?.message ?? error ?? '')),
    })

    try {
      const homepageHtml = await browserFallback.fetchText(HOMEPAGE_URL)
      if (!hasOfficialHomepageSignal(homepageHtml)) {
        throw new Error('Lekha Wireless Solutions verified official homepage no longer matches the known first-party surface')
      }

      const careersHtml = await browserFallback.fetchText(CAREERS_URL)
      const jobs = extractPublicJobs(careersHtml)

      return jobs.map((job) => ({
        ...job,
        source: SOURCE,
        link: job.applyUrl,
        scrapedAt: (overrideNow || now)(),
        companyCareerPage: CAREERS_URL,
        companyDomain: 'lekhawireless.com',
        atsPlatform: 'official-company-careers',
      }))
    } finally {
      await browserFallback.close()
    }
  },
})

export const run = async (options = {}) => createLekhaWirelessSolutionsScraper().run(options)

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
