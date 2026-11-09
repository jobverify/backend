import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import {hasCurrentFamHome,runCurrentFam} from './currentNative.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'famapp'
export const COMPANY = 'FamApp by Trio'
export const HOMEPAGE_URL = 'https://www.famapp.in/'
export const CAREERS_URL = 'https://www.famapp.in/careers/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /greenhouse\.io/i,
  /recruitcrm/i,
  /linkedin\.com\/jobs/i,
  /href=["'][^"']*(?:\/jobs\/?|\/careers\/jobs\/?)["']/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&ndash;/gi, '–')
  .replace(/&mdash;/gi, '—')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30000),
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('famapp by trio')
    && normalized.includes('formerly fampay')
    && normalized.includes('want to shape finance for the next gen?')
    && /hsr layout, (?:bengaluru|bangalore), karnataka(?:, india)?,? 560102/.test(normalized)
    && /href=["'][^"']*\/careers\/?["']/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('#jointhefam')
    && normalized.includes('so like, what does fam do?')
    && normalized.includes('challenge the status quo')
    && normalized.includes("warning: our perks might make your friends mad")
    && normalized.includes('free therapy with mental health professionals')
    && normalized.includes('famapp by trio (formerly fampay)')
    && normalized.includes('view openings')
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasKnownFirstPartyJobsHandoffSignal = (html) => {
  const page = String(html ?? '')

  return /href=["'](?:https:\/\/www\.famapp\.in)?\/jobs\/?["']/i.test(page)
    && /view openings/i.test(page)
}

const stripKnownFirstPartyJobsHandoff = (html) =>
  String(html ?? '').replace(
    /<a\b[^>]*href=["'](?:https:\/\/www\.famapp\.in)?\/jobs\/?["'][^>]*>[\s\S]*?<\/a>/gi,
    ' ',
  )

export const JOBS_URL = 'https://www.famapp.in/jobs/'
export const LEVER_API_URL = 'https://api.lever.co/v0/postings/fampay?group=team&mode=json'
const PAGE_SIZE = 100

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) throw new Error('FamApp Lever API HTTP ' + response.status)
  return response.json()
}

const hasExpectedPageUrl = (page, expectedUrl) => page?.status === 200
  && page.url === expectedUrl

export const hasOfficialJobsSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()
  return /<title\b[^>]*>FamApp: Make payments with your own UPI and Card<\/title>/i.test(page)
    && normalized.includes('filter by:')
    && normalized.includes('location')
    && normalized.includes('team')
    && normalized.includes('work type')
    && page.includes('/assets/images/images/pages/jobs/fampayLogo.png')
}

const extractClientScriptUrls = (html) => [...String(html ?? '').matchAll(
  /<script\b[^>]*src=["']([^"']+)["'][^>]*>/gi,
)].map((match) => {
  const url = new URL(match[1], JOBS_URL)
  return url.origin === new URL(HOMEPAGE_URL).origin
    && /^\/_next\/static\/chunks\/[^/]+\.js$/.test(url.pathname) ? url.href : null
}).filter(Boolean)

const verifyLeverClientHandoff = async (html, fetchPage) => {
  const scriptUrls = [...new Set(extractClientScriptUrls(html))]
  if (!scriptUrls.length || scriptUrls.length > 32) {
    throw new Error('FamApp official jobs client script surface changed')
  }
  for (const url of scriptUrls) {
    const script = await fetchPage(url)
    if (!hasExpectedPageUrl(script, url)) {
      throw new Error('FamApp official jobs client script unavailable or redirected')
    }
    if (String(script.html).includes(LEVER_API_URL)) return
  }
  throw new Error('FamApp official jobs client no longer exposes the verified Fampay Lever API')
}

export const buildLeverPageUrl = (skip = 0) => {
  const url = new URL('https://api.lever.co/v0/postings/fampay')
  url.searchParams.set('mode', 'json')
  url.searchParams.set('skip', String(skip))
  url.searchParams.set('limit', String(PAGE_SIZE))
  return url.href
}

const hasPostingUrl = (value, id, apply = false) => {
  try {
    const url = new URL(value)
    return url.origin === 'https://jobs.lever.co'
      && url.pathname === '/fampay/' + id + (apply ? '/apply' : '')
      && !url.search && !url.hash
  } catch {
    return false
  }
}

const validatePosting = (posting) => {
  if (!posting || typeof posting !== 'object'
    || !normalizeWhitespace(posting.id) || !normalizeWhitespace(posting.text)
    || !posting.categories || !normalizeWhitespace(posting.categories.location)
    || !(posting.country === null || typeof posting.country === 'string')
    || !hasPostingUrl(posting.hostedUrl, posting.id)
    || !hasPostingUrl(posting.applyUrl, posting.id, true)
    || (posting.lists != null && !Array.isArray(posting.lists))) {
    throw new Error('FamApp Lever public posting contract changed')
  }
  return posting
}

const uniquePostings = (postings) => {
  const ids = new Set()
  for (const posting of postings) {
    validatePosting(posting)
    if (ids.has(posting.id)) throw new Error('FamApp Lever inventory contains duplicate posting IDs')
    ids.add(posting.id)
  }
  return postings
}

