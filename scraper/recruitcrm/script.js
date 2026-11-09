import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'recruitcrm'
export const COMPANY = 'Recruit CRM'
export const CAREERS_URL = 'https://recruitcrm.io/careers/'
export const JOBS_URL = 'https://careers.recruitcrm.io/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const EMPLOYMENT_TYPE_MAP = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  CONTRACT: 'Contract',
  INTERN: 'Internship',
  INTERNSHIP: 'Internship',
}

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(value)

const unique = (values) => [...new Set(values.filter(Boolean))]

const toDetailUrl = (slug) => new URL(String(slug ?? '').replace(/^\/+/, ''), JOBS_URL).href

const toIsoTimestamp = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return null

  const milliseconds = numeric > 1e12 ? numeric : numeric * 1000
  return new Date(milliseconds).toISOString()
}

const mapEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value).replace(/\s+/g, '_').toUpperCase()
  return EMPLOYMENT_TYPE_MAP[normalized] || null
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /join the dream team/i.test(page)
    && /recruit crm is a fully remote company/i.test(page)
    && /href=["']https:\/\/careers\.recruitcrm\.io\/?["']/i.test(page)
}

export const pageLinksToVerifiedBoard = (html) => (
  /href=["']https:\/\/careers\.recruitcrm\.io\/?["']/i.test(String(html ?? ''))
)

export const extractBoardUuid = (html) => {
  const page = String(html ?? '')
  const companyMatch = page.match(/Recruit CRM/i)
  const uuidMatch = page.match(/uuid[^0-9a-f]+([0-9a-f-]{36})/i)

  if (!companyMatch || !uuidMatch) return null
  return uuidMatch[1]
}

const extractScriptUrls = (html) => (
  [...String(html ?? '').matchAll(/<script[^>]+src=["']([^"']+\.js[^"']*)["']/gi)]
    .map((match) => {
      try {
        return new URL(match[1], JOBS_URL).href
      } catch {
        return null
      }
    })
    .filter(Boolean)
)

const prioritizeBundleUrls = (urls) => {
  const layoutBundles = []
  const otherBundles = []

  for (const url of urls) {
    if (/\/_next\/static\/chunks\/app\/layout-[^/]+\.js(?:[?#].*)?$/i.test(url)) {
      layoutBundles.push(url)
    } else {
      otherBundles.push(url)
    }
  }

  return [...layoutBundles, ...otherBundles]
}

export const extractGetJobsActionIdFromBundle = (bundleText) => {
  const match = String(bundleText ?? '').match(
    /createServerReference\)?\("([0-9a-f]+)"[^)]*"getJobs"\)/i,
  )

  return match?.[1] ?? null
}

export const discoverGetJobsActionId = async (
  boardShellHtml,
  { fetchAssetText },
) => {
  const bundleUrls = prioritizeBundleUrls(extractScriptUrls(boardShellHtml))

  for (const bundleUrl of bundleUrls) {
    const actionId = extractGetJobsActionIdFromBundle(await fetchAssetText(bundleUrl))
    if (actionId) return actionId
  }

  throw new Error('Recruit CRM getJobs action id changed or disappeared')
}

const parseActionEnvelope = (responseText) => {
  const match = String(responseText ?? '').match(/(?:^|\n)1:(\{[\s\S]*\})\s*$/)
  if (!match) {
    throw new Error('Recruit CRM listings action response changed')
  }

  return JSON.parse(match[1])
}

export const extractListingsFromActionResponse = (responseText) => {
  const payload = parseActionEnvelope(responseText)
  const rows = Array.isArray(payload?.data?.data) ? payload.data.data : []

  return rows.map((row) => ({
    jobId: normalizeWhitespace(row?.job_id) || null,
    slug: normalizeWhitespace(row?.job_slug) || null,
    title: normalizeWhitespace(row?.name) || null,
    city: normalizeWhitespace(row?.city) || null,
    locality: normalizeWhitespace(row?.locality) || null,
    state: normalizeWhitespace(row?.state) || null,
    country: normalizeWhitespace(row?.country) || null,
    employmentType: normalizeWhitespace(row?.job_type) || null,
    department: normalizeWhitespace(row?.job_category) || null,
    postingDate: toIsoTimestamp(row?.updated_on),
  })).filter((job) => job.jobId && job.slug && job.title)
}

const decodeEscapedJsonString = (value) => JSON.parse(`"${value}"`)

const extractInlineJobPostingJson = (html) => {
  const page = String(html ?? '')

  const scriptTagMatch = page.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i,
  )
  if (scriptTagMatch) return scriptTagMatch[1]

  const nextScriptMatch = page.match(
    /"type":"application\/ld\+json","children":"((?:\\.|[^"])*)"/i,
  )
  if (nextScriptMatch) return decodeEscapedJsonString(nextScriptMatch[1])

  throw new Error('Recruit CRM job detail JSON-LD changed')
}

