import path from'node:path'
import{fileURLToPath}from'node:url'
import{runCurrentAix,CURRENT_CAREERS,AIX_BOARD,AIX_SEARCH}from'./currentAix.js'
import{AIRASIA_INDIA_CATALOG}from'./catalog.js'
export const SOURCE='airasiaindia',COMPANY='Air India Express',CAREERS_URL=CURRENT_CAREERS
export{AIX_BOARD,AIX_SEARCH}
export const PROVIDER_METADATA=AIRASIA_INDIA_CATALOG
export const createAirAsiaIndiaScraper=()=>({run:(options={})=>runCurrentAix(options)})
export const run=(options={})=>createAirAsiaIndiaScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const{saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
