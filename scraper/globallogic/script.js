import path from 'path'
import { fileURLToPath } from 'url'

import { createBrowserTextFallback } from '../../scraper-support/shared/browserTextFallback.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const ORIGIN = 'https://www.globallogic.com'
const FETCH_TIMEOUT_MS = 15000
const EXIT_SETTLE_DELAY_MS = 250
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const createFetchTimeoutController = (timeoutMs = FETCH_TIMEOUT_MS) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return {
      signal: undefined,
      cancel() {},
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  return {
    signal: controller.signal,
    cancel() {
      clearTimeout(timeout)
    },
  }
}

export const CAREERS_PAGE_URL = `${ORIGIN}/careers/`
export const SEARCH_PAGE_URL = `${ORIGIN}/career-search-page/`

const buildHeaders = (cookieHeader = null, extraHeaders = {}) => ({
  'User-Agent': USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  ...(cookieHeader ? { Cookie: cookieHeader } : {}),
  ...extraHeaders,
})

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&raquo;/gi, '>>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/section|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const toAbsoluteUrl = (value) => {
  if (!value) return null

  try {
    return new URL(decodeHtmlEntities(value), ORIGIN).toString()
  } catch {
    return null
  }
}

const extractByClass = (html, className) => stripTags(
  extractFirst(
    new RegExp(`<[^>]+class="[^"]*${escapeRegExp(className)}[^"]*"[^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'i'),
    html,
  ),
)

const extractJobId = (value) => normalizeWhitespace(
  extractFirst(/\b(IRC\d+)\b/i, value, (match) => match[1].toUpperCase()),
)

const stripTrailingJobId = (title, jobId) => {
  const normalizedTitle = normalizeWhitespace(title)
  if (!normalizedTitle || !jobId) return normalizedTitle

  return normalizeWhitespace(
    normalizedTitle.replace(new RegExp(`\\s*${escapeRegExp(jobId)}$`, 'i'), ''),
  )
}

const normalizePostingDate = (value) => {
  const rawDate = normalizeWhitespace(value)?.replace(/^Published on\s+/i, '')
  if (!rawDate) return null

  const dateMatch = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(rawDate)
  if (!dateMatch) return null

  const [, dayValue, monthValue, yearValue] = dateMatch
  const monthIndex = [
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
  ].indexOf(monthValue.toLowerCase())

  if (monthIndex < 0) return null

  const date = new Date(Date.UTC(
    Number.parseInt(yearValue, 10),
    monthIndex,
    Number.parseInt(dayValue, 10),
  ))

  return date.toISOString().slice(0, 10)
}

const parseLocation = (value) => {
  const location = normalizeWhitespace(value)
  if (!location) {
    return {
      location: null,
      city: null,
      country: null,
    }
  }

  const indiaDashMatch = /^India\s*-\s*(.+)$/i.exec(location)
  if (indiaDashMatch) {
    const city = normalizeWhitespace(indiaDashMatch[1])
    return {
      location: `India - ${city}`,
      city,
      country: 'India',
    }
  }

  const indiaCommaMatch = /^(.+?),\s*India$/i.exec(location)
  if (indiaCommaMatch) {
    const city = normalizeWhitespace(indiaCommaMatch[1])
    return {
      location: `${city}, India`,
      city,
      country: 'India',
    }
  }

  const indiaOnlyMatch = /^India$/i.test(location)
  if (indiaOnlyMatch) {
    return {
      location: 'India',
      city: null,
      country: 'India',
    }
  }

  return {
    location,
    city: normalizeWhitespace(location.split(',')[0]),
    country: null,
  }
}

const extractSectionContent = (html, heading) => extractFirst(
  new RegExp(`<section[^>]*>\\s*<h2[^>]*>\\s*${escapeRegExp(heading)}\\s*<\\/h2>\\s*([\\s\\S]*?)<\\/section>`, 'i'),
  html,
)

const extractCurrentSectionContent = (html, heading) => extractFirst(
  new RegExp(
    `<h4[^>]*>\\s*${escapeRegExp(heading)}\\s*<\\/h4>\\s*([\\s\\S]*?)(?=<h4[^>]*>|<form\\b|<div[^>]+class="[^"]*job_apply_form[^"]*"|$)`,
    'i',
  ),
  html,
)

const extractSectionText = (html, heading) => stripTags(
  extractSectionContent(html, heading) || extractCurrentSectionContent(html, heading),
)

const extractListItems = (html) => [...String(html ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const extractOverviewValue = (html, label) => stripTags(
  extractFirst(
    new RegExp(
      `<section[^>]*>\\s*<h2[^>]*>\\s*${escapeRegExp(label)}\\s*<\\/h2>\\s*<p[^>]*>\\s*([\\s\\S]*?)\\s*<\\/p>\\s*<\\/section>`,
      'i',
    ),
    html,
  ) || extractFirst(
    new RegExp(
      `<span[^>]*>\\s*${escapeRegExp(label)}\\s*<\\/span>\\s*<p[^>]*>\\s*([\\s\\S]*?)\\s*<\\/p>`,
      'i',
    ),
    html,
  ),
)

const getHeader = (headers, name) => {
  if (!headers || !name) return null

  if (typeof headers.get === 'function') {
    return headers.get(name)
  }

  const directValue = headers[name] ?? headers[name.toLowerCase()]
  if (Array.isArray(directValue)) {
    return directValue.join(', ')
  }

  return directValue ?? null
}

const getSetCookieValues = (headers) => {
  if (!headers) return []

  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie()
      .map((value) => String(value).trim())
      .filter(Boolean)
  }

  const directValue = headers['set-cookie'] ?? headers['Set-Cookie']
  if (Array.isArray(directValue)) {
    return directValue
      .map((value) => String(value).trim())
      .filter(Boolean)
  }

  return directValue ? [String(directValue).trim()] : []
}

const mergeCookiePairs = (existingPairs, newPairs) => {
  const cookieJar = new Map()

  for (const pair of [...existingPairs, ...newPairs]) {
    const [cookiePair] = String(pair ?? '').split(';', 1)
    const separatorIndex = cookiePair.indexOf('=')
    if (separatorIndex <= 0) continue

    const name = cookiePair.slice(0, separatorIndex).trim()
    const value = cookiePair.slice(separatorIndex + 1).trim()
    if (!name || !value) continue

    cookieJar.set(name, value)
  }

  return [...cookieJar.entries()].map(([name, value]) => `${name}=${value}`)
}

const buildCookieHeader = (cookiePairs) => cookiePairs.join('; ')

const settleNetworkCleanup = async () => new Promise((resolve) => {
  setTimeout(resolve, EXIT_SETTLE_DELAY_MS)
})

const normalizeUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    return url.toString()
  } catch {
    return String(value ?? '')
  }
}

export const isIncapsulaLoadingShellPage = (page = {}) => {
  const html = String(page.html ?? '')
  const location = getHeader(page.headers, 'location')
  const setCookies = getSetCookieValues(page.headers)

  return Number(page.status) === 302
    && normalizeUrl(location) === normalizeUrl(page.url)
    && /<title>\s*Loading\s*<\/title>/i.test(html)
    && /<h3[^>]*>\s*Loading\s*<\/h3>/i.test(html)
    && setCookies.some((value) => /^visid_incap_/i.test(value))
    && setCookies.some((value) => /^incap_ses_/i.test(value))
}

export const isIncapsulaIframeChallengePage = (page = {}) => {
  const html = String(page.html ?? '')

  return Number(page.status) === 403
    && html.includes('/_Incapsula_Resource?SWJIYLWA=')
    && html.includes('/_Incapsula_Resource?CWUDNSAI=')
    && /Request unsuccessful\.\s*Incapsula incident ID:/i.test(html)
}

const defaultFetchText = async (url) => {
  const timeout = createFetchTimeoutController()
  try {
    const response = await fetch(url, {
      headers: buildHeaders(),
      signal: timeout.signal,
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`)
    }

    return response.text()
  } finally {
    timeout.cancel()
  }
}

