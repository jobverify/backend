import path from 'node:path'
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {createVerifiedRecruitmentScraper} from '../../scraper-support/utils/verifiedRecruitment.js'

export const SOURCE='twilio'
export const COMPANY='Twilio'
export const CAREERS_URL='https://www.twilio.com/en-us/careers'
const provider=JSON.parse(readFileSync(new URL('../../scraper-support/providers/providerExtensions/zz-299-twilio-current-native-20261111.json',import.meta.url),'utf8'))
if(provider.source!==SOURCE||provider.companyName!==COMPANY||provider.companyCareerPage!==CAREERS_URL)throw Error('Current Twilio source registration changed')
export const run=options=>createVerifiedRecruitmentScraper(provider).run(options)

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
  const jobs=await run()
  if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
  else await saveToDB(jobs,SOURCE)
}
