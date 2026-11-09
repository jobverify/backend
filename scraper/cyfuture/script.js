import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {SOURCE,COMPANY,INDEX,readIndex,readRole,makeListingObservation} from './nativeModels.js'
import {runCyfutureNative} from './nativeCareers.js'
export {SOURCE,COMPANY}
export const VERIFIED_AT='2026-11-05',HOMEPAGE_URL='https://cyfuture.com/',CAREERS_URL='https://cyfuture.com/careers.html'
export const CURRENT_OPPORTUNITIES_URL=INDEX,UPLOAD_RESUME_URL='https://www.cyfuture.com/upload-resume.html'
export const hasCurrentOpportunitiesSignal=html=>{try{readIndex(html);return true}catch{return false}}
export const hasJobDetailSignal=html=>/^Apply for Job ID \d+(?: |$)/.test(activeHead(html).titles[0]||'')
export const extractLocationTabs=html=>readIndex(html).tabs.map(t=>({paneId:t.paneAttrs.id,label:t.label}))
export const extractCurrentOpportunities=html=>readIndex(html).rows.map(row=>makeListingObservation(row))
export const extractJobDetail=(html,listing={})=>readRole(html,{...listing,jobId:String(listing.jobId||'')})
export const createCyfutureScraper=(defaults={})=>({run:(options={})=>runCyfutureNative({...defaults,...options})})
export const run=(options={})=>runCyfutureNative(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
