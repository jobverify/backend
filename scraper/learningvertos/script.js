import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'learningvertos'
export const COMPANY = 'Learning Vertos'
export const PRIMARY_URLS = [
  'https://learningvertos.com/',
  'https://www.learningvertos.com/',
  'https://learningvertos.com/careers',
  'https://www.learningvertos.com/careers',
  'https://learningvertos.in/',
  'https://www.learningvertos.in/',
  'https://learningvertos.co.in/',
  'https://www.learningvertos.co.in/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bcareers at learning vertos\b/i,
  /\bapply now\b/i,
  /\bjoin our team\b/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /greenhouse/i,
  /lever/i,
  /smartrecruiters/i,
  /ashbyhq/i,
  /jobvite/i,
]

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultProbeUrl = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: createTimeoutSignal(15000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedAbsentSurfaceError = (error) => {
  const message = normalizeWhitespace([
    error?.message,
    error?.cause?.message,
    error?.code,
    error?.cause?.code,
  ].filter(Boolean).join(' ')).toLowerCase()

  return [
    'enotfound',
    'dns name does not exist',
    'remote name could not be resolved',
    'name or service not known',
    'nxdomain',
  ].some((token) => message.includes(token))
}

export const createLearningVertosScraper = () => ({
  async run({ probeUrl = defaultProbeUrl } = {}) {
    for (const url of PRIMARY_URLS) {
      try {
        const page = await probeUrl(url)

        if (hasPublicJobsSignal(page?.html)) {
          throw new Error('Learning Vertos pinned careers candidate now appears to expose public jobs')
        }

        throw new Error('Learning Vertos first-party surface no longer matches the verified absent-site contract')
      } catch (error) {
        if (error instanceof Error) {
          if (/pinned careers candidate now appears to expose public jobs/i.test(error.message)) {
            throw error
          }

          if (/first-party surface no longer matches the verified absent-site contract/i.test(error.message)) {
            throw error
          }
        }

        if (!isVerifiedAbsentSurfaceError(error)) {
          throw new Error('Learning Vertos first-party surface probe failed with an unexpected network condition')
        }
      }
    }

    return []
  },
})

export const run = async (options = {}) => createLearningVertosScraper().run(options)

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
