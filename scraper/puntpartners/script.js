import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {runCurrentNative} from './currentNative20261117.js'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const SOURCE = 'puntpartners'
export const COMPANY = 'Punt Partners'
export const VERIFIED_AT = '2026-08-04'

export const HOMEPAGE_URL = 'https://punt.partners/'
export const TEAM_URL = 'https://punt.partners/team/'
export const PARTNERS_URL = 'https://punt.partners/partners/'
export const SITEMAP_INDEX_URL = 'https://punt.partners/wp-sitemap.xml'
export const PAGE_SITEMAP_URL = 'https://punt.partners/wp-sitemap-posts-page-1.xml'
export const MISSING_ROUTE_URLS = [
  'https://punt.partners/careers',
  'https://punt.partners/careers/',
  'https://punt.partners/career',
  'https://punt.partners/career/',
  'https://punt.partners/jobs',
  'https://punt.partners/jobs/',
  'https://punt.partners/join-us',
  'https://punt.partners/work-with-us',
  'https://punt.partners/current-openings',
  'https://punt.partners/vacancies',
]

export const createPuntPartnersScraper=()=>({run:runCurrentNative})

export const run=async(options={})=>runCurrentNative(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
