import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { run as runNative } from './native.js'
export { parseBinding, parsePage, parseDetail } from './native.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "averydennison"
export const COMPANY = "Avery Dennison"
export const CAREERS_URL = 'https://www.averydennison.com/en/home/careers/search-jobs.html'
export const DISPOSITION = 'current-advertised-public-native-India-surface-company-scope-partial'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Current corporate client advertises AveryDennison SmartRecruiters public listing and details. Complete native pages, typed India, active/PUBLIC full JDs, native releasedDate and exact configured role/application URLs are rechecked per run; whole-company/legal-employer coverage remains unknown.'

export const run = options => runNative(options)

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
