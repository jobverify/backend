import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserTextFallback } from '../../scraper-support/shared/browserTextFallback.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'

import { EASYREWARDZ_SOFTWARE_SERVICES_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_API_URL = 'https://easyrewardz.com/wp-json/wp/v2/awsm_job_openings?per_page=100'

const defaultFetchText = (url, options = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    ...(options.headers || {}),
  },
  label: SOURCE,
  timeoutMs: options.timeoutMs || 15000,
})

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#8211;|&#x2013;|&ndash;/gi, '\u2013')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const extractVisibleText = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol|\/section|\/article)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<div\b[^>]*>/gi, '\n')
    .replace(/<section\b[^>]*>/gi, '\n')
    .replace(/<article\b[^>]*>/gi, '\n')
    .replace(/<h[1-6]\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return normalized.replace(/\bfull\s*time\b/i, 'Full-time')
}

const formatLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return 'India'
  if (/\bindia\b/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const normalizeLinkKey = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    const url = new URL(normalized)
    url.hash = ''
    return url.toString().replace(/\/+$/, '').toLowerCase()
  } catch {
    return normalized.replace(/\/+$/, '').toLowerCase()
  }
}

const getLastPathSegment = (url) => {
  try {
    return new URL(url).pathname.split('/').filter(Boolean).at(-1) ?? null
  } catch {
    return null
  }
}

export const hasOfficialCareersSignals = (html = '') => {
  const normalized = stripTags(html) || ''

  return normalized.includes('Careers')
    && normalized.includes('All Job Category')
    && normalized.includes('All Job Location')
    && normalized.includes('Customer Success')
    && normalized.includes('More Details')
}

const extractJobCards = (html = '') => {
  const cards = []
  const pattern = /<a[^>]+href="([^"]+)"[^>]*class="awsm-job-item"[^>]*>[\s\S]*?<h2[^>]*class="awsm-job-post-title"[^>]*>([\s\S]*?)<\/h2>[\s\S]*?awsm-job-specification-job-type[^>]*>[\s\S]*?<span[^>]*class="awsm-job-specification-term"[^>]*>([\s\S]*?)<\/span>[\s\S]*?awsm-job-specification-job-location[^>]*>[\s\S]*?<span[^>]*class="awsm-job-specification-term"[^>]*>([\s\S]*?)<\/span>/gi

  for (const match of html.matchAll(pattern)) {
    const applyUrl = normalizeWhitespace(match[1])
    const title = normalizeWhitespace(match[2])
    const employmentType = normalizeEmploymentType(match[3])
    const city = normalizeWhitespace(match[4])

    if (!applyUrl || !title || !city) continue

    cards.push({
      title,
      city,
      location: formatLocation(city),
      employmentType,
      applyUrl,
      sourceUrl: applyUrl,
      requisitionId: getLastPathSegment(applyUrl),
    })
  }

  return cards
}

const buildJobId = ({ title, city, requisitionId }) =>
  [slugify(title), slugify(city), slugify(requisitionId)].filter(Boolean).join('-')

const extractDetailDescription = (html = '') => {
  const visibleText = extractVisibleText(html)
  if (!visibleText) return null

  const beforeApply = visibleText.split(/apply for this position/i)[0]?.trim() || ''
  return beforeApply || null
}

const inferExperienceFromDescription = (jobDescription) => {
  const normalizedDescription = normalizeWhitespace(jobDescription)
  if (!normalizedDescription) return null

  const experienceProfile = extractJobFilterSignals({
    description: normalizedDescription,
  })?.experienceProfile
  const evidence = normalizeWhitespace(experienceProfile?.evidence)

  if (!evidence || experienceProfile?.confidence !== 'high') {
    return null
  }

  return (
    experienceProfile.minimumYears === 0 && experienceProfile.maximumYears === 0
      ? 'No experience required'
      : evidence
  )
}

export const enrichJobFromDetailPage = (job, detailHtml = '') => {
  const jobDescription = extractDetailDescription(detailHtml) || job.jobDescription || null

  return {
    ...job,
    jobDescription,
    experienceRequired: inferExperienceFromDescription(jobDescription) || job.experienceRequired || null,
    publicExperienceChecked: Boolean(jobDescription),
  }
}