const fetchCompleteInventory = async (fetchJson) => {
  const groups = await fetchJson(LEVER_API_URL)
  if (!Array.isArray(groups) || groups.some((group) =>
    !group || !normalizeWhitespace(group.title) || !Array.isArray(group.postings))) {
    throw new Error('FamApp Lever grouped inventory contract changed')
  }
  const groupedPostings = uniquePostings(groups.flatMap((group) => group.postings))
  const postings = []
  let pagesFetched = 0
  while (true) {
    if (pagesFetched >= 100) throw new Error('FamApp Lever inventory pagination limit reached')
    const page = await fetchJson(buildLeverPageUrl(postings.length))
    pagesFetched += 1
    if (!Array.isArray(page) || page.length > PAGE_SIZE) {
      throw new Error('FamApp Lever paginated inventory contract changed')
    }
    postings.push(...page)
    uniquePostings(postings)
    if (page.length < PAGE_SIZE) break
  }
  const groupedIds = groupedPostings.map((posting) => posting.id).sort()
  const pagedIds = postings.map((posting) => posting.id).sort()
  if (JSON.stringify(groupedIds) !== JSON.stringify(pagedIds)) {
    throw new Error('FamApp Lever incomplete inventory or grouped/paginated posting mismatch')
  }
  return { postings, pagesFetched }
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)
  if (/^full[ -]?time/i.test(normalized)) return 'Full-time'
  if (/^part[ -]?time/i.test(normalized)) return 'Part-time'
  if (/intern/i.test(normalized)) return 'Internship'
  if (/contract/i.test(normalized)) return 'Contract'
  return normalized || null
}

export const extractIndiaJobs = (postings) => uniquePostings(postings)
  .filter((posting) => posting.country?.toUpperCase() === 'IN')
  .map((posting) => {
    const location = normalizeWhitespace(posting.categories.location)
    const createdAt = Number(posting.createdAt)
    const postingDate = Number.isFinite(createdAt) && createdAt > 0
      ? new Date(createdAt).toISOString().slice(0, 10) : null
    const description = [
      posting.descriptionPlain,
      ...(posting.lists ?? []).flatMap((list) => [list.text, list.content]),
      posting.additionalPlain,
    ].map(normalizeWhitespace).filter(Boolean).join('\n\n')
    return {
      title: normalizeWhitespace(posting.text),
      company: COMPANY,
      department: normalizeWhitespace(posting.categories.department ?? posting.categories.team) || null,
      location: /\bindia\b/i.test(location) ? location : location + ', India',
      city: location.includes(',') || /\bremote\b/i.test(location) ? null : location,
      state: null,
      country: 'India',
      jobId: posting.id,
      requisitionId: posting.id,
      sourceUrl: posting.hostedUrl,
      applyUrl: posting.applyUrl,
      employmentType: normalizeEmploymentType(posting.categories.commitment),
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate,
      closingDate: null,
      jobDescription: description || null,
      publicExperienceChecked: true,
      remoteStatus: ({ onsite: 'On-site', 'on-site': 'On-site', hybrid: 'Hybrid', remote: 'Remote' })[posting.workplaceType] ?? null,
    }
  })

export const createFamAppScraper = () => ({
  async run(options={}) {
    const { fetchPage = defaultFetchPage, fetchJson = defaultFetchJson, now = () => new Date().toISOString() }=options
    const homepage = await fetchPage(HOMEPAGE_URL)
    if(hasExpectedPageUrl(homepage,HOMEPAGE_URL)&&hasCurrentFamHome(homepage.html))return runCurrentFam({...options,source:SOURCE,company:COMPANY,now})
    if (!hasExpectedPageUrl(homepage, HOMEPAGE_URL) || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('FamApp verified official homepage no longer matches the trusted first-party surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (!hasExpectedPageUrl(careersPage, CAREERS_URL) || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('FamApp verified careers page no longer matches the trusted first-party surface')
    }

    if (
      (hasPublicJobsSignal(careersPage.html) && !hasKnownFirstPartyJobsHandoffSignal(careersPage.html))
      || hasPublicJobsSignal(stripKnownFirstPartyJobsHandoff(careersPage.html))
    ) {
      throw new Error('FamApp careers page now appears to expose a direct public jobs surface')
    }

    const jobsPage = await fetchPage(JOBS_URL)
    if (!hasExpectedPageUrl(jobsPage, JOBS_URL) || !hasOfficialJobsSignal(jobsPage.html)) {
      throw new Error('FamApp verified official jobs page no longer matches the trusted first-party surface')
    }
    await verifyLeverClientHandoff(jobsPage.html, fetchPage)
    const { postings, pagesFetched } = await fetchCompleteInventory(fetchJson)
    const verifiedAt = now()
    const jobs = extractIndiaJobs(postings).map((job) => ({
      ...job, source: SOURCE, link: job.applyUrl, scrapedAt: verifiedAt,
    }))
    return attachInventoryEvidence(jobs, {
      status: postings.length === 0 ? 'verified-empty' : 'complete-inventory',
      surface: LEVER_API_URL, firstParty: true, listingComplete: true,
      pagesFetched, reportedTotal: postings.length, indiaFacetCount: jobs.length,
      verifiedAt, reason: 'verified-first-party-client-and-reconciled-grouped-paginated-lever-inventory',
    })
  },
})

export const run = async (options = {}) => createFamAppScraper().run(options)

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
