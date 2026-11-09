import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'quantumbsotechpvtltd'
export const COMPANY = 'Quantum BSO & Tech Pvt. Ltd'
export const HOMEPAGE_URL = 'https://quantumbso.com/'
export const ABOUT_URL = 'https://www.quantumbso.com/about-us'
export const CONTACT_URL = 'https://www.quantumbso.com/contact'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const FIRST_PARTY_JOB_PATH_PATTERN =
  /(?:^|\/)(careers?|jobs?|job|openings?|vacancies?|join-us|work-with-us)(?:\/|$)/i

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bopen roles\b/i,
  /\bjob openings\b/i,
  /\bjob description\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjoin our team\b/i,
  /\bwe(?:'|&#8217;|&#x2019;|&rsquo;)?re hiring\b/i,
  /\bwe are hiring\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /recruitee/i,
  /breezy\.hr/i,
]

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, HOMEPAGE_URL)
  } catch {
    return null
  }
}

const isFirstPartyUrl = (url) => {
  const hostname = String(url?.hostname ?? '').toLowerCase()
  return hostname === 'quantumbso.com' || hostname.endsWith('.quantumbso.com')
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
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
  const normalized = normalizeWhitespace(page)

  return /<title>\s*(?:Quantum\s+[—-]\s+)?Quantum:\s*ERP System\s*&(?:amp;)?\s*Business Intelligence Solution for Logistics\s*<\/title>/i.test(page)
    && normalized.includes('The Digital World')
    && normalized.includes('Technology is the Greatest Change Agent')
    && normalized.includes('Where to find us')
    && normalized.includes('Quantum BSO & Tech Pvt. Ltd')
    && normalized.includes('Koramangala Industrial Area')
    && normalized.includes('Bangalore - 560095')
}

export const hasOfficialAboutSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*(?:Quantum\s+[—-]\s+)?About us - Quantum\s*<\/title>/i.test(page)
    && normalized.includes('The Quantum Story')
    && normalized.includes('Founded in 2003, Quantum is a transportation and logistics solution provider.')
    && normalized.includes('Careers')
    && normalized.includes('At Quantum your contributions can have a global impact')
    && normalized.includes('Then we want to hear from you.')
    && normalized.includes('Get in touch')
    && normalized.includes('Company Name *')
}

export const hasOfficialContactSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*(?:Quantum\s+[—-]\s+)?The Digital World\s*<\/title>/i.test(page)
    && normalized.includes('Get In Touch')
    && normalized.includes("What can we help you with? Drop us a line and let's talk about it.")
    && normalized.includes('India Office')
    && normalized.includes('Quantum BSO & Tech Pvt. Ltd')
    && normalized.includes('Koramangala Industrial Area')
    && normalized.includes('Bangalore - 560095')
    && normalized.includes('Tel - +91 80 4406 6700')
    && normalized.includes('Customer Service Contact')
}

export const hasFirstPartyJobsPathLink = (html) => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1])
    if (!absoluteUrl || !isFirstPartyUrl(absoluteUrl)) {
      continue
    }

    if (FIRST_PARTY_JOB_PATH_PATTERN.test(absoluteUrl.pathname)) {
      return true
    }
  }

  return false
}

export const hasPublicJobsSignal = (html) =>
  hasFirstPartyJobsPathLink(html)
  || PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const createQuantumBsoTechScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200) {
      throw new Error('Quantum BSO & Tech Pvt. Ltd verified official homepage no longer matches the known public surface')
    }
    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Quantum BSO & Tech Pvt. Ltd homepage now exposes public jobs')
    }
    if (!hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Quantum BSO & Tech Pvt. Ltd verified official homepage no longer matches the known public surface')
    }

    const about = await fetchPage(ABOUT_URL)
    if (about.status !== 200) {
      throw new Error('Quantum BSO & Tech Pvt. Ltd verified about page no longer matches the known public surface')
    }
    if (hasPublicJobsSignal(about.html)) {
      throw new Error('Quantum BSO & Tech Pvt. Ltd about page now exposes public jobs')
    }
    if (!hasOfficialAboutSignal(about.html)) {
      throw new Error('Quantum BSO & Tech Pvt. Ltd verified about page no longer matches the known public surface')
    }

    const contact = await fetchPage(CONTACT_URL)
    if (contact.status !== 200) {
      throw new Error('Quantum BSO & Tech Pvt. Ltd verified contact page no longer matches the known public surface')
    }
    if (hasPublicJobsSignal(contact.html)) {
      throw new Error('Quantum BSO & Tech Pvt. Ltd contact page now exposes public jobs')
    }
    if (!hasOfficialContactSignal(contact.html)) {
      throw new Error('Quantum BSO & Tech Pvt. Ltd verified contact page no longer matches the known public surface')
    }

    return []
  },
})

export const run = async (options = {}) => createQuantumBsoTechScraper().run(options)

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
