import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {runCurrentNhost} from './currentNative20261117.js'
export {SOURCE,COMPANY,HOMEPAGE_URL,CAREERS_URL} from './currentNative20261117.js'
export const PROVIDER_METADATA = {
  source: 'nhost',
  companyName: 'Nhost',
  companyCareerPage: 'https://nhost.io/careers',
  companyDomain: 'nhost.io',
  atsPlatform: 'official-current-native-careers-hidden-role-model',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary:
    'Verified on October 3, 2026 that https://nhost.io/careers exposed one first-party role page for Senior Software Engineer, Backend & Operations, with a Remote, Full-time detail page and direct application instructions via careers@nhost.io.',
}
export const createNhostScraper=(defaults={})=>({run:options=>runCurrentNhost({...defaults,...options})})
export const run=(options={})=>runCurrentNhost(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js');const jobs=await run();if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'));else await saveToDB(jobs,'nhost')}
