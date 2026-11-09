import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {runNative} from './nativeRun.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "colgatepalmolive"
export const COMPANY = "Colgate-Palmolive"
export const CAREERS_URL = 'https://jobs.colgate.com/search/'
export const DISPOSITION = 'verified-public-native-widget-india-facet-company-scope-partial'
export const VERIFIED_ON = '2026-10-21'
export const VERIFIED_SURFACE_SUMMARY = 'Current corporate handoff and advertised SAP public widget with stable India pagination and full native details; whole company scope remains unknown.'

export const run = runNative

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
