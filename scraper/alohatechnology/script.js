import {fileURLToPath} from 'node:url'
import {runCurrentAloha,extractCurrentCareerJobs,inspectCurrentCareers} from './currentNative.js'
export const COMPANY_HOME_URL='https://www.alohatechnology.com/'
export const CAREERS_PAGE_URL=COMPANY_HOME_URL+'careers.html'
export const APPLICATION_EMAIL='hr@alohatechnology.com'
export const pageIndicatesAlohaTechnologyCareers=html=>{try{inspectCurrentCareers(html);return true}catch{return false}}
export const extractCareerJobs=extractCurrentCareerJobs
export const createAlohaTechnologyScraper=(defaults={})=>({run:options=>runCurrentAloha({...defaults,...options})})
export const run=options=>createAlohaTechnologyScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,fileURLToPath(new URL('./jobs.json',import.meta.url)))
 else await saveToDB(jobs,'alohatechnology')
}
