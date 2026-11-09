import {createPublicWorkableSource,PUBLIC_WORKABLE_PROFILES} from '../../scraper-support/native-sources/publicWorkableSources/nativeCareers.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'


const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "huggingface"
export const COMPANY = "Hugging Face"
export const CAREERS_URL = 'https://apply.workable.com/huggingface/'
export const DISPOSITION = 'live-parser'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Public original GET discovery observations; employer and India totals remain unqualified.'

export const createHuggingFaceScraper = (options = {}) => createPublicWorkableSource(PUBLIC_WORKABLE_PROFILES.find(p => p.source === 'huggingface'), options)

export const run = async (options = {}) => createHuggingFaceScraper(options).run(options)

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
