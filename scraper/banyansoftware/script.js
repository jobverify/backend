import { createNativeGreenhouseScraper, NATIVE_GREENHOUSE_PROFILES, nativeSourceMetadata } from '../../scraper-support/native-sources/declaredGreenhouse/nativeCareers.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runNativeBanyan } from './nativeRun.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "banyansoftware"
export const COMPANY = "Banyan Software"
export const CAREERS_URL = 'https://banyansoftware.com/careers'
export const DISPOSITION = 'current-declared-native-models-source-scope-unqualified'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Current native published models only; whole-source recruitment, applications and publication unqualified.'

export const run = options => createNativeGreenhouseScraper(NATIVE_GREENHOUSE_PROFILES["banyansoftware"]).run(options)

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
