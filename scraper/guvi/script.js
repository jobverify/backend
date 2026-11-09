import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'guvi'
export const COMPANY = 'GUVI (An HCL Group Company)'
export const HOMEPAGE_URL = 'https://www.guvi.in/'
export const JOBS_URL = 'https://www.guvi.in/jobs/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
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
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title[^>]*>\s*HCL GUVI \| Learn to code in your native language\s*<\/title>/i.test(rawHtml)
    && /"@type":"Organization"/.test(rawHtml)
    && /"url":"https:\/\/www\.guvi\.in\/"/.test(rawHtml)
    && /"name":"HCL GUVI"/.test(rawHtml)
    && /IIT-M & IIM-A incubated Ed-tech company/i.test(normalized)
  }

export const extractJobCards = (html) => {
  const rawHtml = String(html ?? '')
  const matches = rawHtml.matchAll(
    /<div[^>]+class="[^"]*tests-list2?\s+list[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
  )

  const cards = []
  for (const match of matches) {
    const anchors = Array.from(match[1].matchAll(/<a\b/gi))
    cards.push(...anchors)
  }

  return cards
}

export const hasOpenJobCards = (html) => extractJobCards(html).length > 0

export const hasVerifiedJobsShellSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title[^>]*>\s*Jobs \| GUVI\s*<\/title>/i.test(rawHtml)
    && /<link[^>]+rel="canonical"[^>]+href="https:\/\/www\.guvi\.in\/jobs\/"/i.test(rawHtml)
    && /id="jobs-page"/i.test(rawHtml)
    && /id="jobs-current-tab"[\s\S]*?>Current<\/a>/i.test(rawHtml)
    && /id="jobs-closed-tab"[\s\S]*?>Closed<\/a>/i.test(rawHtml)
    && /placeholder="Search jobs"/i.test(rawHtml)
    && /Apply For Your Dream Job/i.test(normalized)
    && /Use Guvi Profile to showcase yourself to companies\./i.test(normalized)
    && /Stay tuned for job updates\./i.test(normalized)
  }

export const createGuviScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('GUVI verified official homepage no longer matches the known public surface')
    }

    const jobsPage = await fetchPage(JOBS_URL)

    if (jobsPage.status !== 200 || !hasVerifiedJobsShellSignal(jobsPage.html)) {
      throw new Error('GUVI verified first-party jobs surface no longer matches the known zero-openings shell')
    }

    if (hasOpenJobCards(jobsPage.html)) {
      throw new Error('GUVI jobs surface changed materially or now exposes public openings')
    }

    return []
  },
})

export const run = async (options = {}) => createGuviScraper().run(options)

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
