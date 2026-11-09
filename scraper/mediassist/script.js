import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'mediassist'
export const COMPANY = 'Medi Assist Insurance TPA Pvt. Ltd.'
export const CAREERS_URL = 'https://www.mediassist.in/careers/'

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = String(value).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
  return normalized || null
}

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<\/h3>/gi, ': ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, ' ')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/::+/g, ':'),
)

const decodeCloudflareEmail = (value) => {
  const encoded = normalizeWhitespace(value)
  if (!encoded || !/^[0-9a-f]+$/i.test(encoded) || encoded.length < 4) return null

  const key = Number.parseInt(encoded.slice(0, 2), 16)
  let email = ''
  for (let index = 2; index < encoded.length; index += 2) {
    email += String.fromCharCode(Number.parseInt(encoded.slice(index, index + 2), 16) ^ key)
  }
  return email || null
}

const extractText = (pattern, html) => normalizeWhitespace((String(html ?? '').match(pattern) || [])[1])

const extractCareersSection = (html) => {
  const text = String(html ?? '')
  const start = text.indexOf('Jobs at Medi Assist')
  if (start === -1) return null
  return text.slice(start)
}

export const hasOfficialCareersSignal = (html) => {
  const text = String(html ?? '')
  const canonicalPattern = /<link[^>]+(?:rel=["']canonical["'][^>]+href=["']https:\/\/(?:www\.)?mediassist\.in\/careers\/?["']|href=["']https:\/\/(?:www\.)?mediassist\.in\/careers\/?["'][^>]+rel=["']canonical["'])/i

  return (
    canonicalPattern.test(text)
    && /Jobs at Medi Assist/i.test(text)
    && /Medi Assist/i.test(text)
  )
}

export const extractOpenings = (html) => {
  const careersSection = extractCareersSection(html)
  if (!careersSection) return []

  return [...careersSection.matchAll(
    /<a href="(\/career\/[^"]+\/)" class="block[^>]*>([^<]+)<\/a>/g,
  )]
    .map((match) => ({
      title: normalizeWhitespace(match[2]),
      sourceUrl: new URL(match[1], CAREERS_URL).toString(),
    }))
    .filter((job) => job.title && job.sourceUrl)
}

const extractSummaryFields = (html) => {
  const content = String(html ?? '')
  const end = content.indexOf('<div class="nuxt-content">')
  const summaryHtml = end >= 0 ? content.slice(0, end) : content
  return [...summaryHtml.matchAll(/<div class="flex items-center gap-1">[\s\S]*?<p>([^<]+)<\/p>/g)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)
}

const extractJobDescription = (html) => {
  const match = String(html ?? '').match(/<div class="nuxt-content">([\s\S]*?)<\/div>\s*<\/div>\s*<\/main>/i)
  if (!match) return null
  return stripTags(match[1])
}

const extractApplyUrl = (html) => {
  const encoded = String(html ?? '').match(/data-cfemail="([0-9a-f]+)"/i)?.[1]
  const email = decodeCloudflareEmail(encoded)
  return email ? `mailto:${email}` : null
}

const deriveCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  if (/[\/,]/.test(normalized)) return null
  const city = normalized.replace(/\s*-\s*India$/i, '').trim()
  return city || null
}

export const extractJobDetail = (html, sourceUrl) => {
  const title = extractText(/<h1[^>]*>([^<]+)<\/h1>/i, html) || extractText(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i, html)
  const [location, experienceRequired, minimumQualification] = extractSummaryFields(html)
  const jobDescription = extractJobDescription(html)
  const applyUrl = extractApplyUrl(html)

  return {
    title,
    location,
    city: deriveCity(location),
    experienceRequired,
    minimumQualification,
    jobDescription,
    sourceUrl,
    applyUrl,
    jobId: slugify(sourceUrl?.split('/career/')[1] || title),
    requisitionId: slugify(sourceUrl?.split('/career/')[1] || title),
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createMediAssistScraper = ({ fetchText = defaultFetchText } = {}) => ({
  run: async ({ fetchText: overrideFetchText } = {}) => {
    const fetchImpl = overrideFetchText || fetchText
    const careersHtml = await fetchImpl(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Medi Assist careers page no longer matches the verified official public jobs surface')
    }

    const openings = extractOpenings(careersHtml)
    const jobs = []

    for (const opening of openings) {
      const detailHtml = await fetchImpl(opening.sourceUrl)
      const detail = extractJobDetail(detailHtml, opening.sourceUrl)
      if (!detail.title) {
        throw new Error(`Medi Assist detail page no longer exposes a title for ${opening.sourceUrl}`)
      }

      jobs.push({
        ...detail,
        company: COMPANY,
        source: SOURCE,
        companyCareerPage: CAREERS_URL,
        atsPlatform: 'official-company-careers',
        link: detail.applyUrl || detail.sourceUrl,
        preferredQualification: null,
        jobDescription: detail.jobDescription,
        scrapedAt: new Date().toISOString(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createMediAssistScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Medi Assist scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
