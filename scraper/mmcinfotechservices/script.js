import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {MMC_INFOTECH_SERVICES_CATALOG as PROVIDER_METADATA} from './catalog.js'
import {CAREERS,readMmcPage} from './nativeFields.js'
import {runMmcNative} from './nativeCareers.js'
export {PROVIDER_METADATA}
export const SOURCE='mmcinfotechservices',COMPANY='MMC Infotech Services',CAREERS_URL=CAREERS
export const hasOfficialCareersSignal=html=>{try{return Boolean(readMmcPage(html))}catch{return false}}
export const extractListingCards=html=>readMmcPage(html).rows
export const createMmcInfotechServicesScraper=(defaults={})=>({run:(options={})=>runMmcNative({...defaults,...options})})
export const run=(options={})=>createMmcInfotechServicesScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
