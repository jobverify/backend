import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWatiNativeApi } from './nativeApi.js'

export const CAREERS_URL = 'https://www.wati.io/career/'
export const SOURCE = 'wati'
export const COMPANY = 'WATI'
export const ACCOUNT_UID = 'da70e071-85cc-431f-b985-66f433ef6d33'
export const WORKABLE_BOARD_URL = 'https://apply.workable.com/wati-dot-i-o/'
export const DISPOSITION = 'live-native-workable-inventory'
const config = { source: SOURCE, company: COMPANY, tenant: 'wati-dot-i-o', accountUid: ACCOUNT_UID,
  careersUrl: CAREERS_URL, companyDomain: 'wati.io' }
export const createWatiScraper = () => createWatiNativeApi(config)
export const run = async (options = {}) => createWatiScraper().run(options)

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
