import {createPeopleStrongPairScraper,buildPairListUrl} from '../../scraper-support/shared/peopleStrongNativePair20261027.js'
import {ANTHEM_CATALOG} from './catalog.js'
import {createCurrentAnthemInventory} from './currentInventory.js'
export const SOURCE=ANTHEM_CATALOG.source
export const COMPANY=ANTHEM_CATALOG.companyName
export const HOMEPAGE_URL=ANTHEM_CATALOG.homepageUrl
export const CAREERS_PAGE_URL=ANTHEM_CATALOG.companyCareerPage
export const PORTAL_ORIGIN=ANTHEM_CATALOG.portalOrigin
export const JOB_LISTINGS_URL=ANTHEM_CATALOG.jobListingsUrl
export const DEFAULT_PAGE_SIZE=45
export const DEFAULT_SEARCH_BODY=Object.freeze({})
export const buildApiUrl=({offset=0,limit=DEFAULT_PAGE_SIZE}={})=>{
 if(limit!==DEFAULT_PAGE_SIZE)throw Error('Anthem current reviewed public protocol requires 45-row pages')
 return buildPairListUrl(SOURCE,offset)
}
export const createAnthemScraper=options=>createCurrentAnthemInventory(options)
export const run=options=>createAnthemScraper().run(options)
