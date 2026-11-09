import {fileURLToPath} from 'node:url'
import {runNativeBrihaspathi,inspectNativePage,inspectNativePayload} from './native.js'
export {SOURCE,COMPANY,CAREERS_URL,JOBS_API_URL} from './native.js'
export const hasOfficialCareersSignal=(html,client)=>{try{return inspectNativePage(html,client).clientVerified}catch{return false}}
// Server-rendered zero text is never inventory evidence for this client board.
export const hasZeroVacanciesSignal=()=>false
export const extractJobsFromPayload=payload=>inspectNativePayload(payload).records.filter(r=>r.countryCode==='IN')
export const createBrihaspathiScraper=(defaults={})=>({run:options=>runNativeBrihaspathi({...defaults,...options})})
export const run=options=>createBrihaspathiScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,fileURLToPath(new URL('./jobs.json',import.meta.url)))
 else await saveToDB(jobs,'brihaspathi')
}
