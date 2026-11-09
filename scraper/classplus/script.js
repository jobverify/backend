import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { CLASSPLUS_CATALOG } from './catalog.js'
import { createClassplusNativeInventory, extractClassplusRows, CAREERS_URL as NATIVE_CAREERS_URL } from './nativeInventory.js'
import { CLASSPLUS_LIST_API } from './nativeContract.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = CLASSPLUS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = NATIVE_CAREERS_URL
export const API_URL = CLASSPLUS_LIST_API
export const DETAIL_URL = 'https://classplusapp.com/careers/job-description?jobId='

// A validated listing remains native discovery data. Only run() joins it to
// current full details and can produce a publishable India posting.
export const extractJobs = extractClassplusRows
export const createClassplusScraper = options => createClassplusNativeInventory(options)

export const run = async (options = {}) => createClassplusScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()

  if (process.argv.includes('--dry-run')) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
