import {SIMPLIFY3X_SOFTWARE_CATALOG} from './catalog.js'
import {runCurrentScope} from './currentScope20261120.js'
export const SOURCE='simplify3xsoftware',COMPANY='Simplify3x Software',PROVIDER_METADATA=SIMPLIFY3X_SOFTWARE_CATALOG
export const HOMEPAGE_URL='https://simplify3x.com.my/',ABOUT_URL=HOMEPAGE_URL+'about.html',CAREERS_URL='https://www.hire3x.com/careers',LISTING_URL='https://api-website.hire3x.com/careers/jobs/?version=v2'
export const createSimplify3xSoftwareScraper=()=>({run:runCurrentScope})
export const run=options=>runCurrentScope(options)
