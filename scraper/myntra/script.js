import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { MYNTRA_CATALOG } from './catalog.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'
import { extractOfficialRecruitmentLinks } from '../../scripts/officialRecruitmentLinks.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = MYNTRA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_LANDING_URL = PROVIDER_METADATA.officialCareersLandingUrl
export const JOB_PORTAL_URL = PROVIDER_METADATA.companyCareerPage
export const PUBLIC_API_ORIGIN = 'https://io.spire2grow.com/ies/v1/p'
export const JOBS_DOMAIN = 'jobs.myntra.com'
export const DEFAULT_PAGE_SIZE = 6

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&amp;/gi, '&')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripHtml = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, ' ')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeIsoDate = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value).toISOString()
  const text = normalizeWhitespace(value)
  if (!text) return null

  const isoMatch = /^(\d{4}-\d{2}-\d{2})/.exec(text)
  return isoMatch ? isoMatch[1] : text
}

const isIndiaLocation = (value) => /(?:^|,\s*)india\s*$/i.test(value ?? '')

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return normalized.split(',')[0]?.trim() || normalized
}

const formatYears = (months) => {
  if (!Number.isFinite(months)) return null
  const years = months / 12
  return Number.isInteger(years) ? String(years) : String(Number(years.toFixed(1)))
}

const formatExperienceRange = (value = {}) => {
  const from = Number(value?.from)
  const to = Number(value?.to)
  const fromYears = formatYears(from)
  const toYears = formatYears(to)

  if (fromYears && toYears && fromYears !== toYears) {
    return `${fromYears}-${toYears} years`
  }
  if (fromYears && toYears && fromYears === toYears) {
    return `${fromYears} years`
  }
  if (fromYears) {
    return `${fromYears}+ years`
  }
  if (toYears) {
    return `Up to ${toYears} years`
  }

  return null
}

const buildPublicApiHeaders = ({ workspaceId } = {}) => ({
  Accept: 'application/json, text/plain, */*',
  Origin: 'https://jobs.myntra.com',
  Referer: JOB_PORTAL_URL,
  'User-Agent': USER_AGENT,
  ...(workspaceId ? { WorkspaceId: workspaceId } : {}),
})

const defaultFetchText = async (url, options = {}) => {
  const response = await fetch(url, {
    signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      ...(options.headers || {}),
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

const defaultFetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
    method: options.method || 'GET',
    headers: options.headers,
    body: options.body,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const buildWorkspaceBootstrapUrl = (domain = JOBS_DOMAIN) =>
  `${PUBLIC_API_ORIGIN}/workspaceId?domain=${encodeURIComponent(domain)}`

export const buildJobsCountUrl = () => `${PUBLIC_API_ORIGIN}/requisition/_count`

export const buildJobsSearchUrl = ({
  page = 1,
  size = DEFAULT_PAGE_SIZE,
  sortOrder = 'desc',
  sortField = 'postedOn',
} = {}) =>
  `${PUBLIC_API_ORIGIN}/requisition/_search?page=${page}&size=${size}&selectedSortOrder=${sortOrder}&selectedSortField=${sortField}`

export const buildJobUrl = (displayId, workspaceId) =>
  `https://jobs.myntra.com/jobs/${encodeURIComponent(displayId)}?tenantId=${encodeURIComponent(workspaceId)}&ref=job-share-direct-link`

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')

  return extractOfficialRecruitmentLinks(rawHtml, HOMEPAGE_URL).some(url => url.href === CAREERS_LANDING_URL)
    && /myntra/i.test(rawHtml)
}

export const hasVerifiedCareersLandingSignal = (html) => {
  const rawHtml = String(html ?? '')

  return /explore careers/i.test(rawHtml)
    && extractOfficialRecruitmentLinks(rawHtml, CAREERS_LANDING_URL).some(url => url.href === JOB_PORTAL_URL)
}

export const hasVerifiedJobsPortalSignal = (html) => {
  const rawHtml = String(html ?? '')

  return /<title>\s*Career Portal\s*<\/title>/i.test(rawHtml)
    && /flutter/i.test(rawHtml)
}

export const extractWorkspaceId = (value) => {
  const workspaceId = normalizeWhitespace(value)

  if (!/^MYNTRA-[A-Za-z0-9]+$/.test(workspaceId ?? '')) {
    throw new Error('Myntra verified public workspace ID no longer matches the expected contract')
  }

  return workspaceId
}

const assertNativePayload = payload => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload.success === false
    || payload.error || (Array.isArray(payload.errors) ? payload.errors.length : payload.errors)
    || (payload.status != null && payload.status !== 200)) throw new Error('Myntra native upstream error status')
}

export const extractTotalCount = (payload = {}) => {
  assertNativePayload(payload)
  const value = payload?.totalCount
  const totalCount = typeof value === 'number' ? value : typeof value === 'string' && /^(?:0|[1-9]\d*)$/.test(value) ? Number(value) : NaN

  if (!Number.isSafeInteger(totalCount) || totalCount < 0) {
    throw new Error('Myntra verified public requisition count no longer exposes totalCount')
  }

  return totalCount
}

