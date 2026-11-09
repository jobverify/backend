import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_URL = 'https://www.cogoport.com/company/careers'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const OFFICIAL_BRAND_PATTERN = /\b(?:Careers at Cogoport|Join Team Cogoport)\b/i
const APPLY_BY_EMAIL_PATTERN = /mailto:careers@cogoport\.com|careers@cogoport\.com/i
const ROLE_FAMILY_PATTERN =
  /\brole in the subject line\b|\brole you are applying for as a subject\b|\bemail your resume\b|\bsend your CV\/Resume\b/i
const PUBLIC_JOB_BOARD_PATTERN =
  /jobs\.lever\.co|boards\.greenhouse\.io|ashbyhq\.com|workable\.com|smartrecruiters|job-boards\.greenhouse\.io|myworkdayjobs|job openings\/search|\/jobs\/[a-z0-9-]+/i

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  return OFFICIAL_BRAND_PATTERN.test(page)
    && APPLY_BY_EMAIL_PATTERN.test(page)
    && ROLE_FAMILY_PATTERN.test(page)
}

export const hasPublicJobBoardSignal = (html) => PUBLIC_JOB_BOARD_PATTERN.test(String(html ?? ''))

export const extractSearchResults = () => []

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'cogoport',
  timeoutMs: 15000,
})

export const createCogoportScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(html)) {
      throw new Error('Cogoport careers page no longer matches the verified email-apply public surface')
    }

    if (hasPublicJobBoardSignal(html)) {
      throw new Error('Cogoport careers page now appears to expose a public job board')
    }

    return extractSearchResults(html)
  },
})

export const run = async (options = {}) => createCogoportScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, 'cogoport')
  }
}
