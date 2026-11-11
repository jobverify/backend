import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {loadConfig} from '../../scraper-support/utils/loadConfig.js'
import {CAREERS_URL,SOURCE,COMPANY,createSeweurodriveIndiaScraper,extractOpenings,extractApplicationFormUrl,hasOfficialCareersSignal} from './listingQuality20261110.js'
export {CAREERS_URL,SOURCE,createSeweurodriveIndiaScraper,extractOpenings,extractApplicationFormUrl,hasOfficialCareersSignal}
const currentDir=path.dirname(fileURLToPath(import.meta.url)),config=loadConfig(currentDir)
export const run=options=>createSeweurodriveIndiaScraper({maxJobs:Number.isInteger(config.maxJobs)?config.maxJobs:null}).run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 console.log(COMPANY+': '+jobs.length+' listing observations; native country/details remain subject to source holds.')
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
