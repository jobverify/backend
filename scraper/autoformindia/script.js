import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {run} from './native.js'
export * from './native.js'
export {VERIFIED_SURFACE_SUMMARY} from './catalog.js'
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,'autoformindia')
}
