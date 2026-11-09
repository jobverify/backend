import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'intellectyx'
export const COMPANY = 'Intellectyx'
export const HOMEPAGE_URL = 'https://www.intellectyx.com/'
export const CAREERS_URL = 'https://www.intellectyx.com/careers/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_SIGNALS = [
  /<title\b[^>]*>\s*Innovative Generative AI, Data, and Digital Solutions \| Intellectyx\s*<\/title>/i,
  /href=["'][^"']*\/careers\/?["']/i,
  /top-tier talent/i,
]

const CAREERS_SIGNALS = [
  /<title\b[^>]*>\s*Careers\s*-\s*Intellectyx\s*<\/title>/i,
  /One Team - One Company - Intellectyx/i,
  /Discover new opportunities in data and analytics consulting\./i,
  /Send Your Resume/i,
  /recruitment@intellectyx\.com/i,
]

const STRONG_PUBLIC_JOB_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bjob description\b/i,
  /\bview jobs\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
]

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    ok: response.ok,
    status: response.status,
    url: response.url,
    text: await response.text(),
  }
}

const hasCurrentCompanyIdentity = (html) =>
  /mailto:info@intellectyx\.com/i.test(String(html ?? ''))
  && /Intellectyx is an Enterprise Agentic AI innovation and delivery partner\./i.test(String(html ?? ''))

export const hasOfficialHomepageSignal = (html) =>
  HOMEPAGE_SIGNALS.every((pattern) => pattern.test(String(html ?? '')))
  || (hasCurrentCompanyIdentity(html)
    && /<title\b[^>]*>\s*Enterprise AI Consulting &amp; Development Company \| Intellectyx\s*<\/title>/i.test(String(html ?? ''))
    && /<link\b[^>]*rel=["']canonical["'][^>]*href=["']https:\/\/www\.intellectyx\.com\/["']/i.test(String(html ?? ''))
    && /href=["']\/careers\/?["']/i.test(String(html ?? '')))

export const hasOfficialCareersSignal = (html) =>
  CAREERS_SIGNALS.every((pattern) => pattern.test(String(html ?? '')))
  || (hasCurrentCompanyIdentity(html)
    && /<title\b[^>]*>\s*Enterprise AI Careers \| Join Intellectyx\s*<\/title>/i.test(String(html ?? ''))
    && /<link\b[^>]*rel=["']canonical["'][^>]*href=["']https:\/\/www\.intellectyx\.com\/careers\/["']/i.test(String(html ?? ''))
    && /Send Us Your Resume/i.test(String(html ?? ''))
    && /Share your resume with our recruitment team/i.test(String(html ?? ''))
    && /mailto:recruitment@intellectyx\.com/i.test(String(html ?? '')))

export const pageExposesPublicJobListings = (html) => {
  const page = String(html ?? '')

  return STRONG_PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(page))
    || /\bapply now\b[\s\S]{0,120}\b(?:job|position|opening|role|vacanc(?:y|ies))\b/i.test(page)
    || /\b(?:job|position|opening|role|vacanc(?:y|ies))\b[\s\S]{0,120}\bapply now\b/i.test(page)
}

export const createIntellectyxScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (!homepage.ok || !hasOfficialHomepageSignal(homepage.text)) {
      throw new Error('The official Intellectyx homepage no longer matches the verified public surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (!careersPage.ok || !hasOfficialCareersSignal(careersPage.text)) {
      throw new Error('The official Intellectyx careers page no longer matches the verified resume-only surface')
    }

    if (pageExposesPublicJobListings(careersPage.text)) {
      throw new Error('The official Intellectyx careers page appears to expose public job listings')
    }

    return attachInventoryEvidence([], {
      status: 'discovery-only', surface: CAREERS_URL, firstParty: true, listingComplete: false,
      pagesFetched: 2, reportedTotal: null, indiaFacetCount: null, verifiedAt: new Date().toISOString(),
      reason: "Intellectyx generic resume landing is a discovery surface; complete public job inventory is unverified.",
    })
  },
})

export const run = async (options = {}) => createIntellectyxScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  const evidence = readInventoryEvidence(jobs)
  if (evidence?.listingComplete === false) {
    if (isDryRun) {
      const { writeFile } = await import('node:fs/promises')
      await writeFile(path.join(currentDir, 'inventory-evidence.json'), JSON.stringify(evidence, null, 2))
    }
    console.error(evidence.reason)
    process.exitCode = 1
  } else if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
