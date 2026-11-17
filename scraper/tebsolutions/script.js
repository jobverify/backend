import {fileURLToPath} from 'node:url'
import {runCurrentNative} from './currentNative20261117.js'
export const SOURCE = 'tebsolutions'
export const COMPANY = 'TEB Solutions'
export const HOMEPAGE_URL = 'https://tebsolutions.in/'
export const PAGE_SITEMAP_URL = 'https://tebsolutions.in/page-sitemap.xml'
export const CAREERS_ROUTE_URLS = [
  'https://tebsolutions.in/careers',
  'https://tebsolutions.in/careers/',
  'https://tebsolutions.in/career',
  'https://tebsolutions.in/career/',
  'https://tebsolutions.in/jobs',
  'https://tebsolutions.in/jobs/',
]

export const createTebSolutionsScraper=()=>({run:runCurrentNative})

export const run=async(options={})=>runCurrentNative(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){const jobs=await run();console.log(`TEB Solutions jobs scraped: ${jobs.length}`)}
