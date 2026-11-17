import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {runCurrentSgbi} from './currentNative20261117.js'
export {SOURCE,COMPANY,HOMEPAGE_URL,CAREERS_URL} from './currentNative20261117.js'
export const createSastraRoboticsSgbiIncScraper = (defaults={}) => ({run:options=>runCurrentSgbi({...defaults,...options})})
export const run = (options={}) => runCurrentSgbi(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js');const jobs=await run();if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'));else await saveToDB(jobs,'sastraroboticssgbiinc')}
