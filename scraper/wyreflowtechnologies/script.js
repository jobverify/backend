import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'wyreflowtechnologies'
export const COMPANY = 'Wyreflow Technologies'
export const HOMEPAGE_URL = 'https://wyreflow.com/'
export const CAREERS_URL = 'https://wyreflow.com/pages-html/career.html'
export const CONTACT_URL = 'https://wyreflow.com/pages-html/contact.html'
export const FORM_URL = 'https://forms.gle/7kn4tq2x9L9SaG3e9'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bsearch jobs\b/i,
  /\bview openings\b/i,
  /\bopen roles\b/i,
  /\bopenings at wyreflow\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /workdayjobs/i,
  /myworkdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /breezy\.hr/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const hasPublicJobsSignal = (value) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(value ?? '')))

export const extractOfficialFormLinks = (html, pageUrl = HOMEPAGE_URL) => {
  const source = String(html ?? '')
  const links = [...source.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)]
    .map((match) => match[1])
    .filter((href) => /forms\.gle/i.test(href))
    .map((href) => {
      try {
        return new URL(href, pageUrl).toString()
      } catch {
        return null
      }
    })
    .filter(Boolean)

  return [...new Set(links)]
}

export const hasHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Empowering Businesses[\s\S]*Wyreflow Technology\s*<\/title>/i.test(page)
    && normalized.includes('Leading the Way in Digital Innovation')
    && normalized.includes('Relax and let Wyreflow guide your business into the future')
    && /href=["']\/pages-html\/career\.html["']/i.test(page)
    && /href=["']\/pages-html\/contact\.html["']/i.test(page)
    && normalized.includes('2024 Wyreflow. All Rights Reserved')
}

export const hasCareerPageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const formLinks = extractOfficialFormLinks(page, CAREERS_URL)

  return normalized.includes('Scale New Heights with Wyreflow')
    && normalized.includes('At Wyreflow, explore endless possibilities for growth')
    && normalized.includes('Shape Tomorrow')
    && normalized.includes('For Internship')
    && normalized.includes('For Freshers')
    && normalized.includes('For Experiance')
    && normalized.includes('Frequently Asked Questions')
    && formLinks.length === 1
    && formLinks[0] === FORM_URL
}

export const hasContactPageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const formLinks = extractOfficialFormLinks(page, CONTACT_URL)

  return normalized.includes("Let's talk business.")
    && normalized.includes('For Support: support@wyreflow.com')
    && normalized.includes('Job Opportunity')
    && normalized.includes('Our Global Presence')
    && formLinks.length === 1
    && formLinks[0] === FORM_URL
}

export const createWyreflowTechnologiesScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasHomepageSignal(homepageHtml)) {
      throw new Error('Wyreflow Technologies homepage no longer matches the verified official surface')
    }
    if (hasPublicJobsSignal(homepageHtml)) {
      throw new Error('Wyreflow Technologies homepage now appears to expose public jobs')
    }

    const careerHtml = await fetchText(CAREERS_URL)
    if (!hasCareerPageSignal(careerHtml)) {
      throw new Error('Wyreflow Technologies career page no longer matches the verified official marketing surface')
    }
    if (hasPublicJobsSignal(careerHtml)) {
      throw new Error('Wyreflow Technologies career page now appears to expose public jobs')
    }

    const contactHtml = await fetchText(CONTACT_URL)
    if (!hasContactPageSignal(contactHtml)) {
      throw new Error('Wyreflow Technologies contact page no longer matches the verified official Google Forms handoff')
    }
    if (hasPublicJobsSignal(contactHtml)) {
      throw new Error('Wyreflow Technologies contact page now appears to expose public jobs')
    }

    return []
  },
})

export const run = async (options = {}) => createWyreflowTechnologiesScraper().run(options)

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
