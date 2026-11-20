import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {runCurrentPublications} from './currentPublication20261120.js'

export const SOURCE = "zffriedrichshafen"
export const COMPANY = "ZF Friedrichshafen"
export const CAREERS_URL = 'https://www.zf.com/india/en/careers/careers.html'
export const DISPOSITION = 'current-native-partial-publications'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Current corporate-declared ZF group publications retain native employer and legal labels, typed India workplaces, original dates/criteria and exact own applications. Full company inventory, renderer/application controls and cleanup remain unverified.'
export const createZfScraper = () => ({run:runCurrentPublications})
export const run = options => runCurrentPublications(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
