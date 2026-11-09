import { createBrowserFetchSession } from '../../scraper-support/shared/browserFetch.js'

export const CAREERS_URL = 'https://twimbit.com/careers'

const normalizeText = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const htmlToLines = (html = '') => String(html)
  .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6]|\/section|\/article)[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .split('\n')
  .map(normalizeText)
  .filter(Boolean)

const extractAnchors = (html = '') => Array.from(String(html).matchAll(
  /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
), ([, href, label]) => ({ href, label: normalizeText(label.replace(/<[^>]+>/g, ' ')) }))

const toSameOriginRoleUrl = (href, careersUrl) => {
  try {
    const url = new URL(href, careersUrl)
    const careersOrigin = new URL(careersUrl).origin
    if (url.origin !== careersOrigin || !/^\/about-careers\/[^/]+\/?$/i.test(url.pathname)) {
      return null
    }
    return url.toString()
  } catch {
    return null
  }
}

const extractHeading = (html = '') => normalizeText(
  String(html).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, ' '),
)

const extractLabeledValue = (lines, labels) => {
  const labelPattern = labels.join('|')
  const match = lines.join('\n').match(new RegExp(`(?:^|\\n)(?:${labelPattern})\\s*:\\s*([^\\n]+)`, 'i'))
  return normalizeText(match?.[1])
}

const extractApplyUrl = (html, detailUrl) => {
  const applyLink = extractAnchors(html).find(({ label }) => /apply\s+now/i.test(label || ''))
  if (!applyLink) return null

  try {
    const url = new URL(applyLink.href, detailUrl)
    return /^https?:$/i.test(url.protocol) ? url.toString() : null
  } catch {
    return null
  }
}

const extractDescription = (lines) => {
  const descriptionIndex = lines.findIndex((line) => /^(?:job )?description$/i.test(line))
  if (descriptionIndex >= 0) {
    const description = lines.slice(descriptionIndex + 1)
      .filter((line) => !/^(?:apply now|contact(?:\s*:|$))|^(?:experience|seniority|location|country|work mode)\s*:/i.test(line))
      .join(' ')
    if (description) return description
  }

  return lines.join(' ')
}

const inferRemoteStatus = (lines) => {
  const text = lines.join(' ')
  if (/\bhybrid\b/i.test(text)) return 'Hybrid'
  if (/\bremote\b/i.test(text)) return 'Remote'
  if (/\bon[ -]?site\b/i.test(text)) return 'On-site'
  return null
}

const shouldUseBrowserFallback = (error) =>
  /HTTP 403\b|cloudflare|just a moment|forbidden/i.test(String(error?.message ?? error ?? ''))

const parseDetailPage = ({ html, detailUrl, now }) => {
  const lines = htmlToLines(html)
  const title = extractHeading(html)
  const location = extractLabeledValue(lines, ['location', 'country'])
  const country = /\bindia\b/i.test(location || '') ? 'India' : null
  const applyUrl = extractApplyUrl(html, detailUrl)

  if (!title || !country || !applyUrl) return null

  const city = normalizeText(location.replace(/,?\s*india\b/i, '')) || null
  const experienceRequired = extractLabeledValue(lines, ['experience', 'seniority'])

  return {
    title,
    company: 'Twimbit',
    location,
    city,
    country,
    link: detailUrl,
    sourceUrl: detailUrl,
    applyUrl,
    source: 'twimbit',
    employmentType: extractLabeledValue(lines, ['employment type', 'job type']),
    experienceRequired,
    seniority: experienceRequired,
    jobDescription: extractDescription(lines),
    requiredSkills: [],
    remoteStatus: inferRemoteStatus(lines),
    scrapedAt: now(),
  }
}

export const createTwimbitScraper = ({
  careersUrl = CAREERS_URL,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchHtml = defaultFetchHtml, fetchBrowserHtml } = {}) {
    let browserSession = null

    const getBrowserHtml = async (url) => {
      if (typeof fetchBrowserHtml === 'function') {
        return fetchBrowserHtml(url)
      }

      if (!browserSession) {
        browserSession = await createBrowserFetchSession()
      }

      return browserSession.fetchText(url, { referer: careersUrl })
    }

    const fetchHtmlWithFallback = async (url) => {
      try {
        return await fetchHtml(url)
      } catch (error) {
        if (!shouldUseBrowserFallback(error)) throw error
        return getBrowserHtml(url)
      }
    }

    try {
      const careersHtml = await fetchHtmlWithFallback(careersUrl)
      const detailUrls = [...new Set(extractAnchors(careersHtml)
        .map(({ href }) => toSameOriginRoleUrl(href, careersUrl))
        .filter(Boolean))]

      if (detailUrls.length === 0) return []

      const jobs = []
      for (const detailUrl of detailUrls) {
        const detailHtml = await fetchHtmlWithFallback(detailUrl)
        jobs.push(parseDetailPage({ html: detailHtml, detailUrl, now }))
      }

      return jobs.filter(Boolean)
    } finally {
      if (browserSession) {
        await browserSession.close()
      }
    }
  },
})

const defaultFetchHtml = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (compatible; Jobverify/1.0)',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

export const run = (options) => createTwimbitScraper().run(options)
