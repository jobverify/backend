import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {collectNativeNotices} from './collector.js'
import {GAIL_CATALOG} from './catalog.js'
export {SOURCE,COMPANY} from './parser.js'
export const CAREERS_URL=GAIL_CATALOG.companyCareerPage,DISPOSITION='official-native-public-notice-and-PDF',VERIFIED_ON=null
export const PROVIDER_METADATA=GAIL_CATALOG,VERIFIED_SURFACE_SUMMARY=GAIL_CATALOG.verifiedSurfaceSummary
export const run=options=>collectNativeNotices(options)
const currentDir=path.dirname(fileURLToPath(import.meta.url))

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, GAIL_CATALOG.source)
  }
}
