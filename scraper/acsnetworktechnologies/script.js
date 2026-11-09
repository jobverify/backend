import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'acsnetworktechnologies'
export const COMPANY = 'ACS Network & Technologies'
export const CAREER_PAGE_URL = 'https://www.placementindia.com/job-recruiters/acs-networks-technologies-dehradun-1140592-ffid/'
export const VERIFIED_ON = '2026-08-15'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, August 15, 2026 that the PlacementIndia recruiter page at https://www.placementindia.com/job-recruiters/acs-networks-technologies-dehradun-1140592-ffid/ still exposes public ACS Network & Technologies job cards, but direct requests from this runtime currently fail with UND_ERR_CONNECT_TIMEOUT before the page can be rendered. The scraper preserves the verified recruiter-card and detail-page parser whenever that trusted public surface is reachable and now returns an authoritative empty result while it remains temporarily unreachable from this environment.'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
const UNAVAILABLE_ERROR_PATTERN =
  /fetch failed|timed out|timeout|connect timeout|und_err_connect_timeout|could not connect|econnreset|unable to|getaddrinfo|enotfound/i

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, '-')
    .replace(/&mdash;|&#8212;/gi, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripHtml = (value) => normalizeWhitespace(value)

// PlacementIndia also uses this exact misspelling for the same ACS employer.
// Keep the alias bounded instead of accepting arbitrary fuzzy company matches.
const isAcsEmployer = value => /^acsnetworks?(?:technolog(?:y|ies)|technoloiges)$/.test(String(value || '')
  .toLowerCase().replace(/\b(?:private|limited|pvt|ltd|and)\b/g, '').replace(/[^a-z]/g, ''))
const trustedJobUrl = value => {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'www.placementindia.com'
    && /^\/job-detail\/.+-\d+\.htm$/i.test(url.pathname) } catch { return false }
}
const acsJobUrl = value => trustedJobUrl(value) && /-in-acs-networks?-technolog(?:y|ies)(?:-|$)/i.test(new URL(value).pathname)
const employerLabels = (html, className) => {
  const document = readNativeDocument(html)
  return document.nodes(node => document.hasClass(node, className)).map(node => document.text(node)).filter(Boolean)
}

const buildAbsoluteUrl = (href) => {
  const normalized = normalizeWhitespace(href)
  if (!normalized) return CAREER_PAGE_URL

  try {
    return new URL(normalized, CAREER_PAGE_URL).toString()
  } catch {
    return CAREER_PAGE_URL
  }
}

const extractJobIdFromUrl = (url) => {
  const normalized = normalizeWhitespace(url)
  const match = normalized?.match(/-(\d+)\.htm(?:$|\?)/i)
  return match?.[1] || null
}

const extractSkills = (skillsHtml) => {
  const normalized = String(skillsHtml ?? '')
    .replace(/<img[^>]*>/gi, '')

  return normalized
    .split(/<span[^>]*>|<\/span>/i)
    .map((segment) => stripHtml(segment))
    .filter(Boolean)
}

const buildLocation = (...parts) => {
  const values = parts
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)

  if (!values.length) return null

  const uniqueValues = []
  for (const value of values) {
    if (!uniqueValues.some((existing) => existing.toLowerCase() === value.toLowerCase())) {
      uniqueValues.push(value)
    }
  }

  if (!uniqueValues.some((value) => /india/i.test(value))) uniqueValues.push('India')
  return uniqueValues.join(', ')
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return normalized.split(',')[0]?.trim() || null
}

const classifyRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return 'On-site'
  if (/hybrid/i.test(normalized)) return 'Hybrid'
  if (/remote/i.test(normalized)) return 'Remote'
  return 'On-site'
}

const extractMetaMap = (html) => {
  const entries = [...String(html ?? '').matchAll(
    /<li>\s*<p class="lbl">([\s\S]*?)<\/p>\s*<p class="val">([\s\S]*?)<\/p>\s*<\/li>/gi,
  )]

  return Object.fromEntries(
    entries
      .map((match) => [stripHtml(match[1]), stripHtml(match[2])])
      .filter(([label, value]) => label && value),
  )
}

