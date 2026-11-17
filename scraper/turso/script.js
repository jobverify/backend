import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {runCurrentTurso} from './currentNative20261117.js'
export {SOURCE,COMPANY,HOMEPAGE_URL,TERMS_OF_USE_URL,ABOUT_URL,NEWS_URL} from './currentNative20261117.js'
export const createTursoScraper=(defaults={})=>({run:options=>runCurrentTurso({...defaults,...options})})
export const run=(options={})=>runCurrentTurso(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js');const jobs=await run();if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'));else await saveToDB(jobs,'turso')}