const readPageResponse = async (response, requestedUrl) => ({
  status: response.status,
  url: requestedUrl,
  headers: response.headers,
  html: await response.text(),
})

const defaultFetchPage = async (url) => {
  const cookiePairs = []
  let currentUrl = url

  for (let redirectCount = 0; redirectCount < 8; redirectCount += 1) {
    const timeout = createFetchTimeoutController()
    const response = await fetch(currentUrl, {
      headers: buildHeaders(buildCookieHeader(cookiePairs)),
      redirect: 'manual',
      signal: timeout.signal,
    })
    const page = await readPageResponse(response, currentUrl)
    timeout.cancel()
    const nextCookiePairs = mergeCookiePairs(cookiePairs, getSetCookieValues(page.headers))
    cookiePairs.splice(0, cookiePairs.length, ...nextCookiePairs)

    if (isIncapsulaLoadingShellPage(page)) {
      continue
    }

    const location = getHeader(page.headers, 'location')
    if ([301, 302, 303, 307, 308].includes(Number(page.status)) && location) {
      currentUrl = new URL(location, currentUrl).toString()
      continue
    }

    return page
  }

  throw new Error(`Too many redirects while requesting GlobalLogic URL: ${url}`)
}

const isBrowserFallbackError = (error) =>
  /HTTP (?:403|429)\b|fetch failed|redirect count exceeded|incapsula|forbidden|blocked|challenge/i
    .test(String(error?.message ?? error ?? ''))

