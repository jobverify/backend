import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {readCurrentCareers} from './currentCareers.js'
export {SOURCE,COMPANY,CAREERS_PAGE_URL,JOBS_API_URL} from './currentCareers.js'
export const createTensorGoSoftwarePvtLtdScraper=(defaults={})=>({run:(options={})=>readCurrentCareers({...defaults,...options})})
export const run=(options={})=>readCurrentCareers(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){const{saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run();if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'));else await saveToDB(jobs,'tensorgosoftwarepvtltd')}
