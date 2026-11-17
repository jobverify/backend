import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runCurrentDigiledge } from './currentNative20261117.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HOMEPAGE_URL = 'https://digiledge.in/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const BRAND_PATTERN = /\bDigiledge\b/i
const PUBLIC_JOB_BOARD_PATTERN =
  /jobs\.lever\.co|boards\.greenhouse\.io|ashbyhq\.com|workable\.com|smartrecruiters|workdayjobs|\/careers\b|\/jobs\b|join-us|work-with-us|job openings|current openings/i

export const hasOfficialDigiledgeSignal = (html) => BRAND_PATTERN.test(String(html ?? ''))

export const hasPublicJobBoardSignal = (html) => PUBLIC_JOB_BOARD_PATTERN.test(String(html ?? ''))

export const createDigiledgeScraper = () => ({
  run: runCurrentDigiledge,
})

export const run = async (options = {}) => createDigiledgeScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, 'digiledge')
  }
}
