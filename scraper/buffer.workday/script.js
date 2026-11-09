import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {collect} from './native.js'
export {fetchNativePage,inspectEmptyPage} from './native.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "buffer"
export const COMPANY = "Buffer"
export const CAREERS_URL = 'https://buffer.com/journey'
export const DISPOSITION = 'native-explicit-empty-contract-with-independent-closing'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Read the current official journey page; qualify zero only with visible employer-wide scope, corroborating native empty role data and a matching fresh independent closing read. Changed or unsupported positive schemas fail closed; no historical ATS URL supplies current inventory authority.'

export const run = async (options = {}) => collect(options)

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
