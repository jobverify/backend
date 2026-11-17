import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {runCurrentNetrack} from './currentNative20261117.js'
export {SOURCE,COMPANY,HOMEPAGE_URL,CONTACT_URL,TEAM_URL,ABOUT_URL} from './currentNative20261117.js'
import {NETRACK_CATALOG} from './catalog.js'
export const PROVIDER_METADATA=NETRACK_CATALOG
export const createNetrackScraper=(defaults={})=>({run:options=>runCurrentNetrack({...defaults,...options})})
export const run=(options={})=>runCurrentNetrack(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js');const jobs=await run();if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'));else await saveToDB(jobs,'netrack')}
