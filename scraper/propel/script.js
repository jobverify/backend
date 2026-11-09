import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { createAshbyApiScraper } from '../../scraper-support/utils/ashbyApi.js'
import { attachInventoryEvidence, mapJobsWithInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://www.propel.app/careers/'
export const ASHBY_BOARD_URL = 'https://jobs.ashbyhq.com/propel'
export const ASHBY_JOB_BOARD_URL = 'https://api.ashbyhq.com/posting-api/job-board/propel'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeString = (value) => {
  if (value == null) return null

  const normalized = String(value).replace(/\s+/g, ' ').trim()
  return normalized || null
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeString(value)
  if (!normalized) return null

  return normalized.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ')
}

const getPostalAddress = (value = {}) => value?.address?.postalAddress || value?.address || {}

const getPrimaryAddress = (job = {}) => getPostalAddress(job)

const selectSecondaryLocation = (job = {}) => {
  const locations = Array.isArray(job?.secondaryLocations) ? job.secondaryLocations : []

  return locations.find((location) => {
    const address = getPostalAddress(location)
    return normalizeString(location?.location || location?.name)
      || normalizeString(address?.addressLocality)
      || normalizeString(address?.addressRegion)
      || normalizeString(address?.addressCountry)
  }) || null
}

const toLocationDetails = (job = {}) => {
  const primaryAddress = getPrimaryAddress(job)
  const secondaryLocation = selectSecondaryLocation(job)
  const secondaryAddress = getPostalAddress(secondaryLocation)

  return {
    location: normalizeString(job?.location),
    city: normalizeString(secondaryAddress?.addressLocality || primaryAddress?.addressLocality),
    state: normalizeString(secondaryAddress?.addressRegion || primaryAddress?.addressRegion),
    country: normalizeString(primaryAddress?.addressCountry || secondaryAddress?.addressCountry),
  }
}

export const extractAshbyJobs = (payload = {}) => (
  (Array.isArray(payload?.jobs) ? payload.jobs : [])
    .filter((job) => job?.isListed === true)
    .map((job) => {
      const title = normalizeString(job?.title)
      const jobId = normalizeString(job?.id)
      const sourceUrl = normalizeString(job?.jobUrl)
      const applyUrl = normalizeString(job?.applyUrl)
      const location = toLocationDetails(job)

      if (!title || !jobId || !sourceUrl || !applyUrl || !location.location) {
        return null
      }

      return {
        title,
        company: 'Propel',
        department: normalizeString(job?.department),
        team: normalizeString(job?.team),
        location: location.location,
        city: location.city,
        state: location.state,
        country: location.country,
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl,
        employmentType: normalizeEmploymentType(job?.employmentType),
        workplaceType: normalizeString(job?.workplaceType),
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeString(job?.publishedAt),
        closingDate: null,
        jobDescription: normalizeString(job?.descriptionHtml),
      }
    })
    .filter(Boolean)
)

const defaultFetchJson = (url, options) => fetchJsonWithRetry(url, {
  ...options,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
  },
  label: 'propel',
  timeoutMs: 15000,
})

const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(15000)]),
  })
  return { status: response.status, url: response.url, html: await response.text() }
}

export const createPropelScraper = () => ({
  async run({ fetchJson = defaultFetchJson, fetchPage = defaultFetchPage, signal } = {}) {
    signal?.throwIfAborted()
    const page = await fetchPage(CAREER_PAGE_URL, { signal })
    signal?.throwIfAborted()
    if (Number(page?.status) !== 200 || String(page?.url || '').replace(/\/+$/, '') !== CAREER_PAGE_URL.replace(/\/+$/, '')) {
      throw new Error('Propel current official careers page unavailable')
    }
    const delegatedLinks = readNativeDocument(page.html).nodes(node => node.tag === 'a' && node.attrs.href)
      .flatMap(node => {
        try {
          const url = new URL(node.attrs.href, CAREER_PAGE_URL)
          return url.origin === 'https://jobs.ashbyhq.com' && !url.username && !url.password
            && /^\/propel(?:\/[^/]+(?:\/application)?)?\/?$/.test(url.pathname) ? [url] : []
        } catch { return [] }
      })
    if (!delegatedLinks.length) throw new Error('Propel current employer Ashby handoff binding unavailable')

    let payload
    const jobs = await createAshbyApiScraper({ source: 'propel', companyName: 'Propel',
      ashbyJobBoardUrl: ASHBY_JOB_BOARD_URL,
    }).run({ signal, fetchJson: async (url, options) => {
      payload = await fetchJson(url, options)
      return payload
    } })
    const advertisedIds = delegatedLinks.map(url => url.pathname.split('/').filter(Boolean)[1]).filter(Boolean)
    if (advertisedIds.some(id => !payload.jobs.some(row => row.id === id))) {
      attachInventoryEvidence(jobs, { ...readInventoryEvidence(jobs), status: 'discovery-only', listingComplete: false,
        reason: 'propel-official-role-links-not-reconciled' })
      for (const job of jobs) job.sourceListingComplete = false
    }
    const byId = new Map(payload.jobs.map(row => [row.id, row]))

    return mapJobsWithInventoryEvidence(jobs, (job) => ({
      ...job,
      team: normalizeString(byId.get(job.jobId)?.team),
      workplaceType: normalizeString(byId.get(job.jobId)?.workplaceType),
      remoteStatus: normalizeString(byId.get(job.jobId)?.workplaceType),
      source: 'propel',
      link: job.applyUrl,
      scrapedAt: new Date().toISOString(),
      companyCareerPage: CAREER_PAGE_URL,
      companyDomain: 'propel.app',
      atsPlatform: 'ashby',
    }))
  },
})

export const run = async (options = {}) => createPropelScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, 'propel')
}