export const extractIndiaJobsFromSearchPayload = (
  payload = {},
  {
    workspaceId,
    scrapedAt = new Date().toISOString(),
  } = {},
) => {
  if (!Array.isArray(payload?.entities)) {
    throw new Error('Myntra verified public requisition search no longer exposes entities')
  }

  return payload.entities
    .map((entity) => {
      const location = (Array.isArray(entity?.jobLocation) ? entity.jobLocation : [])
        .map(item => normalizeWhitespace(item?.fqLocationName)).filter(isIndiaLocation).join('; ') || null
      const displayId = normalizeWhitespace(entity?.displayId)
      const requisitionId = normalizeWhitespace(entity?.id)
      const effectiveWorkspaceId = normalizeWhitespace(workspaceId)
        || normalizeWhitespace(entity?.workspaceId)
      const status = normalizeWhitespace(entity?.jobStatus?.statusCode || entity?.jobPosting?.status)

      if (
        !displayId
        || !requisitionId
        || !effectiveWorkspaceId
        || !location
        || !isIndiaLocation(location)
        || (status && !/^(open|active)$/i.test(status))
      ) {
        return null
      }

      const roleDescription = typeof entity?.jobDescription === 'string' && hasSourceDescription({ jobDescription: entity.jobDescription })
        ? stripHtml(entity.jobDescription) : null
      const jobDescription = roleDescription ? [
        roleDescription,
        stripHtml(entity?.aboutCompany),
      ]
        .filter(Boolean)
        .join(' ') : null

      const requiredSkills = [...new Set(
        (Array.isArray(entity?.skills) ? entity.skills : [])
          .map((skill) => normalizeWhitespace(skill?.skill))
          .filter(Boolean),
      )]

      const link = buildJobUrl(displayId, effectiveWorkspaceId)

      return {
        title: normalizeWhitespace(entity?.jobTitle),
        company: COMPANY,
        department: normalizeWhitespace(entity?.departmentName),
        location,
        city: extractCity(location),
        country: 'India',
        workplaceType: normalizeWhitespace(entity?.jobType),
        jobId: displayId,
        requisitionId,
        sourceUrl: link,
        applyUrl: link,
        link,
        employmentType: normalizeWhitespace(entity?.employmentType),
        experienceRequired: formatExperienceRange(entity?.requiredExperienceInMonths),
        requiredSkills,
        postingDate: normalizeIsoDate(
          entity?.jobPosting?.startDate || entity?.createdOn || entity?.updatedOn,
        ),
        jobDescription: jobDescription || null,
        source: SOURCE,
        scrapedAt,
      }
    })
    .filter((job) => job?.title && job?.jobId)
}