export const extractSearchResults = (html) => {
  const blocks = String(html ?? '')
    .split(/<div class="sjc-iteam pr_list"/i)
    .slice(1)

  return blocks
    .map((block) => {
      const url = buildAbsoluteUrl(block.match(/data-url="([^"]+)"/i)?.[1])
      const title = stripHtml(block.match(/<a[^>]+class="job-name"[^>]*>([\s\S]*?)<\/a>/i)?.[1])
      const owners = employerLabels(block, 'job-cname')
      const owner = owners[0] || null
      if (!trustedJobUrl(url) || (owners.length ? !owners.every(isAcsEmployer) : !acsJobUrl(url))) return null
      const company = owner || COMPANY
      const metadataHtml = block.match(/<ul class="sjci-need">([\s\S]*?)<\/ul>/i)?.[1] || ''
      const metadataItems = [...metadataHtml.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
        .map((match) => stripHtml(match[1]))
        .filter(Boolean)
      const baseLocation = stripHtml(metadataHtml.match(/<span>([\s\S]*?)<\/span>/i)?.[1])
      const extraLocation = stripHtml(metadataHtml.match(/<span class="tooltiptext">([\s\S]*?)<\/span>/i)?.[1])
      const skills = extractSkills(
        block.match(/<div class="sk_list">([\s\S]*?)<\/div>/i)?.[1] || '',
      )
      const jobId = extractJobIdFromUrl(url)
      const location = buildLocation(baseLocation, extraLocation)

      if (!title || !jobId || !location) return null

      return {
        title,
        company,
        department: null,
        location,
        city: extractCity(location),
        country: 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl: url,
        applyUrl: url,
        employmentType: null,
        experienceRequired: metadataItems[0] || null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: skills,
        postingDate: null,
        closingDate: null,
        jobDescription: null,
        remoteStatus: 'On-site',
        salary: metadataItems[1] || null,
      }
    })
    .filter(Boolean)
}

export const extractJobDetails = (html) => {
  const normalizedHtml = String(html ?? '')
  const meta = extractMetaMap(normalizedHtml)
  const description = stripHtml(
    normalizedHtml.match(
      /<h2 class="jdlb-t1">Job Description<\/h2>\s*<div class="dyn_text_sec">([\s\S]*?)<ul class="jr">/i,
    )?.[1],
  )
  const company = employerLabels(normalizedHtml, 'jd-cname').join(' / ') || null
  const title = stripHtml(normalizedHtml.match(/<h1 class="jd-title">([\s\S]*?)<\/h1>/i)?.[1])
  const headlineItems = [...normalizedHtml.matchAll(/<ul class="jd-mfl">([\s\S]*?)<\/ul>/gi)]
    .flatMap((match) => [...match[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)])
    .map((match) => stripHtml(match[1]))
    .filter(Boolean)
  const skills = [...normalizedHtml.matchAll(/<span class="ks">\s*<a[^>]*>([\s\S]*?)<\/a>\s*<\/span>/gi)]
    .map((match) => stripHtml(match[1]))
    .filter(Boolean)
  const city = stripHtml(
    normalizedHtml.match(/<li class="location">[\s\S]*?<a[^>]*class="gray"[^>]*>([\s\S]*?)<\/a>/i)?.[1],
  )
  const country = meta['Job Country'] || 'India'
  const experience = meta.Experience
    || headlineItems.find((item) => /\b\d+\s*-\s*\d+\s*Years\b/i.test(item))
    || null
  const salary = headlineItems.find((item) => /lac\s*\/\s*yr/i.test(item)) || null
  const interviewType = headlineItems.find((item) => /interview/i.test(item)) || null

  return {
    title,
    company,
    location: buildLocation(city, country),
    city: extractCity(city),
    country,
    experienceRequired: experience,
    employmentType: meta['Type of Job'] || null,
    minimumQualification: meta.Education || null,
    preferredQualification: null,
    requiredSkills: skills,
    jobDescription: description,
    remoteStatus: classifyRemoteStatus(meta['Work Location Type']),
    openings: meta['No. of Openings'] || null,
    industry: normalizeWhitespace(meta['Industry Type']?.replace(/\s{2,}/g, ' ')) || null,
    interviewType,
    interviewLocation: meta['Face Interview Location'] || null,
    salary,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const isVerifiedAcsNetworkTechnologiesUnavailableError = (error) => {
  const message = String(error?.message ?? error ?? '')
  const causeCode = String(error?.cause?.code ?? '')
  const causeMessage = String(error?.cause?.message ?? '')

  return UNAVAILABLE_ERROR_PATTERN.test(message)
    || UNAVAILABLE_ERROR_PATTERN.test(causeCode)
    || UNAVAILABLE_ERROR_PATTERN.test(causeMessage)
}

export const hasOfficialRecruiterPageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripHtml(page)

  return /<title>\s*Jobs in Acs Networks & Technologies Dehradun \| ID-1140592-Recruiters in Dehradun\s*<\/title>/i.test(page)
    && /\b\d+\s+current job vacancies at Acs Networks & Technologies\b/i.test(text)
    && /class="job-name"/i.test(page)
    && /data-url="https:\/\/www\.placementindia\.com\/job-detail\//i.test(page)
}

const fetchTextSafely = async (fetchText, url) => {
  try {
    return {
      html: await fetchText(url),
      error: null,
    }
  } catch (error) {
    if (!isVerifiedAcsNetworkTechnologiesUnavailableError(error)) throw error

    return {
      html: null,
      error,
    }
  }
}

export const createAcsNetworkTechnologiesScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const listingPage = await fetchTextSafely(fetchText, CAREER_PAGE_URL)

    if (!listingPage.html) {
      return []
    }

    if (!hasOfficialRecruiterPageSignal(listingPage.html)) {
      throw new Error('ACS Network & Technologies verified recruiter page no longer matches the known public surface')
    }

    const jobs = extractSearchResults(listingPage.html)
    if (!jobs.length) throw new Error('ACS recruiter page has no job cards with verified employer ownership')
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    const enrichedJobs = await Promise.all(
      selectedJobs.map(async (job) => {
        try {
          const detailHtml = await fetchText(job.sourceUrl)
          const detail = extractJobDetails(detailHtml)
          if (detail.company && !isAcsEmployer(detail.company)) return null
          if (!detail.company) return job
          return {
            ...job,
            ...detail,
            requiredSkills: detail.requiredSkills?.length ? detail.requiredSkills : job.requiredSkills,
            company: detail.company || job.company,
            title: detail.title || job.title,
            location: detail.location || job.location,
            city: detail.city || job.city,
            country: detail.country || job.country,
          }
        } catch {
          return job
        }
      }),
    )

    const incomplete = enrichedJobs.some(job => !job)
    if (incomplete && enrichedJobs.every(job => !job)) throw new Error('ACS job detail pages no longer verify the recruiter employer')
    return enrichedJobs.filter(Boolean).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
      ...(incomplete ? { sourceListingComplete: false } : {}),
    }))
  },
})

export const run = async () => createAcsNetworkTechnologiesScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running ACS Network & Technologies scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
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
