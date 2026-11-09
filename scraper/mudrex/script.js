import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ABOUT_URL = 'https://mudrex.com/about-us'
export const CAREERS_BOARD_URL = 'https://mudrex.careers-page.com/'
export const COMPANY = 'Mudrex'
export const SOURCE = 'mudrex'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/&gt;/gi, '>')
  .replace(/&lt;/gi, '<')

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
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/h[1-6])\b[^>]*>/gi, ' ')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value, baseUrl = CAREERS_BOARD_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

const getAnchors = (html) => [...String(html ?? '').matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
  .map((match) => ({
    attrs: match[1] || '',
    innerHtml: match[2] || '',
  }))

const getAttribute = (attrs, name) => {
  const match = String(attrs ?? '').match(new RegExp(`${name}=["']([^"']*)["']`, 'i'))
  return normalizeWhitespace(match?.[1])
}

const getTextListItems = (html) => [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const toCity = (location) => normalizeWhitespace(location)?.split(',')[0] || null

const inferCountry = (location) => {
  if (/india/i.test(location || '')) return 'India'
  return null
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized.includes('full-time') || normalized.includes('full time')) return 'Full-time'
  if (normalized.includes('part-time') || normalized.includes('part time')) return 'Part-time'
  if (normalized.includes('contract')) return 'Contract'
  if (normalized.includes('intern')) return 'Internship'
  return null
}

const normalizeRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized.includes('hybrid')) return 'Hybrid'
  if (normalized.includes('remote')) return 'Remote'
  if (normalized.includes('on-site') || normalized.includes('onsite')) return 'On-site'
  return null
}