export const extractJobPostingJsonLd = (html) => {
  const serialized = extractInlineJobPostingJson(html)
  const parsed = JSON.parse(serialized)

  return {
    title: normalizeWhitespace(parsed?.title) || null,
    description: parsed?.description ?? null,
    location: {
      city: normalizeWhitespace(parsed?.jobLocation?.address?.addressLocality) || null,
      country: normalizeWhitespace(parsed?.jobLocation?.address?.addressCountry) || null,
    },
    employmentType: normalizeWhitespace(parsed?.employmentType) || null,
    validThrough: normalizeWhitespace(parsed?.validThrough) || null,
    identifier: normalizeWhitespace(parsed?.identifier?.value) || null,
  }
}

const formatLocation = (listing, detail) => {
  const parts = unique([
    normalizeWhitespace(listing?.city),
    normalizeWhitespace(listing?.locality),
    normalizeWhitespace(listing?.state),
    normalizeWhitespace(detail?.location?.city),
    normalizeWhitespace(detail?.location?.country),
  ])

  return parts.length ? parts.join(', ') : null
}

const isIndiaJob = (listing, detail) => {
  const haystack = [
    listing?.title,
    listing?.city,
    listing?.locality,
    listing?.state,
    listing?.country,
    detail?.location?.city,
    detail?.location?.country,
  ].filter(Boolean).join(' ')

  return /\bindia\b/i.test(haystack)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchAssetText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/javascript,text/javascript,*/*;q=0.8',
  },
  label: `${SOURCE}-asset`,
  timeoutMs: 15000,
})

const defaultFetchAction = async (
  boardUuid,
  { boardShellHtml, fetchAssetText = defaultFetchAssetText },
) => {
  const actionId = await discoverGetJobsActionId(boardShellHtml, { fetchAssetText })
  const response = await fetch(JOBS_URL, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/x-component',
      'Content-Type': 'text/plain;charset=UTF-8',
      'Next-Action': actionId,
    },
    body: JSON.stringify([boardUuid]),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for Recruit CRM listings action`)
  }

  return response.text()
}

export const createRecruitCrmScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchAssetText = defaultFetchAssetText,
    fetchAction = defaultFetchAction,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml) || !pageLinksToVerifiedBoard(careersHtml)) {
      throw new Error('Recruit CRM official careers handoff changed; refusing to guess the public jobs surface')
    }

    const boardShellHtml = await fetchText(JOBS_URL)
    const boardUuid = extractBoardUuid(boardShellHtml)

    if (!boardUuid) {
      throw new Error('Recruit CRM public board uuid changed or disappeared')
    }

    const listings = extractListingsFromActionResponse(await fetchAction(boardUuid, {
      boardShellHtml,
      fetchAssetText,
    }))
    const hydratedJobs = await Promise.all(
      listings.map(async (listing) => {
        const sourceUrl = toDetailUrl(listing.slug)
        const detail = extractJobPostingJsonLd(await fetchText(sourceUrl))

        return {
          listing,
          detail,
          job: {
            title: detail.title || listing.title,
            company: COMPANY,
            location: formatLocation(listing, detail),
            city: listing.city || detail.location.city || null,
            country: detail.location.country || listing.country || null,
            jobId: listing.jobId,
            requisitionId: listing.slug,
            sourceUrl,
            applyUrl: sourceUrl,
            employmentType: mapEmploymentType(detail.employmentType || listing.employmentType),
            department: listing.department,
            experienceRequired: null,
            minimumQualification: null,
            preferredQualification: null,
            requiredSkills: [],
            postingDate: listing.postingDate,
            closingDate: detail.validThrough,
            jobDescription: stripTags(detail.description),
          },
        }
      }),
    )

    return hydratedJobs
      .filter(({ listing, detail }) => isIndiaJob(listing, detail))
      .map(({ job }) => job)
      .sort((left, right) => left.title.localeCompare(right.title))
  },
})

export const run = async (options = {}) => createRecruitCrmScraper().run(options)

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