export const buildSearchPageUrl = (page = 1) => {
  const normalizedPage = Math.max(1, Number(page) || 1)
  if (normalizedPage === 1) {
    return SEARCH_PAGE_URL
  }

  return `${SEARCH_PAGE_URL}page/${normalizedPage}/`
}

export const hasNextSearchPage = (html) => /\bNext\b/i.test(decodeHtmlEntities(String(html ?? '')))

export const extractSearchResults = (html) => [...String(html ?? '').matchAll(
  /<a\b[^>]*href="([^"]*\/careers\/[^"]*irc\d+\/?)"[^>]*>([\s\S]*?)<\/a>/gi,
)]
  .map((match) => {
    const sourceUrl = toAbsoluteUrl(match[1])
    const anchorHtml = match[0]
    const cardHtml = match[2]
    const jobId = extractJobId(match[0]) || extractJobId(sourceUrl)
    const isCurrentJobBoxCard = /\bjob_box\b/i.test(anchorHtml)
    const title = stripTrailingJobId(
      extractByClass(cardHtml, 'job-title')
      || extractFirst(/<h[1-6][^>]*>\s*([\s\S]*?)\s*<\/h[1-6]>/i, cardHtml, (item) => item[1]),
      jobId,
    )

    const parsedLocation = (() => {
      if (isCurrentJobBoxCard) {
        const locationTokens = [...cardHtml.matchAll(
          /<span[^>]+class="[^"]*\bjob_location\b[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
        )]
          .map((item) => stripTags(item[1]))
          .filter(Boolean)

        const country = locationTokens.find((value) => /^India$/i.test(value)) ? 'India' : null
        const city = locationTokens.find((value) => !/^India$/i.test(value)) || null

        if (country !== 'India') {
          return {
            location: null,
            city: null,
            country: null,
          }
        }

        return {
          location: city ? `India - ${city}` : 'India',
          city,
          country,
        }
      }

      const country = extractByClass(cardHtml, 'job-country')
      const city = extractByClass(cardHtml, 'job-city')
      return parseLocation(country && city ? `${country} - ${city}` : country || city)
    })()

    if (!sourceUrl || !jobId || !title || parsedLocation.country !== 'India') {
      return null
    }

    return {
      title,
      company: 'GlobalLogic',
      department: extractByClass(cardHtml, 'job-function'),
      location: parsedLocation.location,
      city: parsedLocation.city,
      country: parsedLocation.country,
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: extractByClass(cardHtml, 'job-experience'),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: normalizePostingDate(extractByClass(cardHtml, 'job-date')),
      closingDate: null,
      jobDescription: null,
    }
  })
  .filter(Boolean)

export const extractJobDetail = (html, listing = {}) => {
  const sourceUrl = listing.sourceUrl || toAbsoluteUrl(
    extractFirst(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/i, html),
  )
  const jobId = listing.jobId || extractJobId(sourceUrl) || extractJobId(html)
  const title = stripTrailingJobId(
    extractFirst(/<h1[^>]*>\s*([\s\S]*?)\s*<\/h1>/i, html, (match) => match[1]) || listing.title,
    jobId,
  )
  const detailLocation = extractOverviewValue(html, 'Location') || listing.location
  const parsedLocation = parseLocation(detailLocation)
  const requirementsSection = extractSectionContent(html, 'Requirements')
  const requirementItems = extractListItems(requirementsSection)
  const jobDescriptionParts = [
    extractSectionText(html, 'Description'),
    extractSectionText(html, 'Requirements'),
    extractSectionText(html, 'Job responsibilities'),
  ].filter(Boolean)
  const skills = normalizeWhitespace(extractOverviewValue(html, 'Skills'))
    ?.split(',')
    .map((skill) => normalizeWhitespace(skill))
    .filter(Boolean) || []

  return {
    title: title || listing.title || null,
    company: listing.company || 'GlobalLogic',
    department: extractOverviewValue(html, 'Function') || listing.department || null,
    location: parsedLocation.location || listing.location || null,
    city: parsedLocation.city || listing.city || null,
    country: parsedLocation.country || listing.country || null,
    jobId: jobId || null,
    requisitionId: jobId || listing.requisitionId || null,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: listing.employmentType || null,
    experienceRequired: extractOverviewValue(html, 'Experience') || listing.experienceRequired || null,
    minimumQualification:
      requirementItems[0]
      || extractSectionText(html, 'Requirements')
      || listing.minimumQualification
      || null,
    preferredQualification: null,
    requiredSkills: skills.length > 0 ? skills : (listing.requiredSkills || []),
    postingDate: normalizePostingDate(
      extractFirst(/Published on\s+([^<]+)/i, html, (match) => match[1]),
    ) || listing.postingDate || null,
    closingDate: null,
    jobDescription: jobDescriptionParts.join('\n\n') || listing.jobDescription || null,
  }
}

