import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {runCurrentNoBroker} from './currentNative20261117.js'
export {SOURCE,COMPANY,HOMEPAGE_URL,CAREERS_URL,JOB_FEED_URL} from './currentNative20261117.js'
import {NOBROKERS_CATALOG} from './catalog.js'
export const PROVIDER_METADATA=NOBROKERS_CATALOG
export const createNobrokersScraper=(defaults={})=>({run:options=>runCurrentNoBroker({...defaults,...options})})
export const run=(options={})=>runCurrentNoBroker(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js');const jobs=await run();if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'));else await saveToDB(jobs,'nobrokers')}
