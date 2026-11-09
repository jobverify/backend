import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runNative } from './native.js'
import { ACUVATE_SOFTWARE_CATALOG } from './catalog.js'
export * from './native.js'
export const PROVIDER_METADATA=ACUVATE_SOFTWARE_CATALOG
export const VERIFIED_ON=PROVIDER_METADATA.verifiedOn
export const createAcuvateSoftwareScraper=(defaults={})=>({run:options=>runNative({...defaults,...options})})
export const run=options=>runNative(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,'acuvatesoftware')
}