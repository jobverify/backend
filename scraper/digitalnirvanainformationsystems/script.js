import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { DIGITAL_NIRVANA_INFORMATION_SYSTEMS_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&ndash;|&#8211;/gi, '-')
  .replace(/&mdash;|&#8212;/gi, '-')
  .replace(/\u00a0/g, ' ')

const normalizeText = (value) => decodeHtmlEntities(value)
  .replace(/\s+/g, ' ')
  .trim()

const stripHtml = (value) => normalizeText(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeText(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = stripHtml(rawHtml)

  return /<title>\s*Digital Nirvana: AI and Media Intelligence Solutions\s*<\/title>/i.test(rawHtml)
    && /href=["']https:\/\/digital-nirvana\.com\/careers-at-digital-nirvana\/["']/i.test(rawHtml)
    && normalized.includes('Managed Talent Solutions')
    && normalized.includes('AI and Media Intelligence Solutions')
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = stripHtml(rawHtml)

  return /<title>\s*Join Careers at Digital Nirvana Today\s*<\/title>/i.test(rawHtml)
    && normalized.includes('Grow with Purpose: Your Rewarding Career at Digital Nirvana')
    && normalized.includes('Browse By Location')
    && normalized.includes('Apply Now')
    && /mailto:jobs@digital-nirvana\.com/i.test(rawHtml)
  }

export const extractLocationTabs = (html = '') => [...String(html ?? '').matchAll(
  /<a[^>]+(?:data-target|href)=["']#(content-[^"'#]+)["'][^>]*>[\s\S]*?<span class="elementskit-tab-title">([\s\S]*?)<\/span>/gi,
)].map((match) => ({
  paneId: match[1],
  title: normalizeText(match[2]),
}))

export const extractCareerBlocksFromPaneHtml = (html = '') => [...String(html ?? '').matchAll(
  /<h([23])[^>]*class="ekit-heading--title[^"]*"[^>]*>([\s\S]*?)<\/h\1>\s*<h4[^>]*class="ekit-heading--subtitle[^"]*"[^>]*>\s*Process:\s*([\s\S]*?)<\/h4>\s*<div class=['"]ekit-heading__description['"]>\s*<p>([\s\S]*?)<\/p>[\s\S]*?<a[^>]+href=["'](mailto:[^"']+)["'][^>]*>[\s\S]*?<span class="elementor-button-text">\s*Apply Now\s*<\/span>/gi,
)].map((match) => ({
  title: normalizeText(match[2]),
  process: normalizeText(match[3]),
  description: normalizeText(match[4]),
  applyUrl: match[5],
}))

const extractLocationFromDescription = (description = '') =>
  normalizeText(String(description ?? '').match(/Location:\s*(.+?)(?:\s+Apply Now|\s+Read More|$)/i)?.[1] || '')

const extractExperienceFromDescription = (description = '') =>
  normalizeText(String(description ?? '').match(/Experience:\s*(.+?)(?:\s+Location:|$)/i)?.[1] || '')

const normalizeRoleLocation = ({ fallbackLocation, description }) => {
  const explicitLocation = extractLocationFromDescription(description)

  if (/anywhere in india|work form home/i.test(explicitLocation)) {
    return {
      location: 'Anywhere in India',
      city: 'Remote',
      country: 'India',
      remoteStatus: 'Remote',
    }
  }

  if (explicitLocation) {
    const location = explicitLocation.replace(/\.$/, '')
    const city = location.split(',')[0]?.trim() || null

    return {
      location,
      city,
      country: /india/i.test(location) ? 'India' : null,
      remoteStatus: /remote/i.test(location) ? 'Remote' : 'On-site',
    }
  }

  const normalizedFallback = normalizeText(fallbackLocation)
  const city = normalizedFallback.split(',')[0]?.trim() || null

  return {
    location: normalizedFallback,
    city,
    country: /india/i.test(normalizedFallback) ? 'India' : null,
    remoteStatus: 'On-site',
  }
}

export const extractIndiaJobsFromCareersPage = (html = '') => {
  const rawHtml = String(html ?? '')
  const tabs = extractLocationTabs(rawHtml)
    .map((tab) => ({
      ...tab,
      index: rawHtml.indexOf(`id="${tab.paneId}"`),
    }))
    .filter((tab) => tab.index >= 0)
    .sort((left, right) => left.index - right.index)

  const jobs = []

  for (let index = 0; index < tabs.length; index += 1) {
    const currentTab = tabs[index]
    const nextTab = tabs[index + 1]
    const paneHtml = rawHtml.slice(currentTab.index, nextTab?.index ?? rawHtml.length)
    const blocks = extractCareerBlocksFromPaneHtml(paneHtml)

    for (const block of blocks) {
      const normalizedLocation = normalizeRoleLocation({
        fallbackLocation: currentTab.title,
        description: block.description,
      })

      if (normalizedLocation.country !== 'India') {
        continue
      }

      const experienceRequired = extractExperienceFromDescription(block.description)

      jobs.push({
        title: block.title,
        department: block.process || null,
        location: normalizedLocation.location,
        city: normalizedLocation.city,
        country: normalizedLocation.country,
        remoteStatus: normalizedLocation.remoteStatus,
        applyUrl: block.applyUrl,
        jobDescription: block.description || null,
        experienceRequired: experienceRequired || null,
        minimumQualification: null,
      })
    }
  }

  return [...new Map(
    jobs.map((job) => [`${job.title}|${job.department || ''}|${job.location}`, job]),
  ).values()]
}

export const pageExposesStructuredJobListings = (html = '') =>
  extractIndiaJobsFromCareersPage(html).length > 0

export const createDigitalNirvanaInformationSystemsScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('The verified Digital Nirvana homepage no longer matches the trusted first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('The verified Digital Nirvana careers page no longer matches the trusted first-party surface')
    }

    const structuredJobs = extractIndiaJobsFromCareersPage(careersHtml)
    if (structuredJobs.length === 0) {
      throw new Error('The verified Digital Nirvana careers page no longer exposes the trusted India role blocks')
    }

    const scrapedAt = now()

    return structuredJobs.map((job) => {
      const jobId = slugify(`${job.title}-${job.location}`)

      return {
        title: job.title,
        company: COMPANY,
        department: job.department,
        location: job.location,
        city: job.city,
        country: job.country,
        link: job.applyUrl || CAREERS_URL,
        applyUrl: job.applyUrl || null,
        sourceUrl: CAREERS_URL,
        source: SOURCE,
        jobId,
        requisitionId: jobId,
        employmentType: null,
        experienceRequired: job.experienceRequired,
        minimumQualification: job.minimumQualification,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        jobDescription: job.jobDescription,
        remoteStatus: job.remoteStatus,
        scrapedAt,
      }
    })
  },
})

export const run = async (options = {}) => createDigitalNirvanaInformationSystemsScraper().run(options)

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
