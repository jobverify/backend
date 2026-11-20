import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {runCurrentNative} from './currentNative20261120.js'

export const SOURCE = "lonza"
export const COMPANY = "Lonza"
export const CAREERS_URL = "https://lonza.talent-community.com/projects"
export const DISPOSITION = 'runtime-verified-recruitment'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Current anonymous exact Lonza public portal country pages close before bounded role enrichment; native criteria, dates and explicit partials are retained. Company inventories and cleanup remain unqualified.'
export const run = options => runCurrentNative(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
