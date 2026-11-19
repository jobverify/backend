import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {runCurrentNative} from './currentNative20261119.js'
export {SOURCE,COMPANY,COMPANY_DOMAIN,CAREERS_URL} from './currentNative20261119.js'
export const createVeriniteTechnologiesScraper=()=>({run:runCurrentNative})
export const run=(options={})=>runCurrentNative(options)
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const{saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run();if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'));else await saveToDB(jobs,'verinitetechnologies')}
