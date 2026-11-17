import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {runCurrentRsSoftware} from './currentNative20261117.js'
export {SOURCE,COMPANY,HOMEPAGE_URL,CAREERS_URL} from './currentNative20261117.js'
import {RS_SOFTWARE_INDIA_CATALOG as PROVIDER_METADATA} from './catalog.js'
export {PROVIDER_METADATA}
export const createRsSoftwareIndiaScraper = (defaults={}) => ({run:options=>runCurrentRsSoftware({...defaults,...options})})
export const run = (options={}) => runCurrentRsSoftware(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js');const jobs=await run();if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'));else await saveToDB(jobs,'rssoftwareindia')}
