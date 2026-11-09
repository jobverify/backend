import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'bluestone'
export const COMPANY = 'Bluestone'
export const CAREER_URL = 'https://www.bluestone.com/career'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\b(?:current|open) (?:job )?positions?\b/i,
  /\bcurrent (?:job )?openings?\b/i,
  /\b(?:browse|view) (?:our )?(?:current )?job openings?\b/i,
  /\b(?:apply|join) (?:now|our team)\b/i,
  /jobs\.(?:lever|greenhouse)\.co/i,
  /workdayjobs|myworkdayjobs|smartrecruiters|jobvite|ashbyhq\.com/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&(?:apos|#39);/gi, "'")
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Jobverify Bluestone scraper)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasOfficialCareerSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return normalized.includes('Career | BlueStone.com')
    && normalized.includes('Position Applied For')
    && /BlueStone is (?:an )?India'?s leading destination for high-quality fine jewellery/i.test(normalized)
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const createBluestoneScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const careerPage = await fetchPage(CAREER_URL)

    if (careerPage.status !== 200 || !hasOfficialCareerSignal(careerPage.html)) {
      throw new Error('Bluestone verified official career page no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(careerPage.html)) {
      throw new Error('Bluestone career page now appears to expose public job listings')
    }

    return []
  },
})

export const run = async (options = {}) => createBluestoneScraper().run(options)

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