export const createMyntraScraper = ({
  pageSize = DEFAULT_PAGE_SIZE,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
    maxPages = 100,
    maxJobs = null,
    signal,
  } = {}) {
    if (!Number.isInteger(pageSize) || pageSize < 1 || !Number.isInteger(maxPages) || maxPages < 1
      || (maxJobs != null && (!Number.isInteger(maxJobs) || maxJobs < 1))) throw new Error('Myntra positive pagination limits required')
    const request = async (fetcher, url, options = {}) => {
      signal?.throwIfAborted()
      const result = await fetcher(url, { ...options, signal })
      signal?.throwIfAborted()
      return result
    }
    const homepageHtml = await request(fetchText, HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('The verified Myntra homepage no longer matches the known first-party careers link surface')
    }

    const careersLandingHtml = await request(fetchText, CAREERS_LANDING_URL)
    if (!hasVerifiedCareersLandingSignal(careersLandingHtml)) {
      throw new Error('The verified Myntra careers landing page no longer matches the known first-party jobs handoff')
    }

    const jobsPortalHtml = await request(fetchText, JOB_PORTAL_URL)
    if (!hasVerifiedJobsPortalSignal(jobsPortalHtml)) {
      throw new Error('The verified Myntra jobs portal no longer matches the known first-party public portal shell')
    }

    const workspaceId = extractWorkspaceId(
      await request(fetchText, buildWorkspaceBootstrapUrl(), {
        headers: buildPublicApiHeaders(),
      }),
    )

    let totalCount = null
    try {
      totalCount = extractTotalCount(
        await request(fetchJson, buildJobsCountUrl(), {
          method: 'GET',
          headers: buildPublicApiHeaders({ workspaceId }),
        }),
      )
    } catch {
      signal?.throwIfAborted()
      totalCount = null
    }

    const jobs = []
    const totalPages = totalCount != null
      ? Math.min(Math.max(1, Math.ceil(totalCount / pageSize)), maxPages)
      : maxPages
    const scrapedAt = now()
    const seen = new Set(), displayIds = new Set()
    let pagesFetched = 0, complete = false, limited = false, scopeKnown = true
    const regions = new Intl.DisplayNames(['en'], { type: 'region' })
    const knownCountries = new Set()
    for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b), name = regions.of(code)
      if (name !== code && !['ZZ', 'EU', 'UN', 'XA', 'XB', 'QO'].includes(code)) knownCountries.add(name.toLowerCase())
    }

    for (let page = 1; page <= totalPages; page += 1) {
      const payload = await request(fetchJson, buildJobsSearchUrl({ page, size: pageSize }), {
        method: 'GET',
        headers: buildPublicApiHeaders({ workspaceId }),
      })
      pagesFetched++
      assertNativePayload(payload)
      if (!Array.isArray(payload?.entities) || payload.entities.length > pageSize) throw new Error('Myntra malformed native inventory page')
      if (payload.total != null && (!Number.isSafeInteger(payload.total) || payload.total < 0
        || (totalCount != null && payload.total !== totalCount))) throw new Error('Myntra inconsistent native total')
      for (const entity of payload.entities) {
        if (typeof entity?.id !== 'string' || !entity.id.trim() || typeof entity.displayId !== 'string'
          || !/^\d+$/.test(entity.displayId) || seen.has(entity.id) || displayIds.has(entity.displayId)
          || typeof entity.jobTitle !== 'string' || !entity.jobTitle.trim()) throw new Error('Myntra missing or duplicate native identity')
        if (entity.workspaceId !== workspaceId) throw new Error('Myntra native workspace identity mismatch')
        seen.add(entity.id); displayIds.add(entity.displayId)
        if (!Array.isArray(entity.jobLocation) || !entity.jobLocation.length) scopeKnown = false
        for (const office of entity.jobLocation || []) {
          if (!office || typeof office.fqLocationName !== 'string') { scopeKnown = false; continue }
          const country = office.fqLocationName.split(',').at(-1).trim().toLowerCase()
          if (!knownCountries.has(country)) scopeKnown = false
          if (office.country != null && (typeof office.country !== 'string' || office.country.toLowerCase() !== country)) throw new Error('Myntra conflicting native country')
          if (office.countryCode != null) {
            const code = typeof office.countryCode === 'string' ? office.countryCode.trim() : ''
            if (code.toLowerCase() !== country && (!/^[A-Za-z]{2}$/.test(code)
              || regions.of(code.toUpperCase()).toLowerCase() !== country)) throw new Error('Myntra conflicting native country code')
          }
        }
        if (!/^(open|active|closed|inactive)$/i.test(entity.jobStatus?.statusCode || entity.jobPosting?.status || '')) throw new Error('Myntra unknown native publication status')
        if (entity.jobStatus?.statusCode != null && entity.jobPosting?.status != null
          && /^(open|active)$/i.test(entity.jobStatus.statusCode) !== /^(open|active)$/i.test(entity.jobPosting.status)) throw new Error('Myntra conflicting native publication status')
      }
      if (totalCount != null && seen.size > totalCount) throw new Error('Myntra native identities exceed total')
      const pageJobs = extractIndiaJobsFromSearchPayload(payload, {
        workspaceId,
        scrapedAt,
      })

      for (const job of pageJobs) {
        const raw = payload.entities.find(entity => entity.displayId === job.jobId)
        const nativeDate = value => {
          if (value == null) return null
          if (!['number', 'string'].includes(typeof value) || !Number.isFinite(new Date(value).getTime())) throw new Error('Myntra invalid native role date')
          return new Date(value).toISOString()
        }
        job.postingDate = nativeDate(raw.jobPosting?.startDate || raw.createdOn || raw.updatedOn)
        job.closingDate = nativeDate(raw.jobPosting?.endDate)
        if (job.closingDate) job.sourceClosingDateIsExact = true
        job.sourceDetailComplete = hasSourceDescription(job)
        if (!job.sourceDetailComplete) job.sourceDetailFailureKind = 'missing-content'
      }
      jobs.push(...pageJobs)

      if (maxJobs && jobs.length >= maxJobs) {
        limited = jobs.length > maxJobs || totalCount == null || seen.size < totalCount
        jobs.splice(maxJobs)
        if (limited) break
      }

      if (totalCount != null && seen.size === totalCount) { complete = true; break }
      if (totalCount != null && payload.entities.length < pageSize) throw new Error('Myntra premature page before reported total')
      if (totalCount == null) {
        const entityCount = Array.isArray(payload?.entities) ? payload.entities.length : 0
        if (entityCount < pageSize) break
      }
    }
    if (complete) {
      try {
        complete = extractTotalCount(await request(fetchJson, buildJobsCountUrl(), {
          method: 'GET', headers: buildPublicApiHeaders({ workspaceId }),
        })) === totalCount
      } catch { signal?.throwIfAborted(); complete = false }
    }
    complete = complete && !limited && scopeKnown
    if (!complete) jobs.forEach(job => { job.sourceListingComplete = false })
    return attachInventoryEvidence(jobs, { status: complete ? totalCount === 0 ? 'verified-empty' : 'complete-inventory' : 'discovery-only',
      firstParty: true, listingComplete: complete, surface: JOB_PORTAL_URL, reportedTotal: totalCount,
      indiaFacetCount: complete ? jobs.length : null, pagesFetched, verifiedAt: now(),
      reason: complete ? 'native-workspace-stable-total-all-unique-pages' : 'native-inventory-count-limit-or-location-scope-unverified' })
  },
})

export const run = async (options = {}) => createMyntraScraper().run(options)

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
