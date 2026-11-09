import path from'node:path'
import{fileURLToPath}from'node:url'
import{runCurrentBikayi,HOME,CAREERS}from'./currentKeka.js'
export const SOURCE='bikayi',COMPANY='BIK',HOMEPAGE_URL=HOME,CAREERS_URL=CAREERS
export const createBikayiScraper=()=>({run:(options={})=>runCurrentBikayi(options)})
export const run=(options={})=>createBikayiScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const{saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
