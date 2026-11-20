import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {NICE_ACTIMIZE_CATALOG} from './catalog.js'
import {runCurrentScopeHold} from './currentScopeHold20261120.js'
export {isCurrentActimizeIndiaCandidate as isActimizeIndiaJob} from './currentScope20261120.js'
export const SOURCE='niceactimize',COMPANY='NICE Actimize',PROVIDER_METADATA=NICE_ACTIMIZE_CATALOG
export const createNiceActimizeScraper=()=>({run:runCurrentScopeHold})
export const run=options=>createNiceActimizeScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const{saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
