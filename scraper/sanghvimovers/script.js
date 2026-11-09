import https from 'node:https'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

import { SANGHVI_MOVERS_CATALOG } from './catalog.js'
import {
  createBrowserTextFallback,
  defaultShouldUseBrowserTextFallback,
} from '../../scraper-support/shared/browserTextFallback.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SANGHVI_MOVERS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const LABEL_ALIASES = {
  title: ['Job Title :', 'Position:'],
  description: ['Job Description :', 'Job Summary:'],
  skills: ['Key Skills :', 'Must have skills'],
  responsibilities: ['Roles & Responsibilities :', 'Key Responsibilities :', 'Job Role'],
  experience: ['Work Experience (Min & Max in years) :', 'Experience:'],
  qualification: ['Qualification :', 'Education :'],
  location: ['Job Location :', 'Location:'],
  positions: ['No. of Positions :'],
  employmentType: ['Job Type:'],
  reportsTo: ['Reports To:'],
}

const LABELS = Object.values(LABEL_ALIASES).flat()

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&ndash;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\u00a0/g, ' ')

const normalizeString = (value) => {
  if (value == null) return null
  const normalized = decodeHtmlEntities(value).replace(/\s+/g, ' ').trim()
  return normalized || null
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const slugify = (value) => normalizeString(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  || 'job'

const htmlToText = (html = '') => decodeHtmlEntities(String(html ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<(br|\/p|\/div|\/section|\/article|\/main|\/body|\/html|\/h[1-6]|\/ol|\/ul|\/li)\b[^>]*>/gi, '\n')
  .replace(/<(p|div|section|article|main|body|html|h[1-6]|ol|ul|li)\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\r/g, '')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n[ \t]+/g, '\n')
  .replace(/\n{2,}/g, '\n')
  .trim()

const extractRawField = (block, label) => {
  const otherLabels = LABELS.filter((item) => item !== label).map((item) => escapeRegExp(item))
  const pattern = new RegExp(
    `${escapeRegExp(label)}\\s*([\\s\\S]*?)(?=\\n(?:${otherLabels.join('|')})|$)`,
    'i',
  )
  const value = pattern.exec(block)?.[1] ?? null
  return value == null ? null : String(value).trim()
}

const extractField = (block, label) => normalizeString(extractRawField(block, label))

const extractFirstAvailableField = (block, labels = []) => {
  for (const label of labels) {
    const value = extractField(block, label)
    if (value) return value
  }

  return null
}

const extractListField = (block, label) => (extractRawField(block, label) || '')
  .split('\n')
  .map((item) => normalizeString(item))
  .filter(Boolean)

const extractFirstAvailableListField = (block, labels = []) => {
  for (const label of labels) {
    const values = extractListField(block, label)
    if (values.length > 0) return values
  }

  return []
}

const buildJobId = (title, location) => `${slugify(title)}-${slugify(location || 'india')}`

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

export const defaultFetchText = async (url, {
  fetchImpl = fetch,
  lenientFetchText = null,
  timeoutMs = 15000,
} = {}) => {
  try {
    const response = await fetchImpl(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: createTimeoutSignal(timeoutMs),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`)
    }

    return response.text()
  } catch (error) {
    if (!isCertificateError(error)) {
      throw error
    }

    const fetchLenientText = lenientFetchText || fetchTextIgnoringTlsErrors
    return fetchLenientText(url, { timeoutMs })
  }
}

const shouldUseBrowserFallback = (error) => {
  const message = String(error?.message ?? error ?? '')
  const causeMessage = String(error?.cause?.message ?? '')
  const causeCode = String(error?.cause?.code ?? '')
  const combined = `${message} ${causeCode} ${causeMessage}`

  return defaultShouldUseBrowserTextFallback(error)
    || /unable to verify the first certificate|certificate|ssl|tls|trust relationship|unable_to_verify_leaf_signature/i.test(combined)
}

const isCertificateError = (error) => {
  const message = String(error?.message ?? error ?? '')
  const causeMessage = String(error?.cause?.message ?? '')
  const causeCode = String(error?.cause?.code ?? '')
  const combined = `${message} ${causeCode} ${causeMessage}`

  return /unable to verify the first certificate|certificate|ssl|tls|trust relationship|unable_to_verify_leaf_signature/i.test(combined)
}

const fetchTextIgnoringTlsErrors = async (url, {
  timeoutMs = 15000,
  maxRedirects = 5,
} = {}) => {
  if (maxRedirects < 0) {
    throw new Error(`Too many redirects for ${url}`)
  }

  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      rejectUnauthorized: true,
      signal: createTimeoutSignal(timeoutMs),
    }, (response) => {
      const statusCode = response.statusCode ?? 0

      if ([301, 302, 303, 307, 308].includes(statusCode) && response.headers.location) {
        response.resume()
        const nextUrl = new URL(response.headers.location, url).toString()
        fetchTextIgnoringTlsErrors(nextUrl, {
          timeoutMs,
          maxRedirects: maxRedirects - 1,
        }).then(resolve, reject)
        return
      }

      if (statusCode >= 400) {
        response.resume()
        reject(new Error(`HTTP ${statusCode} for ${url}`))
        return
      }

      const encoding = String(response.headers['content-encoding'] ?? '').toLowerCase()
      let stream = response

      if (encoding.includes('br')) {
        stream = response.pipe(zlib.createBrotliDecompress())
      } else if (encoding.includes('gzip')) {
        stream = response.pipe(zlib.createGunzip())
      } else if (encoding.includes('deflate')) {
        stream = response.pipe(zlib.createInflate())
      }

      const chunks = []
      stream.on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      })
      stream.on('error', reject)
      stream.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf8'))
      })
    })

    request.on('error', reject)
    request.end()
  })
}

const extractBlocks = (html = '') => {
  const text = htmlToText(html)
  const startIndex = text.indexOf('Join Our Team')
  const jobsText = startIndex >= 0 ? text.slice(startIndex) : text

  return jobsText
    .split(/\bApply Now\b/i)
    .map((block) => block.trim())
    .filter((block) => (
      /Job Title\s*:/i.test(block)
      || /Position\s*:/i.test(block)
      || (/Location\s*:/i.test(block) && /(?:Job\s*Summary|Job\s*Role|Key Responsibilities)/i.test(block))
    ))
}

export const hasVerifiedCareersPageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const text = htmlToText(rawHtml)

  return /<title[^>]*>\s*Careers at Sanghvi Movers\s*\|\s*Join Asia(?:&#x27;|&#0*39;|'|’)s Largest Crane Leader\s*<\/title>/i.test(rawHtml)
    && text.includes('Join Our Team')
}

export const hasPublicJobSignals = (html = '') => {
  const text = htmlToText(html)
  return /\bApply Now\b/i.test(text)
    && (
      /Job Title\s*:/i.test(text)
      || /Position\s*:/i.test(text)
      || /Job\s*Role/i.test(text)
    )
}

export const extractStaticJobs = (
  html,
  {
    scrapedAt = new Date().toISOString(),
  } = {},
) => extractBlocks(html)
  .map((block) => {
    const title = extractFirstAvailableField(block, LABEL_ALIASES.title)
      || normalizeString(block.split('\n')[0])
    const location = extractFirstAvailableField(block, LABEL_ALIASES.location) || 'India'
    const jobId = buildJobId(title, location)

    if (!title) return null

    const requiredSkills = [
      ...extractFirstAvailableListField(block, LABEL_ALIASES.skills),
      ...extractFirstAvailableListField(block, LABEL_ALIASES.responsibilities),
    ]

    return {
      title,
      company: COMPANY,
      department: null,
      location,
      city: null,
      state: null,
      country: 'India',
      workplaceType: null,
      jobId,
      requisitionId: jobId,
      sourceUrl: CAREERS_URL,
      applyUrl: CAREERS_URL,
      link: CAREERS_URL,
      source: SOURCE,
      employmentType: extractFirstAvailableField(block, LABEL_ALIASES.employmentType),
      experienceRequired: extractFirstAvailableField(block, LABEL_ALIASES.experience),
      minimumQualification: extractFirstAvailableField(block, LABEL_ALIASES.qualification),
      preferredQualification: null,
      requiredSkills,
      postingDate: null,
      closingDate: null,
      jobDescription: extractFirstAvailableField(block, LABEL_ALIASES.description),
      scrapedAt,
    }
  })
  .filter(Boolean)

export const createSanghviMoversScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchBrowserText = undefined,
  } = {}) {
    const browserFallback = createBrowserTextFallback({
      fetchText,
      fetchBrowserText,
      userAgent: USER_AGENT,
      shouldUseBrowserFallback,
    })

    try {
      const careersHtml = await browserFallback.fetchText(CAREERS_URL)
      if (!hasVerifiedCareersPageSignal(careersHtml)) {
        throw new Error('Verified Sanghvi Movers careers page changed materially')
      }

      if (!hasPublicJobSignals(careersHtml)) {
        throw new Error('Verified Sanghvi Movers public jobs surface changed materially')
      }

      const jobs = extractStaticJobs(careersHtml, {
        scrapedAt: now(),
      })

      if (jobs.length === 0) {
        throw new Error('Verified Sanghvi Movers public jobs surface changed materially')
      }

      return jobs
    } finally {
      await browserFallback.close()
    }
  },
})

export const run = async (options = {}) => createSanghviMoversScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
