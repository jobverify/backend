import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {CURRENT_OPENINGS_URL,SOURCE,readCdotListing,makeListingObservation} from './nativeModels.js'
import {runCdotNative} from './nativeCareers.js'
export {CURRENT_OPENINGS_URL,SOURCE}
export const VERIFIED_ON='2026-11-05'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const hasCurrentOpeningsSignal=html=>{try{readCdotListing(html);return true}catch{return false}}
export const extractOpenings=html=>{
 const page=readCdotListing(html)
 return page.rows.map(row=>makeListingObservation(row,page,null))
}
export const createCdotScraper=(configuration={})=>({run:(overrides={})=>runCdotNative({...configuration,...overrides})})
export const run=(options={})=>createCdotScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running C-DOT scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
