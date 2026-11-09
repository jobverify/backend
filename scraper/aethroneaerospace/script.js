import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://aethroneaerospace.com/career'
export const CONTACT_PAGE_URL = 'https://aethroneaerospace.com/contact-us'
export const LINKEDIN_COMPANY_PAGE_URL = 'https://www.linkedin.com/company/aethrone-aerospace/'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const extractOpenPositionJob = (bundle) => {
  const match = String(bundle ?? '').match(
    /heading:"Open Positions"[\s\S]*?children:"([^"]+)"\}\),o\.jsx\("small"[\s\S]*?mt-1 mt-md-4",children:"([^"]+)"\}\),o\.jsx\("p",\{className:"maincolor fontsecondary",children:"([^"]+)"\}\)[\s\S]*?href:"(https:\/\/www\.linkedin\.com\/company\/aethrone-aerospace\/[^"]*)"/,
  )

  if (!match) return null

  const [, rawTitle, rawSummary, rawLinkedInPrompt] = match
  const title = normalizeWhitespace(rawTitle)
  const summary = normalizeWhitespace(rawSummary)
  const linkedInPrompt = normalizeWhitespace(rawLinkedInPrompt)

  if (!title || !summary) return null

  return {
    title,
    company: 'AETHRONE AEROSPACE',
    department: 'Engineering',
    location: 'India',
    city: null,
    country: 'India',
    jobId: `aethroneaerospace-${slugify(title)}`,
    requisitionId: `aethroneaerospace-${slugify(title)}`,
    sourceUrl: CAREER_PAGE_URL,
    applyUrl: CONTACT_PAGE_URL,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: normalizeWhitespace(
      `${summary} ${linkedInPrompt?.replace(
        'our LinkedIn page',
        'the AETHRONE AEROSPACE LinkedIn page',
      ) || 'Explore more job opportunities on the AETHRONE AEROSPACE LinkedIn page.'} Apply via the AETHRONE AEROSPACE contact page.`,
    ),
  }
}

const extractInternshipJob = (bundle) => {
  const match = String(bundle ?? '').match(
    /heading:"Open Lap Internships"[\s\S]*?children:\["([^"]+)",o\.jsx\("span",\{className:"fw-bold",children:"([^"]+)"\}\),"([^"]+)",o\.jsx\("span",\{className:"text-primary",children:"([^"]+)"\}\),"([^"]+)"\][\s\S]*?children:"([^"]*PPOs[^"]*)"[\s\S]*?children:"([^"]*Interns have the opportunity[^"]*)"/,
  )

  if (!match) return null

  const [
    ,
    rawPrefix,
    rawQualification,
    rawMiddle,
    rawDuration,
    rawSuffix,
    rawPpoText,
    rawVerticalsText,
  ] = match

  const qualification = normalizeWhitespace(rawQualification)
  const duration = normalizeWhitespace(rawDuration)?.replace(/^duration of\s*/i, '')
  const ppoText = normalizeWhitespace(rawPpoText)
  const verticalsText = normalizeWhitespace(rawVerticalsText)

  if (!qualification || !duration) return null
  const normalizedQualification = qualification[0].toUpperCase() + qualification.slice(1)
  const hasPpo = /Pre-Placement Offers \(PPOs\)/i.test(ppoText || '')
  const mentionsVerticals = /engineering and design to research and development/i.test(
    verticalsText || '',
  )

  return {
    title: 'Open Lap Internship',
    company: 'AETHRONE AEROSPACE',
    department: 'Internship',
    location: 'India',
    city: null,
    country: 'India',
    jobId: 'aethroneaerospace-open-lap-internship',
    requisitionId: 'aethroneaerospace-open-lap-internship',
    sourceUrl: CAREER_PAGE_URL,
    applyUrl: CONTACT_PAGE_URL,
    employmentType: 'Internship',
    experienceRequired: null,
    minimumQualification: normalizedQualification,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: normalizeWhitespace(
      `At AETHRONE AEROSPACE, the open lab internship program offers hands-on experience to ${qualification.toLowerCase()} The internship duration is ${duration} during both sessions. Internship performance may lead to ${hasPpo ? 'Pre-Placement Offers (PPOs)' : 'future opportunities'}, and interns can explore ${mentionsVerticals ? 'verticals across engineering, design, research, and development' : 'multiple company verticals'}. Apply via the AETHRONE AEROSPACE contact page.`,
    ),
  }
}

export const buildSearchUrl = () => CAREER_PAGE_URL

export const pageIndicatesCareerShell = (html) => (
  /Aethrone Aerospace/i.test(String(html ?? ''))
  && /assets\/index-[^"]+\.js/i.test(String(html ?? ''))
)

export const extractBundleUrl = (html) => {
  const match = String(html ?? '').match(
    /<script[^>]+src="([^"]*assets\/index-[^"]+\.js)"/i,
  )
  if (!match) return null

  return new URL(match[1], `${new URL(CAREER_PAGE_URL).origin}/`).toString()
}

export const bundleIndicatesCareerContent = (bundle) => {
  const normalized = normalizeWhitespace(bundle)?.toLowerCase() || ''

  return (
    normalized.includes('open lap internships')
    && normalized.includes('open positions')
    && normalized.includes('aerodynamic design engineer')
  )
}

export const extractJobsFromBundle = (bundle) => {
  const jobs = [
    extractOpenPositionJob(bundle),
    extractInternshipJob(bundle),
  ].filter(Boolean)

  return jobs.sort((left, right) => left.title.localeCompare(right.title))
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createAethroneAerospaceScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const html = await fetchText(buildSearchUrl())

    if (!pageIndicatesCareerShell(html)) {
      throw new Error('AETHRONE AEROSPACE careers page no longer exposes the expected bundle shell')
    }

    const bundleUrl = extractBundleUrl(html)
    if (!bundleUrl) {
      throw new Error('AETHRONE AEROSPACE careers page no longer exposes the expected bundle URL')
    }

    const bundle = await fetchText(bundleUrl)
    if (!bundleIndicatesCareerContent(bundle)) {
      throw new Error('AETHRONE AEROSPACE careers bundle no longer exposes the expected openings content')
    }

    const jobs = extractJobsFromBundle(bundle)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: 'aethroneaerospace',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createAethroneAerospaceScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running AETHRONE AEROSPACE scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'aethroneaerospace')
    console.log('DB result:', result)
    process.exit(0)
  }
}
