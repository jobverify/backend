import path from 'path'
import { fileURLToPath } from 'url'

import { createBrowserFetchSession } from '../../scraper-support/shared/browserFetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://www.acsiatech.com/careers/'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, '-')
    .replace(/&mdash;|&#8212;/gi, '-')
    .replace(/[–—]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/[â€“â€”]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  || null

const extractField = (contentHtml, label) => {
  const match = String(contentHtml ?? '').match(
    new RegExp(`<p[^>]*>\\s*(?:<strong>)?${label}(?:<\\/strong>)?\\s*(?:-|:|–|—|\\?)\\s*([\\s\\S]*?)<\\/p>`, 'i'),
  )
  return normalizeWhitespace(match?.[1] || null)
}

const extractListItems = (contentHtml) =>
  [...String(contentHtml ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)

const buildAbsoluteUrl = (href) => {
  const normalized = normalizeWhitespace(href)
  if (!normalized) return CAREER_PAGE_URL

  try {
    return new URL(normalized, CAREER_PAGE_URL).toString()
  } catch {
    return CAREER_PAGE_URL
  }
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return normalized.split(',')[0]?.trim() || null
}

export const extractSearchResults = (html) => {
  const blocks = String(html ?? '')
    .split(/<div class="accordion-title-wrapper[^"]*">/i)
    .slice(1)

  return blocks
    .map((block) => {
      const title = normalizeWhitespace(
        block.match(/<div class="brxe-tnyabu brxe-text-basic">([\s\S]*?)<\/div>/i)?.[1],
      )
      const contentMatch = block.match(
        /<div class="[^"]*accordion-content-wrapper[^"]*">([\s\S]*?)<a[^>]+href="([^"]+)"/i,
      )
      const contentHtml = contentMatch?.[1] || ''
      const applyUrl = buildAbsoluteUrl(contentMatch?.[2])
      const location = extractField(contentHtml, 'Location')
      const experienceRequired = extractField(contentHtml, 'Exp band')
      const jobId = slugify(title)

      if (!title || !location || !jobId) return null

      return {
        title,
        company: 'Acsia Technologies',
        department: null,
        location: /india/i.test(location) ? location : `${location}, India`,
        city: extractCity(location),
        country: 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl: applyUrl,
        applyUrl,
        employmentType: null,
        experienceRequired,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: extractListItems(contentHtml),
        postingDate: null,
        closingDate: null,
        jobDescription: normalizeWhitespace(contentHtml),
        remoteStatus: 'On-site',
      }
    })
    .filter(Boolean)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'acsia',
  timeoutMs: 15000,
})

const isBrowserFallbackError = (error) =>
  /HTTP (?:403|429)\b|fetch failed|timed out|timeout|could not connect|und_err_connect_timeout|ssl\/tls secure channel|econnreset|unable to/i
    .test(String(error?.message ?? error ?? ''))

export const createAcsiaScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const fetchBrowserText = options.fetchBrowserText
    let browserSession = null

    const getBrowserSession = async () => {
      if (!browserSession) {
        browserSession = await createBrowserFetchSession({ userAgent: USER_AGENT })
      }

      return browserSession
    }

    const browserTextFetcher = fetchBrowserText || (async (url) => {
      const session = await getBrowserSession()
      return session.fetchText(url)
    })

    const fetchPageText = async (url) => {
      try {
        return await fetchText(url)
      } catch (error) {
        if (!isBrowserFallbackError(error)) {
          throw error
        }

        return browserTextFetcher(url)
      }
    }

    try {
      const careersHtml = await fetchPageText(CAREER_PAGE_URL)
      const jobs = extractSearchResults(careersHtml)
      const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

      return selectedJobs.map((job) => ({
        ...job,
        source: 'acsia',
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: new Date().toISOString(),
      }))
    } finally {
      if (browserSession) {
        await browserSession.close()
      }
    }
  },
})

export const run = async () => createAcsiaScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Acsia scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'acsia')
    console.log('DB result:', result)
    process.exit(0)
  }
}