export const extractApiJobRecords = (payload = []) => {
  let rows = payload

  if (typeof payload === 'string') {
    try {
      rows = JSON.parse(payload)
    } catch {
      return []
    }
  }

  if (!Array.isArray(rows)) {
    return []
  }

  return rows
    .map((row) => {
      const link = normalizeWhitespace(row?.link)
      const title = stripTags(row?.title?.rendered)
      const jobDescription = extractDetailDescription(row?.content?.rendered)

      if (!link || !title) {
        return null
      }

      return {
        link,
        title,
        postingDate: normalizeWhitespace(row?.date),
        jobDescription,
        experienceRequired: inferExperienceFromDescription(jobDescription),
        publicExperienceChecked: Boolean(jobDescription),
      }
    })
    .filter(Boolean)
}

export const enrichJobFromApiRecord = (job, apiRecord = {}) => ({
  ...job,
  title: apiRecord.title || job.title,
  postingDate: apiRecord.postingDate || job.postingDate || null,
  jobDescription: apiRecord.jobDescription || job.jobDescription || null,
  experienceRequired: apiRecord.experienceRequired || job.experienceRequired || null,
  publicExperienceChecked: apiRecord.publicExperienceChecked === true || job.publicExperienceChecked === true,
})

const shouldUseBrowserFallback = (error) =>
  /HTTP (?:403|429|503)\b|limited by the site owner|timed out|timeout|aborted|fetch failed|blocked/i
    .test(String(error?.message ?? error ?? ''))

export const createEasyRewardzSoftwareServicesScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchBrowserText,
  } = {}) {
    const browserTextFallback = createBrowserTextFallback({
      fetchText,
      fetchBrowserText,
      userAgent: USER_AGENT,
      shouldUseBrowserFallback,
    })

    try {
      const careersHtml = await browserTextFallback.fetchText(CAREERS_URL, {
        headers: {
          Referer: 'https://easyrewardz.com/',
          Origin: 'https://easyrewardz.com',
        },
        referer: 'https://easyrewardz.com/',
        timeoutMs: 20000,
      })

      if (!hasOfficialCareersSignals(careersHtml)) {
        throw new Error('The verified EasyRewardz careers page no longer matches the trusted first-party jobs surface')
      }

      const scrapedAt = now()
      const jobs = []
      let apiRecordByUrl = new Map()

      try {
        const apiPayload = await browserTextFallback.fetchText(JOBS_API_URL, {
          headers: {
            Accept: 'application/json,text/plain,*/*',
            Referer: CAREERS_URL,
            Origin: 'https://easyrewardz.com',
          },
          referer: CAREERS_URL,
          timeoutMs: 20000,
        })

        apiRecordByUrl = new Map(
          extractApiJobRecords(apiPayload).map((record) => [normalizeLinkKey(record.link), record]),
        )
      } catch {
        apiRecordByUrl = new Map()
      }

      for (const card of extractJobCards(careersHtml)) {
        const job = {
          title: card.title,
          company: COMPANY,
          location: card.location,
          city: card.city,
          country: 'India',
          sourceUrl: card.sourceUrl,
          applyUrl: card.applyUrl,
          link: card.applyUrl,
          jobId: buildJobId(card),
          requisitionId: card.requisitionId,
          employmentType: card.employmentType,
          remoteStatus: 'On-site',
          jobDescription: card.title,
          source: SOURCE,
          scrapedAt,
          companyCareerPage: CAREERS_URL,
          companyDomain: PROVIDER_METADATA.companyDomain,
          atsPlatform: PROVIDER_METADATA.atsPlatform,
        }

        const apiRecord = apiRecordByUrl.get(normalizeLinkKey(card.applyUrl))
        if (apiRecord) {
          jobs.push(enrichJobFromApiRecord(job, apiRecord))
          continue
        }

        try {
          jobs.push(enrichJobFromDetailPage(
            job,
            await browserTextFallback.fetchText(card.applyUrl, {
              headers: {
                Referer: CAREERS_URL,
                Origin: 'https://easyrewardz.com',
              },
              referer: CAREERS_URL,
              timeoutMs: 20000,
            }),
          ))
        } catch {
          jobs.push(job)
        }
      }

      return jobs
    } finally {
      await browserTextFallback.close()
    }
  },
})

export const run = async (options = {}) => createEasyRewardzSoftwareServicesScraper(options).run(options)

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
