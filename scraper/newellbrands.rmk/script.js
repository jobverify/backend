import { runCurrentRmkCountryFacet } from '../../scraper-support/utils/recruitmentRmkCountryFacet.js'
export const SOURCE = 'newellbrands'
export const COMPANY = 'Newell Brands'
export const run = options => runCurrentRmkCountryFacet(SOURCE, options)
export default { run }
