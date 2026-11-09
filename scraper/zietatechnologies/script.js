import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {ZIETA_TECHNOLOGIES_CATALOG as PROVIDER_METADATA} from './catalog.js'
import {PRIMARY,parsePage,rowFor} from './data20261108.js'
import {createZietaNativeScraper} from './native20261108.js'
export {PROVIDER_METADATA}
export const SOURCE=PROVIDER_METADATA.source,COMPANY=PROVIDER_METADATA.companyName,CAREERS_URL=PRIMARY,APPLY_URL=PRIMARY
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const hasOfficialCareersSignal=html=>{try{parsePage(html);return true}catch{return false}}
export const extractJobs=html=>{const page=parsePage(html);return page.records.map((model,i)=>rowFor(model,page.qualifications[i],i))}
export const createZietaTechnologiesScraper=(options={})=>createZietaNativeScraper(options)
export const run=async(options={})=>createZietaTechnologiesScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
