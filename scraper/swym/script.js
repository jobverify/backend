import {SWYM_CATALOG} from './catalog.js'
import {runCurrentConfiguredBoard} from './currentConfiguredBoard20261120.js'
export const SOURCE='swym',COMPANY='Swym',HOMEPAGE_URL='https://www.getswym.com/',CAREERS_URL=HOMEPAGE_URL+'careers',JOBS_URL=HOMEPAGE_URL+'jobs',WELLFOUND_JOBS_URL='https://wellfound.com/company/swym/jobs',PROVIDER_METADATA=SWYM_CATALOG
export const createSwymScraper=()=>({run:runCurrentConfiguredBoard})
export const run=options=>runCurrentConfiguredBoard(options)