const extractJobDetailListItems = (html) => {
  const match = String(html ?? '').match(
    /<div\b[^>]*class=["'][^"']*job-location[^"']*["'][^>]*>[\s\S]*?<ul\b[^>]*>([\s\S]*?)<\/ul>/i,
  )

  return getTextListItems(match?.[1])
}

const extractDescription = (html) => {
  const match = String(html ?? '').match(
    /<div\b[^>]*class=["'][^"']*job-post-description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  )

  return stripTags(match?.[1]) || null
}

const buildEmptyJobShape = ({
  title,
  location,
  city,
  country,
  jobId,
  sourceUrl,
  applyUrl,
} = {}) => ({
  title: title || null,
  company: COMPANY,
  department: null,
  location: location || null,
  city: city || null,
  country: country || null,
  jobId: jobId || null,
  requisitionId: jobId || null,
  sourceUrl: sourceUrl || null,
  applyUrl: applyUrl || null,
  employmentType: null,
  experienceRequired: null,
  minimumQualification: null,
  preferredQualification: null,
  requiredSkills: [],
  postingDate: null,
  closingDate: null,
  jobDescription: null,
  remoteStatus: null,
})

export const hasOfficialAboutPageSignal = (html) => {
  const page = String(html ?? '')

  return (
    /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/mudrex\.com\/about-us\/?["']/i.test(page)
    || /join our growing team/i.test(page)
  )
    && /view open roles/i.test(page)
    && page.includes(CAREERS_BOARD_URL)
    && /mudrex/i.test(page)
}

export const hasOfficialBoardSignal = (html) => {
  const page = String(html ?? '')

  return /og:site_name["']?\s+content=["']Manatal["']/i.test(page)
    && /jobs at mudrex/i.test(page)
    && /future of crypto/i.test(page)
    && /powered by[\s\S]*manatal/i.test(page)
}

export const extractListings = (html) => {
  const jobs = []

  for (const articleMatch of String(html ?? '').matchAll(
    /<article\b[^>]*class=["'][^"']*job-card[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi,
  )) {
    const articleHtml = articleMatch[1]
    const anchors = getAnchors(articleHtml)
    const detailAnchor = anchors.find((anchor) =>
      /\bjob-title-link\b/i.test(anchor.attrs)
      && /\/jobs\/[0-9a-z-]+/i.test(anchor.attrs),
    )
    const applyAnchor = anchors.find((anchor) =>
      /data-type=["']apply["']/i.test(anchor.attrs)
      || /^apply now$/i.test(stripTags(anchor.innerHtml) || ''),
    )

    if (!detailAnchor) continue

    const title = getAttribute(detailAnchor.attrs, 'data-job-title') || stripTags(detailAnchor.innerHtml)
    if (!title || /talent community/i.test(title)) continue

    const jobId = getAttribute(detailAnchor.attrs, 'data-job-id')
    const sourceUrl = toAbsoluteUrl(getAttribute(detailAnchor.attrs, 'href'))
    const applyUrl = toAbsoluteUrl(getAttribute(applyAnchor?.attrs, 'href'))
    const jobDetailsMatch = articleHtml.match(
      /<ul\b[^>]*aria-label=["']Job details["'][^>]*>([\s\S]*?)<\/ul>/i,
    )
    const location = getTextListItems(jobDetailsMatch?.[1])[0] || null
    const city = getAttribute(detailAnchor.attrs, 'data-job-city') || toCity(location)
    const country = getAttribute(detailAnchor.attrs, 'data-job-country') || inferCountry(location)

    if (country !== 'India') continue

    jobs.push(buildEmptyJobShape({
      title,
      location,
      city,
      country,
      jobId,
      sourceUrl,
      applyUrl,
    }))
  }

  return jobs
}

export const extractJobDetail = (html, listing = {}) => {
  const title = stripTags(
    String(html ?? '').match(/<h[1-6]\b[^>]*class=["'][^"']*single-job-title[^"']*["'][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1],
  ) || listing.title || null
  const detailItems = extractJobDetailListItems(html)
  const location = detailItems[0] || listing.location || null
  const employmentType = normalizeEmploymentType(detailItems[1])
  const remoteStatus = normalizeRemoteStatus(detailItems[2])
  const description = extractDescription(html)
  const applyAnchor = getAnchors(html).find((anchor) =>
    /^apply now$/i.test(stripTags(anchor.innerHtml) || ''),
  )
  const applyUrl = listing.applyUrl || toAbsoluteUrl(getAttribute(applyAnchor?.attrs, 'href'), listing.sourceUrl)

  return {
    ...buildEmptyJobShape({
      title,
      location,
      city: listing.city || toCity(location),
      country: listing.country || inferCountry(location),
      jobId: listing.jobId,
      sourceUrl: listing.sourceUrl,
      applyUrl,
    }),
    title,
    location,
    city: listing.city || toCity(location),
    country: listing.country || inferCountry(location),
    employmentType,
    jobDescription: description,
    remoteStatus,
  }
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createMudrexScraper = ({ maxJobs = null } = {}) => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString(), signal } = {}) {
    const read = async url => {
      signal?.throwIfAborted()
      const html = await fetchText(url, { signal })
      signal?.throwIfAborted()
      return html
    }
    const aboutHtml = await read(ABOUT_URL)
    if (!hasOfficialAboutPageSignal(aboutHtml)) {
      throw new Error('Mudrex about page no longer matches the verified first-party public surface')
    }

    const boardHtml = await read(CAREERS_BOARD_URL)
    if (!hasOfficialBoardSignal(boardHtml)) {
      throw new Error('Mudrex public Manatal board no longer matches the verified public surface')
    }

    const listings = extractListings(boardHtml)
    const selectedListings = maxJobs ? listings.slice(0, maxJobs) : listings
    const jobs = []

    for (const listing of selectedListings) {
      let job = listing

      try {
        const detailHtml = await read(listing.sourceUrl)
        job = {
          ...extractJobDetail(detailHtml, listing),
          publicExperienceChecked: true,
        }
      } catch {
        signal?.throwIfAborted()
        // The board listing remains authoritative even when a detail page transiently rate-limits.
        job = {
          ...listing,
          publicExperienceChecked: false,
        }
      }

      jobs.push({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createMudrexScraper().run(options)

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
