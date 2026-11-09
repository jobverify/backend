import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runVerifiedWorkdayBoardUnion } from '../../scraper-support/shared/workdayBoardUnion.js'
const dir=path.dirname(fileURLToPath(import.meta.url))
export const SOURCE='blackberry'
export const COMPANY='BlackBerry'
export const CAREERS_URL='https://www.blackberry.com/en/careers'
export const run=options=>runVerifiedWorkdayBoardUnion({source:SOURCE,company:COMPANY,employerPattern:/^\d+ BlackBerry India Private Limited$/,
  boards:[{tenant:'bb',site:'BlackBerry',baseUrl:'https://bb.wd3.myworkdayjobs.com/en-US/BlackBerry',scraperDir:dir},
    {tenant:'bb',site:'QNX',baseUrl:'https://bb.wd3.myworkdayjobs.com/en-US/QNX',scraperDir:path.join(dir,'boards/qnx')},
    {tenant:'bb',site:'Student',baseUrl:'https://bb.wd3.myworkdayjobs.com/en-US/Student',scraperDir:path.join(dir,'boards/student')}]},options)
