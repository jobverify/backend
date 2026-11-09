import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runNative } from './native.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "blenheimchalcot"
export const COMPANY = "Blenheim Chalcot"
export const CAREERS_URL = 'https://blenheimchalcot.com/careers'
export const DISPOSITION = 'official-two-greenhouse-board-bounded-native-coverage-gap'
export const VERIFIED_ON = '2026-10-22'
export const VERIFIED_SURFACE_SUMMARY = 'Corporate careers advertises two public Greenhouse boards. Source preserves native recruiter/business labels, publication and complete role content; conflicting country evidence is excluded and whole-company employer coverage remains unknown.'

export const run = (options = {}) => runNative(options)

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