export const createGlobalLogicScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY,
} = {}) => ({
  async run(options = {}) {
    const fetchPage = options.fetchPage || defaultFetchPage
    const fetchText = options.fetchText || defaultFetchText
    const browserTextFallback = createBrowserTextFallback({
      fetchText,
      fetchBrowserText: options.fetchBrowserText,
      userAgent: USER_AGENT,
      shouldUseBrowserFallback: isBrowserFallbackError,
    })
    const jobs = []
    const seenJobIds = new Set()
    const finalizePagePathResult = async (result) => {
      // Let the undici transport settle before the runner forces process.exit on Windows.
      await settleNetworkCleanup()
      return result
    }

    try {
      if (typeof options.fetchPage === 'function' || !options.fetchText) {
        const careersPage = await fetchPage(CAREERS_PAGE_URL)
        if (isIncapsulaLoadingShellPage(careersPage) || isIncapsulaIframeChallengePage(careersPage)) {
          return finalizePagePathResult([])
        }

        if (Number(careersPage.status) !== 200) {
          throw new Error(`HTTP ${careersPage.status} for ${CAREERS_PAGE_URL}`)
        }

        for (let page = 1; page <= maxPages; page += 1) {
          const searchPage = await fetchPage(buildSearchPageUrl(page))
          if (isIncapsulaLoadingShellPage(searchPage) || isIncapsulaIframeChallengePage(searchPage)) {
            return finalizePagePathResult([])
          }

          if (Number(searchPage.status) !== 200) {
            throw new Error(`HTTP ${searchPage.status} for ${buildSearchPageUrl(page)}`)
          }

          const listings = extractSearchResults(searchPage.html)

          for (const listing of listings) {
            if (seenJobIds.has(listing.jobId)) continue
            seenJobIds.add(listing.jobId)

            let job = listing
            try {
              const detailPage = await fetchPage(listing.sourceUrl)
              if (Number(detailPage.status) === 200) {
                job = {
                  ...listing,
                  ...extractJobDetail(detailPage.html, listing),
                }
              }
            } catch {
              job = listing
            }

            jobs.push({
              ...job,
              source: 'globallogic',
              link: job.applyUrl || job.sourceUrl,
              scrapedAt: new Date().toISOString(),
            })

            if (maxJobs && jobs.length >= maxJobs) {
              return finalizePagePathResult(jobs)
            }
          }

          if (!hasNextSearchPage(searchPage.html)) {
            break
          }
        }

        return finalizePagePathResult(jobs)
      }

      for (let page = 1; page <= maxPages; page += 1) {
        const searchHtml = await browserTextFallback.fetchText(buildSearchPageUrl(page))
        const listings = extractSearchResults(searchHtml)

        for (const listing of listings) {
          if (seenJobIds.has(listing.jobId)) continue
          seenJobIds.add(listing.jobId)

          let job = listing
          try {
            const detailHtml = await browserTextFallback.fetchText(listing.sourceUrl)
            job = {
              ...listing,
              ...extractJobDetail(detailHtml, listing),
            }
          } catch {
            job = listing
          }

          jobs.push({
            ...job,
            source: 'globallogic',
            link: job.applyUrl || job.sourceUrl,
            scrapedAt: new Date().toISOString(),
          })

          if (maxJobs && jobs.length >= maxJobs) {
            return jobs
          }
        }

        if (!hasNextSearchPage(searchHtml)) {
          break
        }
      }

      return jobs
    } finally {
      await browserTextFallback.close()
    }
  },
})

export const run = async () => createGlobalLogicScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running GlobalLogic scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'globallogic')
    console.log('DB result:', result)
    process.exit(0)
  }
}
